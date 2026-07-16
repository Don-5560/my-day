// データの読み書きを一手に引き受ける「唯一の真実」。
// ウェブサーバー(server.js)とMCPサーバー(mcp/server.js)の両方がここを通す。
//
// 保存先は libSQL(SQLite)。
//   - ローカル開発: file:./data/my-day.db（ただのファイル）
//   - 本番:        Turso（ネット上のSQLite）… 環境変数 DATABASE_URL で切り替え
// 同じコードでどちらでも動くので、ローカルで試してそのまま公開できる。

import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 既定はプロジェクト内の data/my-day.db（絶対パス）。
// こうしておかないと、起動元フォルダ(cwd)によってDBの場所がズレて、
// ウェブアプリとClaude(MCP)が別々のDBを見てしまう。
const DEFAULT_DB_URL = "file:" + path.join(__dirname, "..", "data", "my-day.db");
const DB_URL = process.env.DATABASE_URL || DEFAULT_DB_URL;
const DB_TOKEN = process.env.DATABASE_AUTH_TOKEN;
const db = createClient(DB_TOKEN ? { url: DB_URL, authToken: DB_TOKEN } : { url: DB_URL });

// 曜日キー（templates の days で使う）
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// 初回に出す定番タスクのサンプル（空っぽだと寂しいので）
const SAMPLE_TEMPLATES = {
  recurring: [
    { title: "水を2L飲む", days: "daily" },
    { title: "ストレッチ 5分", days: "daily" },
    { title: "英語の勉強", days: ["mon", "wed", "fri"] },
  ],
};

let ready = null;
async function init() {
  if (ready) return ready;
  ready = (async () => {
    // ローカルのファイルDBなら、置き場所のフォルダを用意しておく
    if (DB_URL.startsWith("file:")) {
      const rel = DB_URL.slice("file:".length);
      const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
    }
    await db.execute(`CREATE TABLE IF NOT EXISTS days (
      date TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    // お金の取引台帳。残高はここから毎回計算する（残高列は持たない）。
    await db.execute(`CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      memo TEXT,
      source TEXT,
      createdAt TEXT
    )`);
    // テンプレート未設定なら、サンプルを入れておく
    const t = await db.execute("SELECT value FROM kv WHERE key = 'templates'");
    if (t.rows.length === 0) {
      await db.execute({
        sql: "INSERT INTO kv (key, value) VALUES ('templates', ?)",
        args: [JSON.stringify(SAMPLE_TEMPLATES)],
      });
    }
  })();
  return ready;
}

// "2026-07-15" のような今日の日付（ローカルタイム）
export function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isValidDate(date) {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// --- 低レベルの読み書き ---

async function readDayRow(date) {
  await init();
  const rs = await db.execute({ sql: "SELECT data FROM days WHERE date = ?", args: [date] });
  return rs.rows.length ? JSON.parse(rs.rows[0].data) : null;
}

async function writeDayRow(day) {
  await init();
  await db.execute({
    sql: "INSERT INTO days (date, data) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET data = excluded.data",
    args: [day.date, JSON.stringify(day)],
  });
}

// --- テンプレート（定番・繰り返しタスク） ---

export async function getTemplates() {
  await init();
  const rs = await db.execute("SELECT value FROM kv WHERE key = 'templates'");
  return rs.rows.length ? JSON.parse(rs.rows[0].value) : { recurring: [] };
}

export async function saveTemplates(templates) {
  await init();
  const clean = { recurring: Array.isArray(templates?.recurring) ? templates.recurring : [] };
  await db.execute({
    sql: "INSERT INTO kv (key, value) VALUES ('templates', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [JSON.stringify(clean)],
  });
  return clean;
}

// その日に出すべき定番タスク（daily か、その曜日を含むもの）
function templatesForDate(templates, date) {
  const weekday = WEEKDAYS[new Date(date + "T00:00:00").getDay()];
  return (templates.recurring || []).filter((t) => {
    if (!t.days || t.days === "daily") return true;
    if (Array.isArray(t.days)) return t.days.includes(weekday);
    return false;
  });
}

// --- 1日分のデータ ---

function emptyDay(date) {
  return { date, tasks: [], diary: "", mood: "" };
}

function makeTask(title, source = "manual", extra = {}) {
  return {
    id: randomUUID(),
    title: String(title).trim(),
    done: false,
    time: typeof extra.time === "string" ? extra.time : "", // 任意の時刻 "HH:MM"（予定表示用）
    cat: typeof extra.cat === "string" ? extra.cat : "",     // 任意カテゴリー（勉強/制作/…）
    tags: Array.isArray(extra.tags) ? extra.tags : [],        // 任意タグ
    spentMin: 0,                                              // タイマーで貯まる所要時間（分）
    source, // "template" | "manual" | "ai"
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

// その日のデータを取得。無ければ定番タスクを入れて作り、その場で保存する。
// ここで保存しておかないと、呼ぶたびに定番タスクのIDが変わってしまい、
// 画面が持っているIDと一致しなくなる（チェックや削除が「見つかりません」になる）。
export async function getDay(date = today()) {
  if (!isValidDate(date)) throw new Error(`日付の形式が不正です: ${date}`);
  const existing = await readDayRow(date);
  if (existing) return existing;

  const templates = await getTemplates();
  const day = emptyDay(date);
  for (const t of templatesForDate(templates, date)) {
    day.tasks.push(makeTask(t.title, "template"));
  }
  await writeDayRow(day); // IDを固定するため、初回に materialize したら保存する
  return day;
}

export async function saveDay(day) {
  if (!day || !isValidDate(day.date)) throw new Error("保存するデータの date が不正です");
  await writeDayRow(day);
  return day;
}

// --- タスク操作（読み込み→変更→保存 をまとめる） ---

export async function addTask(date, title, source = "manual", extra = {}) {
  if (!title || !String(title).trim()) throw new Error("タスク名が空です");
  const day = await getDay(date);
  const task = makeTask(title, source, extra);
  day.tasks.push(task);
  await saveDay(day);
  return { day, task };
}

// タスクの項目（タイトル/時刻/カテゴリー/タグ）を編集
export async function updateTask(date, id, fields = {}) {
  const day = await getDay(date);
  const task = day.tasks.find((t) => t.id === id);
  if (!task) throw new Error(`タスクが見つかりません: ${id}`);
  if (typeof fields.title === "string") task.title = fields.title.trim();
  if (typeof fields.time === "string") task.time = fields.time;
  if (typeof fields.cat === "string") task.cat = fields.cat;
  if (Array.isArray(fields.tags)) task.tags = fields.tags;
  await saveDay(day);
  return { day, task };
}

// タスクに所要時間（分）を加算（タイマー連動）
export async function addTaskTime(date, id, min) {
  const m = Math.round(Number(min));
  if (!Number.isFinite(m) || m <= 0) throw new Error("時間(分)が不正です");
  const day = await getDay(date);
  const task = day.tasks.find((t) => t.id === id);
  if (!task) throw new Error(`タスクが見つかりません: ${id}`);
  task.spentMin = (task.spentMin || 0) + m;
  await saveDay(day);
  return { day, task };
}

// done を指定すれば設定、省略すれば反転（トグル）
export async function setTaskDone(date, taskId, done) {
  const day = await getDay(date);
  const task = day.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`タスクが見つかりません: ${taskId}`);
  task.done = typeof done === "boolean" ? done : !task.done;
  task.completedAt = task.done ? new Date().toISOString() : null;
  await saveDay(day);
  return { day, task };
}

export async function updateTaskTitle(date, taskId, title) {
  const day = await getDay(date);
  const task = day.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`タスクが見つかりません: ${taskId}`);
  task.title = String(title).trim();
  await saveDay(day);
  return { day, task };
}

export async function removeTask(date, taskId) {
  const day = await getDay(date);
  const before = day.tasks.length;
  day.tasks = day.tasks.filter((t) => t.id !== taskId);
  if (day.tasks.length === before) throw new Error(`タスクが見つかりません: ${taskId}`);
  await saveDay(day);
  return day;
}

export async function setDiary(date, fields = {}) {
  const day = await getDay(date);
  // 日報の項目: 本文 / 気分 / 反省 / 明日の目標
  for (const k of ["diary", "mood", "reflect", "tomorrow"]) {
    if (typeof fields[k] === "string") day[k] = fields[k];
  }
  await saveDay(day);
  return day;
}

// --- 汎用ドキュメント（モジュールごとのJSONをまるごと保存） ---
// Todo・学習・案件・売上・習慣・XPなど、各モジュールが1つのJSON文書として持つ。
// kvテーブルに "doc:<key>" で保存。1人用アプリなのでこの粒度で十分。

const DOC_KEY_RE = /^[a-z0-9_-]{1,40}$/;

export async function getDoc(key) {
  if (!DOC_KEY_RE.test(key)) throw new Error(`キーが不正です: ${key}`);
  await init();
  const rs = await db.execute({ sql: "SELECT value FROM kv WHERE key = ?", args: ["doc:" + key] });
  return rs.rows.length ? JSON.parse(rs.rows[0].value) : null;
}

export async function saveDoc(key, value) {
  if (!DOC_KEY_RE.test(key)) throw new Error(`キーが不正です: ${key}`);
  await init();
  await db.execute({
    sql: "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: ["doc:" + key, JSON.stringify(value ?? null)],
  });
  return value;
}

// --- お金の管理（残高・収入・支出） ---
// 方針: 残高はキャッシュせず、常に initialBalance + Σincome − Σexpense で計算する。
// 取引は transactions テーブル。初期残高と移行フラグは doc:finance に持つ。

const TX_TYPES = ["income", "expense"];

// 初期残高と移行済みフラグ
export async function getFinance() {
  const f = (await getDoc("finance")) ?? {};
  return { initialBalance: Number(f.initialBalance) || 0, migratedSales: !!f.migratedSales };
}

export async function setInitialBalance(amount) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("初期残高は0以上の整数(円)で指定してください");
  }
  const f = await getFinance();
  f.initialBalance = amount;
  await saveDoc("finance", f);
  return { initialBalance: f.initialBalance };
}

// 取引を1件追加。金額は整数(円)で正の値のみ。
export async function addTransaction({ type, amount, category, date, memo, source } = {}) {
  if (!TX_TYPES.includes(type)) throw new Error('type は "income" か "expense" で指定してください');
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("金額は1以上の整数(円)で指定してください");
  }
  const d = date || today();
  if (!isValidDate(d)) throw new Error(`日付の形式が不正です: ${d}`);
  const row = {
    id: randomUUID(),
    date: d,
    type,
    category: (category && String(category).trim()) || "その他",
    amount,
    memo: memo ? String(memo) : "",
    source: source ? String(source) : "manual",
    createdAt: new Date().toISOString(),
  };
  await init();
  await db.execute({
    sql: `INSERT INTO transactions (id, date, type, category, amount, memo, source, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [row.id, row.date, row.type, row.category, row.amount, row.memo, row.source, row.createdAt],
  });
  // 収入は「売上明細(doc:sales)」にもミラーする（txIdで紐づけ）。フロントの売上画面・ホームの今月売上に反映される。
  if (row.type === "income") {
    const sdoc = (await getDoc("sales")) ?? { logs: [] };
    sdoc.logs.push({ id: randomUUID(), date: row.date, amount: row.amount, source: row.category, memo: row.memo, txId: row.id });
    await saveDoc("sales", sdoc);
  }
  return row;
}

// 取引一覧（月 YYYY-MM / 種別 で絞り込み）
export async function listTransactions({ month, type } = {}) {
  await ensureMigrated();
  const where = [];
  const args = [];
  if (month) { where.push("substr(date,1,7) = ?"); args.push(month); }
  if (type) {
    if (!TX_TYPES.includes(type)) throw new Error('type は "income" か "expense" で指定してください');
    where.push("type = ?"); args.push(type);
  }
  const rs = await db.execute({
    sql: "SELECT id, date, type, category, amount, memo, source FROM transactions" +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY date DESC, createdAt DESC",
    args,
  });
  return rs.rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

// 収入・支出の合計。month省略で全期間。
async function sumTx(month) {
  await init();
  const rs = await db.execute({
    sql: `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions${
      month ? " WHERE substr(date,1,7) = ?" : ""
    } GROUP BY type`,
    args: month ? [month] : [],
  });
  const out = { income: 0, expense: 0 };
  for (const r of rs.rows) out[r.type] = Number(r.total);
  return out;
}

// 現在残高＋指定月（省略で今月）の収支サマリー
export async function financeSummary(month = today().slice(0, 7)) {
  await ensureMigrated();
  const [{ initialBalance }, all, m] = await Promise.all([getFinance(), sumTx(), sumTx(month)]);
  return {
    initialBalance,
    currentBalance: initialBalance + all.income - all.expense,
    month,
    incomeThisMonth: m.income,
    expenseThisMonth: m.expense,
    netThisMonth: m.income - m.expense,
  };
}

// 取引を1件削除（残高は次回集計で自動的に再計算される）
export async function removeTransaction(id) {
  await init();
  const rs = await db.execute({ sql: "DELETE FROM transactions WHERE id = ?", args: [id] });
  if (!rs.rowsAffected) throw new Error(`取引が見つかりません: ${id}`);
  // 売上明細にミラーしていた分も消す
  const sdoc = await getDoc("sales");
  if (sdoc && Array.isArray(sdoc.logs)) {
    const before = sdoc.logs.length;
    sdoc.logs = sdoc.logs.filter((l) => l.txId !== id);
    if (sdoc.logs.length !== before) await saveDoc("sales", sdoc);
  }
  return { removed: id };
}

// 既存の doc:sales を1度だけ transactions に income として取り込む（冪等）。
// フロントの売上画面は doc:sales をそのまま使い続けるので消さない。
// 以後の新規売上は log_sale の二重書きで transactions にも入るため、移行は一度きり。
export async function migrateSalesToTransactions() {
  const f = await getFinance();
  if (f.migratedSales) return { migrated: 0, already: true };
  const sales = (await getDoc("sales")) ?? { logs: [] };
  await init();
  let n = 0;
  for (const s of sales.logs || []) {
    const amt = Math.round(Number(s.amount));
    if (!Number.isInteger(amt) || amt <= 0) continue;
    await db.execute({
      sql: `INSERT INTO transactions (id, date, type, category, amount, memo, source, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), s.date || today(), "income", s.source || "その他", amt,
        s.memo || "", "migrated-sale", new Date().toISOString()],
    });
    n++;
  }
  f.migratedSales = true;
  await saveDoc("finance", f);
  return { migrated: n, already: false };
}

// 残高を読む前に一度だけ移行を走らせる（プロセス内でメモ化）
let financeMigration = null;
function ensureMigrated() {
  if (!financeMigration) financeMigration = migrateSalesToTransactions();
  return financeMigration;
}

// --- 履歴（日記の一覧・振り返り用） ---

// 保存済みの日付を新しい順で返す
export async function listDates() {
  await init();
  const rs = await db.execute("SELECT date FROM days ORDER BY date DESC");
  return rs.rows.map((r) => r.date);
}

// 期間内（from〜to、YYYY-MM-DD）の保存済みの日を返す（カレンダー用）
export async function daysInRange(from, to) {
  await init();
  if (!isValidDate(from) || !isValidDate(to)) throw new Error("from/to の日付が不正です");
  const rs = await db.execute({
    sql: "SELECT data FROM days WHERE date >= ? AND date <= ? ORDER BY date",
    args: [from, to],
  });
  return rs.rows.map((r) => JSON.parse(r.data));
}

// 直近 n 日分のデータ（AIに履歴を渡したいときに便利）
export async function recentDays(n = 7) {
  await init();
  const rs = await db.execute({
    sql: "SELECT data FROM days ORDER BY date DESC LIMIT ?",
    args: [Math.max(1, Number(n) || 7)],
  });
  return rs.rows.map((r) => JSON.parse(r.data));
}
