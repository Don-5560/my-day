// ローカル/本番の両方で動くウェブサーバー。
// public/ の画面を配信しつつ、/api/* でデータを読み書きする。ログインで保護。
// 起動:  npm start   → http://localhost:3939

import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./lib/store.js";
import { makeToken, verifyToken, checkPassword, MAX_AGE_MS, warnIfInsecure } from "./lib/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3939;
const PROD = process.env.NODE_ENV === "production";

app.use(express.json());
app.use(cookieParser());

// エラーを JSON で返すための小さなラッパー
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// --- ログイン（ここだけ未ログインでも触れる） ---

app.get("/login", (_req, res) => res.type("html").send(LOGIN_HTML));

app.post("/api/login", (req, res) => {
  if (!checkPassword(req.body?.password)) {
    return res.status(401).json({ error: "パスワードが違います" });
  }
  res.cookie("sid", makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: PROD, // 本番(HTTPS)ではsecure。ローカルはhttpなのでfalse
    maxAge: MAX_AGE_MS,
  });
  res.json({ ok: true });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie("sid");
  res.json({ ok: true });
});

// --- ここから下はログイン必須 ---

app.use((req, res, next) => {
  if (verifyToken(req.cookies?.sid)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "ログインが必要です" });
  return res.redirect("/login");
});

app.use(express.static(path.join(__dirname, "public")));

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

// 履歴（直近n日）
app.get("/api/history", wrap(async (req, res) => {
  res.json(await store.recentDays(Number(req.query.days || 14)));
}));

// AIに貼り付ける用のMarkdown
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

const LOGIN_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>My Day — ログイン</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#e8eaed;
    font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Segoe UI",system-ui,sans-serif}
  .box{background:#181b21;border:1px solid #262a31;border-radius:16px;padding:28px;width:min(90vw,340px);
    box-shadow:0 10px 30px rgba(0,0,0,.35)}
  h1{margin:0 0 4px;font-size:20px}
  p{margin:0 0 18px;color:#9aa2af;font-size:13px}
  .field{position:relative;margin-bottom:12px}
  input{width:100%;padding:11px 44px 11px 12px;border:1px solid #262a31;border-radius:10px;background:#0f1115;
    color:#fff;font-size:16px;outline:none}
  input:focus{border-color:#8b8cf7}
  .eye{position:absolute;top:0;right:0;height:100%;width:44px;background:none;border:none;color:#9aa2af;
    cursor:pointer;font-size:18px;display:grid;place-items:center;padding:0}
  .eye:hover{color:#e8eaed}
  button.submit{width:100%;padding:11px;border:none;border-radius:10px;background:#6366f1;color:#fff;
    font-size:15px;font-weight:600;cursor:pointer}
  .err{color:#f87171;font-size:13px;min-height:18px;margin-top:6px}
</style></head><body>
  <form class="box" id="f">
    <h1>My Day 🗓️</h1>
    <p>あなた専用。パスワードを入れてください。</p>
    <div class="field">
      <input type="password" id="pw" placeholder="パスワード" autocomplete="current-password" autofocus>
      <button type="button" class="eye" id="eye" aria-label="パスワードを表示">👁️</button>
    </div>
    <button type="submit" class="submit">ログイン</button>
    <div class="err" id="e"></div>
  </form>
  <script>
    const pw = document.getElementById("pw");
    document.getElementById("eye").addEventListener("click", () => {
      const show = pw.type === "password";
      pw.type = show ? "text" : "password";
      document.getElementById("eye").textContent = show ? "🙈" : "👁️";
      pw.focus();
    });
    document.getElementById("f").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const r = await fetch("/api/login", {method:"POST",headers:{"Content-Type":"application/json"},
        body: JSON.stringify({password: pw.value})});
      if (r.ok) location.href = "/";
      else document.getElementById("e").textContent = "パスワードが違います";
    });
  </script>
</body></html>`;

warnIfInsecure();
app.listen(PORT, () => {
  console.log(`My Day → http://localhost:${PORT}`);
});
