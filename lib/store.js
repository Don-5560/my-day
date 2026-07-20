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

// 既存テーブルに列を後から足す。SQLiteはADD COLUMN IF NOT EXISTSがないので、
// 「もうある」エラーは無視する形で冪等にする。
async function ensureColumn(table, col, decl) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
  } catch (e) {
    if (!/duplicate column/i.test(e.message)) throw e;
  }
}

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
    // 勤務先に紐づく収入の給料日バッチ入金用（既存DBには後から列を足す）
    await ensureColumn("transactions", "employerId", "TEXT");
    await ensureColumn("transactions", "payoutStatus", "TEXT"); // "pending" | "settled" | null(勤務先/カードと無関係な取引)
    await ensureColumn("transactions", "payoutDate", "TEXT");
    await ensureColumn("transactions", "hours", "REAL"); // 勤務時間（任意・記録用。時給制なら金額の自動計算にも使う）
    // クレジットカードに紐づく支出の引き落とし日バッチ用（payoutStatus/payoutDateは勤務先と共用）
    await ensureColumn("transactions", "creditCardId", "TEXT");
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
  const sp = Math.round(Number(extra.spentMin));
  return {
    id: randomUUID(),
    title: String(title).trim(),
    done: false,
    time: typeof extra.time === "string" ? extra.time : "",       // 開始時刻 "HH:MM"（時間割表示用）
    endTime: typeof extra.endTime === "string" ? extra.endTime : "", // 終了時刻 "HH:MM"（任意）
    cat: typeof extra.cat === "string" ? extra.cat : "",     // 任意カテゴリー（勉強/制作/…）
    tags: Array.isArray(extra.tags) ? extra.tags : [],        // 任意タグ
    memo: typeof extra.memo === "string" ? extra.memo : "",  // やった内容などの自由メモ
    spentMin: Number.isFinite(sp) && sp > 0 ? sp : 0,         // 実績の所要時間（分）: タイマー or 手動入力
    important: extra.important === true,                     // その日の「最重要タスク」フラグ（1日1件だけ）
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
    day.tasks.push(makeTask(t.title, "template", { time: t.time, cat: t.cat }));
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
  if (typeof fields.endTime === "string") task.endTime = fields.endTime;
  if (typeof fields.cat === "string") task.cat = fields.cat;
  if (Array.isArray(fields.tags)) task.tags = fields.tags;
  if (typeof fields.memo === "string") task.memo = fields.memo;
  if (fields.spentMin != null) {
    const m = Math.round(Number(fields.spentMin));
    if (Number.isFinite(m) && m >= 0) task.spentMin = m; // 実績時間の手動セット（加算はaddTaskTime）
  }
  if (typeof fields.important === "boolean") {
    task.important = fields.important;
    if (fields.important) {
      for (const other of day.tasks) if (other.id !== id) other.important = false; // 最重要タスクは1日1件だけ
    }
  }
  await saveDay(day);
  return { day, task };
}

// タスクを別の日へ移動する（編集で日付を変えたとき用）。進捗・IDはそのまま。
export async function moveTask(fromDate, taskId, toDate) {
  if (!isValidDate(toDate)) throw new Error(`日付の形式が不正です: ${toDate}`);
  if (fromDate === toDate) { const day = await getDay(fromDate); return { day, moved: false }; }
  const from = await getDay(fromDate);
  const task = from.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`タスクが見つかりません: ${taskId}`);
  from.tasks = from.tasks.filter((t) => t.id !== taskId);
  const to = await getDay(toDate);
  to.tasks.push(task);
  await saveDay(from);
  await saveDay(to);
  return { day: to, from, moved: true, task };
}

// 1日の予定をまとめて差し替える（AIがスケジュールを組む用）。
// items: [{ title, time?, endTime?, cat?, tags? }]。既存タスクと title 一致で
// 進捗（done / spentMin / id / completedAt）を引き継ぐので、再計画で消えない。
export async function setSchedule(date, items = [], source = "ai") {
  if (!Array.isArray(items)) throw new Error("items は配列で指定してください");
  const day = await getDay(date);
  const prev = day.tasks;
  const used = new Set();
  day.tasks = items.map((it) => {
    const title = String(it?.title || "").trim();
    if (!title) return null;
    const t = makeTask(title, source, { time: it.time, endTime: it.endTime, cat: it.cat, tags: it.tags, memo: it.memo });
    const match = prev.find((p) => p.title === title && !used.has(p.id));
    if (match) {
      used.add(match.id);
      t.id = match.id; t.done = match.done; t.spentMin = match.spentMin;
      t.completedAt = match.completedAt; t.createdAt = match.createdAt;
    }
    return t;
  }).filter(Boolean);
  await saveDay(day);
  return day;
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

const DOC_KEY_RE = /^[a-zA-Z0-9_-]{1,40}$/;

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

// --- 勤務先の給与サイクル（週払い/月払い）から、この労働日の分がいつ入金されるか計算する ---
// 方針: 勤務先に紐づく収入は記録時点では pending（未収）にし、給料日を過ぎたら自動で settled にする。

function clampDay(year, month0, day) {
  const last = new Date(year, month0 + 1, 0).getDate();
  return Math.min(Math.max(1, day), last);
}
function fmtDateYMD(y, m0, d) {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
// 週払い: 労働日と同じ日か、それより後の直近の weeklyPayDay（例: "fri"）
function nextWeeklyPayDate(workDate, weeklyPayDay) {
  const idx = WEEKDAYS.indexOf(weeklyPayDay);
  if (idx < 0) return workDate;
  const d = new Date(workDate + "T00:00:00");
  const diff = (idx - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return fmtDateYMD(d.getFullYear(), d.getMonth(), d.getDate());
}
// 月払い:「closingDay締め・翌月paymentDay払い」を想定（closingDay=31は月末扱い）
function monthlyPayDate(workDate, closingDay, paymentDay) {
  const d = new Date(workDate + "T00:00:00");
  let y = d.getFullYear(), m = d.getMonth(); // m は0始まり
  const cDay = clampDay(y, m, closingDay);
  if (d.getDate() > cDay) { m += 1; if (m > 11) { m = 0; y += 1; } }
  let py = y, pm = m + 1;
  if (pm > 11) { pm = 0; py += 1; }
  return fmtDateYMD(py, pm, clampDay(py, pm, paymentDay));
}
function computePayoutDate(employer, workDate) {
  if (employer.payCycle === "weekly") return nextWeeklyPayDate(workDate, employer.weeklyPayDay);
  if (employer.payCycle === "monthly") return monthlyPayDate(workDate, employer.closingDay || 31, employer.paymentDay || 25);
  return workDate;
}
// クレジットカードは締め日・引き落とし日の月次サイクルのみ（勤務先のmonthlyと同じ計算）
function computeChargeDate(card, purchaseDate) {
  return monthlyPayDate(purchaseDate, card.closingDay || 31, card.paymentDay || 27);
}
// 給料日/引き落とし日を過ぎた pending 取引を settled にする（自動確定）。
// 収入はこのタイミングで初めて売上明細(doc:sales)にもミラーする（支出はミラーしない）。
async function autoSettlePending() {
  await init();
  const due = await db.execute({
    sql: "SELECT id, date, type, category, amount, memo FROM transactions WHERE payoutStatus = 'pending' AND payoutDate <= ?",
    args: [today()],
  });
  if (!due.rows.length) return;
  await db.execute({
    sql: "UPDATE transactions SET payoutStatus = 'settled' WHERE payoutStatus = 'pending' AND payoutDate <= ?",
    args: [today()],
  });
  const sdoc = (await getDoc("sales")) ?? { logs: [] };
  let changed = false;
  for (const r of due.rows) {
    if (r.type !== "income") continue;
    if (sdoc.logs.some((l) => l.txId === r.id)) continue;
    sdoc.logs.push({ id: randomUUID(), date: r.date, amount: Number(r.amount), source: r.category, memo: r.memo, txId: r.id });
    changed = true;
  }
  if (changed) await saveDoc("sales", sdoc);
}
// 既存の（勤務先に紐づく前に記録された）収入取引に、あとから employerId・支払い日を遡って補完する。
// カテゴリー→勤務先の対応は「カテゴリーに直接employerIdがある」か「勤務先側のlinkedCategoryがカテゴリー名と一致」のどちらか。
// クレジットカードは取引ごとに都度選ぶ方式（カテゴリー単位の自動紐づけはしない）なので、ここでは扱わない。
// 補完した支払い日が「すでに過ぎている（今日以前）」場合はpayoutStatusを変更しない
// （null=すでに残高に反映済み、として扱い、遡って未収化しない）。
// 一方、補完した支払い日が「まだ先（未来）」の場合はpendingにする
// （そうしないと、まだ確定していないお金がリンクした瞬間から即・残高に反映されてしまい、
// かつautoSettlePendingの対象(payoutStatus='pending')にも入らないため、永久に未確定のまま残高に
// 数え続けられてしまう）。
async function backfillLinkedTx() {
  await init();
  const t = today();
  const rs = await db.execute(
    "SELECT id, date, category FROM transactions WHERE type = 'income' AND employerId IS NULL"
  );
  if (rs.rows.length) {
    const edoc = (await getDoc("employers")) ?? { items: [] };
    const cdoc = (await getDoc("categories")) ?? {};
    const findEmployer = (catName) => {
      const cat = (cdoc.income || []).find((c) => (typeof c === "string" ? c : c?.name) === catName);
      if (cat && typeof cat === "object" && cat.employerId) {
        const e = edoc.items.find((x) => x.id === cat.employerId);
        if (e) return e;
      }
      return edoc.items.find((e) => e.linkedCategory === catName) || null;
    };
    for (const row of rs.rows) {
      const emp = findEmployer(row.category);
      if (!emp) continue;
      const payoutDate = computePayoutDate(emp, row.date);
      const payoutStatus = payoutDate > t ? "pending" : null;
      await db.execute({ sql: "UPDATE transactions SET employerId = ?, payoutDate = ?, payoutStatus = ? WHERE id = ?", args: [emp.id, payoutDate, payoutStatus, row.id] });
    }
  }
  // 補修: 過去のバグ（後から紐づけたときにpayoutStatusを変更しなかった版）で、支払い日が未来なのに
  // pending化され損ねたまま残ってしまった行を直す（該当がなければ何もしない。安全に毎回実行できる）
  await db.execute({
    sql: "UPDATE transactions SET payoutStatus = 'pending' WHERE payoutStatus IS NULL AND payoutDate IS NOT NULL AND payoutDate > ? AND (employerId IS NOT NULL OR creditCardId IS NOT NULL)",
    args: [t],
  });
}
// 勤務先ごとの未収（pending）合計と直近の入金日
export async function employerPendingSummary() {
  await autoSettlePending();
  await init();
  const rs = await db.execute(
    "SELECT employerId, payoutDate, amount FROM transactions WHERE type = 'income' AND payoutStatus = 'pending' AND employerId IS NOT NULL"
  );
  const map = {};
  for (const r of rs.rows) {
    const e = (map[r.employerId] ||= { employerId: r.employerId, total: 0, nextPayoutDate: null });
    e.total += Number(r.amount);
    if (!e.nextPayoutDate || r.payoutDate < e.nextPayoutDate) e.nextPayoutDate = r.payoutDate;
  }
  return Object.values(map);
}
// クレジットカードごとの未確定（引き落とし予定）合計と直近の引き落とし日
export async function creditCardPendingSummary() {
  await autoSettlePending();
  await init();
  const rs = await db.execute(
    "SELECT creditCardId, payoutDate, amount FROM transactions WHERE type = 'expense' AND payoutStatus = 'pending' AND creditCardId IS NOT NULL"
  );
  const map = {};
  for (const r of rs.rows) {
    const c = (map[r.creditCardId] ||= { creditCardId: r.creditCardId, total: 0, nextChargeDate: null });
    c.total += Number(r.amount);
    if (!c.nextChargeDate || r.payoutDate < c.nextChargeDate) c.nextChargeDate = r.payoutDate;
  }
  return Object.values(map);
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
// employerId（収入）を渡すとその勤務先の給与サイクルに従って、creditCardId（支出）を渡すとそのカードの
// 締め日・引き落とし日サイクルに従って、それぞれ payoutStatus="pending" にし、給料日/引き落とし日(payoutDate)
// を過ぎるまで残高・売上明細に反映しない（autoSettlePendingが確定させる）。
export async function addTransaction({ type, amount, category, date, memo, source, employerId, hours, creditCardId } = {}) {
  if (!TX_TYPES.includes(type)) throw new Error('type は "income" か "expense" で指定してください');
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("金額は1以上の整数(円)で指定してください");
  }
  const d = date || today();
  if (!isValidDate(d)) throw new Error(`日付の形式が不正です: ${d}`);
  let payoutStatus = null, payoutDate = null;
  if (type === "income" && employerId) {
    const edoc = (await getDoc("employers")) ?? { items: [] };
    const employer = edoc.items.find((e) => e.id === employerId);
    if (employer) { payoutStatus = "pending"; payoutDate = computePayoutDate(employer, d); }
  }
  if (type === "expense" && creditCardId) {
    const ccdoc = (await getDoc("creditCards")) ?? { items: [] };
    const card = ccdoc.items.find((c) => c.id === creditCardId);
    if (card) { payoutStatus = "pending"; payoutDate = computeChargeDate(card, d); }
  }
  const row = {
    id: randomUUID(),
    date: d,
    type,
    category: (category && String(category).trim()) || "その他",
    amount,
    memo: memo ? String(memo) : "",
    source: source ? String(source) : "manual",
    createdAt: new Date().toISOString(),
    employerId: employerId || null,
    payoutStatus,
    payoutDate,
    hours: (hours != null && Number.isFinite(Number(hours)) && Number(hours) > 0) ? Number(hours) : null,
    creditCardId: creditCardId || null,
  };
  await init();
  await db.execute({
    sql: `INSERT INTO transactions (id, date, type, category, amount, memo, source, createdAt, employerId, payoutStatus, payoutDate, hours, creditCardId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [row.id, row.date, row.type, row.category, row.amount, row.memo, row.source, row.createdAt, row.employerId, row.payoutStatus, row.payoutDate, row.hours, row.creditCardId],
  });
  // 収入は「売上明細(doc:sales)」にもミラーする（txIdで紐づけ）。ただしpending（未収）の間はミラーしない
  // →settledになったタイミングでautoSettlePendingがミラーする。フロントの売上画面・ホームの今月売上に反映される。
  if (row.type === "income" && payoutStatus !== "pending") {
    const sdoc = (await getDoc("sales")) ?? { logs: [] };
    sdoc.logs.push({ id: randomUUID(), date: row.date, amount: row.amount, source: row.category, memo: row.memo, txId: row.id });
    await saveDoc("sales", sdoc);
  }
  return row;
}

// 取引一覧（月 YYYY-MM / 種別 で絞り込み）
export async function listTransactions({ month, type } = {}) {
  await ensureMigrated();
  await backfillLinkedTx();
  await autoSettlePending();
  const where = [];
  const args = [];
  // 月の絞り込みは「表示上の日付」（勤務先/カードに紐づく取引は支払い日、それ以外は取引日）を基準にする。
  // カレンダー/一覧の表示基準（txDisplayDate）とサーバー側の月フィルタを一致させないと、
  // 月をまたぐ支払い日の取引がどちらの月を見ても出てこなくなってしまう。
  if (month) { where.push("substr(COALESCE(payoutDate, date), 1, 7) = ?"); args.push(month); }
  if (type) {
    if (!TX_TYPES.includes(type)) throw new Error('type は "income" か "expense" で指定してください');
    where.push("type = ?"); args.push(type);
  }
  const rs = await db.execute({
    sql: "SELECT id, date, type, category, amount, memo, source, employerId, payoutStatus, payoutDate, hours, creditCardId FROM transactions" +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY date DESC, createdAt DESC",
    args,
  });
  return rs.rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

// 収入・支出の合計。month省略で全期間。pending（未収の収入/引き落とし待ちの支出）は残高・集計に含めない。
async function sumTx(month) {
  await init();
  await autoSettlePending();
  const rs = await db.execute({
    sql: `SELECT type, COALESCE(SUM(amount), 0) AS total FROM transactions
      WHERE (payoutStatus IS NULL OR payoutStatus != 'pending')
      ${month ? "AND substr(COALESCE(payoutDate, date), 1, 7) = ?" : ""}
      GROUP BY type`,
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

// 売上を記録: 収入(売上)＋任意の経費(支出)を台帳に入れ、売上明細に利益計算用の cost を持たせる。
// income は addTransaction 内で doc:sales にミラーされるので、その明細に cost/costTxId を後付けする。
export async function recordSale({ amount, cost = 0, source, date, memo, employerId, hours } = {}) {
  const amt = Math.round(Number(amount));
  const cst = Math.round(Number(cost) || 0);
  if (!Number.isInteger(amt) || amt <= 0) throw new Error("売上金額は1以上の整数(円)で指定してください");
  if (cst < 0) throw new Error("経費は0以上の整数(円)で指定してください");
  const d = date || today();
  const inc = await addTransaction({ type: "income", amount: amt, category: source || "その他", date: d, memo, source: "sale", employerId, hours });
  let expTx = null;
  if (cst > 0) {
    expTx = await addTransaction({ type: "expense", amount: cst, category: "事業経費", date: d, memo: `売上の経費${memo ? "：" + memo : ""}`, source: "sale-cost" });
  }
  const sdoc = (await getDoc("sales")) ?? { logs: [] };
  const log = sdoc.logs.find((l) => l.txId === inc.id);
  if (log) {
    log.cost = cst;
    if (expTx) log.costTxId = expTx.id;
    await saveDoc("sales", sdoc);
  }
  return { income: inc, expense: expTx };
}

// 取引を1件編集（date/category/amount/memo）。収入の場合は売上明細(doc:sales)のミラーも一緒に更新する。
export async function updateTransaction(id, { date, category, amount, memo } = {}) {
  await init();
  const rs = await db.execute({ sql: "SELECT * FROM transactions WHERE id = ?", args: [id] });
  if (!rs.rows.length) throw new Error(`取引が見つかりません: ${id}`);
  const row = rs.rows[0];
  const d = date || row.date;
  if (!isValidDate(d)) throw new Error(`日付の形式が不正です: ${d}`);
  const amt = amount != null ? Math.round(Number(amount)) : Number(row.amount);
  if (!Number.isInteger(amt) || amt <= 0) throw new Error("金額は1以上の整数(円)で指定してください");
  const cat = (category && String(category).trim()) || row.category;
  const memoVal = memo != null ? String(memo) : row.memo;
  await db.execute({
    sql: "UPDATE transactions SET date = ?, category = ?, amount = ?, memo = ? WHERE id = ?",
    args: [d, cat, amt, memoVal, id],
  });
  if (row.type === "income") {
    const sdoc = await getDoc("sales");
    const log = sdoc?.logs?.find((l) => l.txId === id);
    if (log) {
      log.date = d; log.amount = amt; log.source = cat; log.memo = memoVal;
      await saveDoc("sales", sdoc);
    }
  }
  return { id, date: d, category: cat, amount: amt, memo: memoVal };
}

// 取引を1件削除（残高は次回集計で自動的に再計算される）
export async function removeTransaction(id) {
  await init();
  // 売上に紐づく経費(支出)があれば、その txId を先に拾って一緒に消す
  const sdoc = await getDoc("sales");
  let costTxId = null;
  if (sdoc && Array.isArray(sdoc.logs)) {
    const log = sdoc.logs.find((l) => l.txId === id);
    if (log && log.costTxId) costTxId = log.costTxId;
  }
  const rs = await db.execute({ sql: "DELETE FROM transactions WHERE id = ?", args: [id] });
  if (!rs.rowsAffected) throw new Error(`取引が見つかりません: ${id}`);
  if (costTxId) await db.execute({ sql: "DELETE FROM transactions WHERE id = ?", args: [costTxId] });
  // 売上明細にミラーしていた分も消す
  if (sdoc && Array.isArray(sdoc.logs)) {
    const before = sdoc.logs.length;
    sdoc.logs = sdoc.logs.filter((l) => l.txId !== id);
    if (sdoc.logs.length !== before) await saveDoc("sales", sdoc);
  }
  return { removed: id, removedCost: costTxId };
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
    if (s.txId) continue; // 既に transactions とひも付く（ミラー済み）ログは取り込まない＝二重計上防止
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

// 連動機能より前に登録済みの収入トランザクションを doc:sales にミラーする（冪等）。
// txId で紐づくため二重登録されない。source が 'sale'/'migrated-sale' のものは
// 旧・二重書き／移行で既に doc:sales に対応ログがあるので対象外にする。
export async function backfillIncomeToSales() {
  await init();
  const sdoc = (await getDoc("sales")) ?? { logs: [] };
  const knownTxIds = new Set((sdoc.logs || []).filter((l) => l.txId).map((l) => l.txId));
  const rs = await db.execute({
    sql: `SELECT id, date, category, amount, memo FROM transactions
          WHERE type = 'income' AND source NOT IN ('sale', 'migrated-sale')
          ORDER BY date, createdAt`,
    args: [],
  });
  let n = 0;
  for (const r of rs.rows) {
    if (knownTxIds.has(r.id)) continue;
    sdoc.logs.push({
      id: randomUUID(), date: r.date, amount: Number(r.amount),
      source: r.category, memo: r.memo || "", txId: r.id,
    });
    n++;
  }
  if (n) await saveDoc("sales", sdoc);
  return { backfilled: n };
}

// 残高を読む前に一度だけ移行＋バックフィルを走らせる（プロセス内でメモ化）
let financeMigration = null;
export function ensureMigrated() {
  if (!financeMigration) {
    financeMigration = (async () => {
      await migrateSalesToTransactions();
      await backfillIncomeToSales();
    })();
  }
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
