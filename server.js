// ローカルのウェブサーバー。
// public/ の画面を配信しつつ、/api/* でデータを読み書きする。
// 起動:  npm start   → http://localhost:3939

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./lib/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3939;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// エラーを JSON で返すための小さなラッパー
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// 今日（または ?date=YYYY-MM-DD）の1日分
app.get("/api/day", wrap(async (req, res) => {
  const date = req.query.date || store.today();
  res.json(await store.getDay(date));
}));

// タスク追加
app.post("/api/tasks", wrap(async (req, res) => {
  const { date = store.today(), title, source } = req.body;
  const { day } = await store.addTask(date, title, source);
  res.json(day);
}));

// タスクのチェック切り替え・名前変更
app.patch("/api/tasks/:id", wrap(async (req, res) => {
  const { date = store.today(), done, title } = req.body;
  const { id } = req.params;
  let result;
  if (typeof title === "string") result = (await store.updateTaskTitle(date, id, title)).day;
  if (typeof done === "boolean" || title === undefined) {
    result = (await store.setTaskDone(date, id, done)).day;
  }
  res.json(result ?? (await store.getDay(date)));
}));

// タスク削除
app.delete("/api/tasks/:id", wrap(async (req, res) => {
  const date = req.query.date || store.today();
  res.json(await store.removeTask(date, req.params.id));
}));

// 日記・気分の保存
app.put("/api/diary", wrap(async (req, res) => {
  const { date = store.today(), diary, mood } = req.body;
  res.json(await store.setDiary(date, diary, mood));
}));

// 定番タスクの取得・保存
app.get("/api/templates", wrap(async (_req, res) => {
  res.json(await store.getTemplates());
}));
app.put("/api/templates", wrap(async (req, res) => {
  res.json(await store.saveTemplates(req.body));
}));

// 履歴（日付一覧・直近n日）
app.get("/api/history", wrap(async (req, res) => {
  const n = Number(req.query.days || 14);
  res.json(await store.recentDays(n));
}));

// AIに貼り付ける用のMarkdownをUIから取れるようにしておく
app.get("/api/export", wrap(async (req, res) => {
  const days = await store.recentDays(Number(req.query.days || 7));
  res.type("text/plain").send(toMarkdown(days));
}));

function toMarkdown(days) {
  const lines = ["# My Day 記録", ""];
  for (const d of days) {
    lines.push(`## ${d.date}${d.mood ? `  （気分: ${d.mood}）` : ""}`);
    for (const t of d.tasks) lines.push(`- [${t.done ? "x" : " "}] ${t.title}`);
    if (d.diary) lines.push("", `> ${d.diary.replace(/\n/g, "\n> ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

app.listen(PORT, () => {
  console.log(`My Day → http://localhost:${PORT}`);
});
