// データの読み書きを一手に引き受ける「唯一の真実」。
// ウェブサーバー(server.js)とMCPサーバー(mcp/server.js)の両方がここを通す。
// 日ごとに data/YYYY-MM-DD.json、定番タスクは data/templates.json に保存する。

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "..", "data");
const TEMPLATES_FILE = path.join(DATA_DIR, "templates.json");

// 曜日キー（templates.json の days で使う）
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(file, data) {
  await ensureDataDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
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

function dayFile(date) {
  if (!isValidDate(date)) throw new Error(`日付の形式が不正です: ${date}`);
  return path.join(DATA_DIR, `${date}.json`);
}

// --- テンプレート（定番・繰り返しタスク） ---

export async function getTemplates() {
  return readJson(TEMPLATES_FILE, { recurring: [] });
}

export async function saveTemplates(templates) {
  await writeJson(TEMPLATES_FILE, templates);
  return templates;
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

// その日のデータを取得。無ければ定番タスクを入れて作り、その場で保存する。
// ここで保存しておかないと、呼ぶたびに定番タスクのIDが変わってしまい、
// 画面が持っているIDと一致しなくなる（チェックや削除が「見つかりません」になる）。
export async function getDay(date = today()) {
  const existing = await readJson(dayFile(date), null);
  if (existing) return existing;

  const templates = await getTemplates();
  const day = emptyDay(date);
  for (const t of templatesForDate(templates, date)) {
    day.tasks.push(makeTask(t.title, "template"));
  }
  await saveDay(day); // IDを固定するため、初回に materialize したら保存する
  return day;
}

export async function saveDay(day) {
  if (!day || !isValidDate(day.date)) throw new Error("保存するデータの date が不正です");
  await writeJson(dayFile(day.date), day);
  return day;
}

function makeTask(title, source = "manual") {
  return {
    id: randomUUID(),
    title: String(title).trim(),
    done: false,
    source, // "template" | "manual" | "ai"
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

// --- タスク操作（読み込み→変更→保存 をまとめる） ---

export async function addTask(date, title, source = "manual") {
  if (!title || !String(title).trim()) throw new Error("タスク名が空です");
  const day = await getDay(date);
  const task = makeTask(title, source);
  day.tasks.push(task);
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

export async function setDiary(date, diary, mood) {
  const day = await getDay(date);
  if (typeof diary === "string") day.diary = diary;
  if (typeof mood === "string") day.mood = mood;
  await saveDay(day);
  return day;
}

// --- 履歴（日記の一覧・振り返り用） ---

// 保存済みの日付を新しい順で返す
export async function listDates() {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  return files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
}

// 直近 n 日分のデータ（AIに履歴を渡したいときに便利）
export async function recentDays(n = 7) {
  const dates = (await listDates()).slice(0, n);
  const days = [];
  for (const date of dates) {
    days.push(await readJson(dayFile(date), emptyDay(date)));
  }
  return days;
}
