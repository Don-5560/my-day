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

app.use(express.json({ limit: "1mb" }));
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

// 日報（本文・気分・反省・明日の目標）の保存
app.put("/api/diary", wrap(async (req, res) => {
  const { date = store.today(), ...fields } = req.body;
  res.json(await store.setDiary(date, fields));
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

// 汎用データ（モジュールごとのJSON文書: todos / study / sales / xp など）
app.get("/api/data/:key", wrap(async (req, res) => {
  res.json(await store.getDoc(req.params.key));
}));
app.put("/api/data/:key", wrap(async (req, res) => {
  res.json(await store.saveDoc(req.params.key, req.body));
}));

// AIに貼り付ける用のMarkdown
app.get("/api/export", wrap(async (req, res) => {
  const days = await store.recentDays(Number(req.query.days || 7));
  res.type("text/plain").send(toMarkdown(days));
}));

function toMarkdown(days) {
  const lines = ["# LifeOS 記録", ""];
  for (const d of days) {
    lines.push(`## ${d.date}${d.mood ? `  （気分: ${d.mood}）` : ""}`);
    for (const t of d.tasks) lines.push(`- [${t.done ? "x" : " "}] ${t.title}`);
    if (d.diary) lines.push("", `> ${d.diary.replace(/\n/g, "\n> ")}`);
    if (d.reflect) lines.push("", `反省: ${d.reflect}`);
    if (d.tomorrow) lines.push(`明日: ${d.tomorrow}`);
    lines.push("");
  }
  return lines.join("\n");
}

const LOGIN_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>LifeOS — ログイン</title>
<meta name="theme-color" content="#05060A">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;color:#F5F7FA;
    font-family:Inter,-apple-system,BlinkMacSystemFont,"Hiragino Sans",system-ui,sans-serif;
    background:
      radial-gradient(600px 400px at 15% -10%, rgba(59,130,246,.20), transparent 60%),
      radial-gradient(500px 400px at 110% 15%, rgba(139,92,246,.12), transparent 60%),
      #05060A}
  .box{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);
    backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);
    border-radius:16px;padding:32px;width:min(90vw,360px);box-shadow:0 10px 40px rgba(0,0,0,.4)}
  .logo{display:flex;align-items:center;gap:10px;margin-bottom:6px}
  .logo-badge{width:34px;height:34px;border-radius:10px;background:rgba(59,130,246,.18);
    display:grid;place-items:center;color:#3B82F6}
  h1{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}
  p{margin:0 0 20px;color:#8A94A6;font-size:13px}
  .field{position:relative;margin-bottom:12px}
  input{width:100%;padding:12px 46px 12px 14px;border:1px solid rgba(255,255,255,.1);border-radius:12px;
    background:rgba(0,0,0,.35);color:#fff;font-size:16px;outline:none;font-family:inherit;
    transition:border-color .2s}
  input:focus{border-color:#3B82F6}
  .eye{position:absolute;top:0;right:0;height:100%;width:46px;background:none;border:none;color:#8A94A6;
    cursor:pointer;display:grid;place-items:center;padding:0}
  .eye:hover{color:#F5F7FA}
  button.submit{width:100%;padding:12px;border:none;border-radius:12px;background:#3B82F6;color:#fff;
    font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .2s,transform .1s}
  button.submit:hover{filter:brightness(1.1)}
  button.submit:active{transform:translateY(1px)}
  .err{color:#F87171;font-size:13px;min-height:18px;margin-top:8px}
</style></head><body>
  <form class="box" id="f">
    <div class="logo">
      <span class="logo-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
      <h1>LifeOS</h1>
    </div>
    <p>人生をゲーム化する。パスワードを入れてください。</p>
    <div class="field">
      <input type="password" id="pw" placeholder="パスワード" autocomplete="current-password" autofocus>
      <button type="button" class="eye" id="eye" aria-label="パスワードを表示">
        <svg id="eyeOn" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <svg id="eyeOff" style="display:none" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      </button>
    </div>
    <button type="submit" class="submit">ログイン</button>
    <div class="err" id="e"></div>
  </form>
  <script>
    const pw = document.getElementById("pw");
    document.getElementById("eye").addEventListener("click", () => {
      const show = pw.type === "password";
      pw.type = show ? "text" : "password";
      document.getElementById("eyeOn").style.display = show ? "none" : "";
      document.getElementById("eyeOff").style.display = show ? "" : "none";
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
  console.log(`LifeOS → http://localhost:${PORT}`);
});
