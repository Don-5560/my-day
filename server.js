// ローカル/本番の両方で動くウェブサーバー。
// public/ の画面を配信しつつ、/api/* でデータを読み書きする。ログインで保護。
// 起動:  npm start   → http://localhost:3939

import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as store from "./lib/store.js";
import { makeToken, verifyToken, checkPassword, warnIfInsecure } from "./lib/auth.js";
import { TOOLS, callTool } from "./mcp/tools.js";

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
  // maxAgeを付けない＝セッションクッキー。ブラウザを閉じると消える（＝開き直したら再ログイン）。
  // さらにトークン自体に発行時刻が入っていて、サーバー側で MAX_AGE_MS(1日) を過ぎたら無効化する。
  // 結果、「ブラウザを閉じたとき」または「1日経過」の早い方で再ログインが必要になる。
  res.cookie("sid", makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: PROD, // 本番(HTTPS)ではsecure。ローカルはhttpなのでfalse
  });
  res.json({ ok: true });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie("sid");
  res.json({ ok: true });
});

// --- リモートMCP（スマホ/PCのClaudeがコネクターとして接続する） ---
// URL自体に秘密トークンを含める方式: https://<app>/mcp/<MCP_TOKEN>
// クッキー認証の前に置く（Claudeはブラウザではないのでクッキーを持てない）。

const MCP_TOKEN = process.env.MCP_TOKEN || (PROD ? null : "dev");

function mcpTokenOk(given) {
  if (!MCP_TOKEN || typeof given !== "string") return false;
  const a = Buffer.from(given), b = Buffer.from(MCP_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post("/mcp/:token", async (req, res) => {
  if (!MCP_TOKEN) return res.status(503).json({ error: "MCP_TOKEN が未設定です" });
  if (!mcpTokenOk(req.params.token)) return res.status(401).json({ error: "無効なトークン" });
  try {
    // ステートレス運用: リクエストごとにサーバー/トランスポートを作って閉じる
    const mcp = new McpServer({ name: "lifeos", version: "0.2.0" }, { capabilities: { tools: {} } });
    mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    mcp.setRequestHandler(CallToolRequestSchema, async (r) => {
      try {
        const result = await callTool(r.params.name, r.params.arguments || {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `エラー: ${err.message}` }] };
      }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); mcp.close(); });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ステートレスなので GET(SSE購読)/DELETE は未対応でよい
app.get("/mcp/:token", (_req, res) => res.status(405).json({ error: "POSTのみ対応" }));
app.delete("/mcp/:token", (_req, res) => res.status(405).json({ error: "POSTのみ対応" }));

// --- ChatGPT用 REST API（カスタムGPTのActions） ---
// ChatGPTはMCPを安定して扱えないので、Claudeと同じツール群をRESTとして公開する。
// 認証は Authorization: Bearer <MCP_TOKEN>（Claude用と同じトークンを流用。新しい秘密は不要）。
// これらはクッキー認証ミドルウェアの前に置く（ChatGPTはブラウザではなくクッキーを持てない）。

function gptAuthOk(req) {
  const m = (req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? mcpTokenOk(m[1]) : false;
}

// OpenAPI 3.1 スキーマを TOOLS から自動生成（GPTビルダーに読み込ませる）。
function buildOpenApi(baseUrl) {
  const paths = {};
  for (const t of TOOLS) {
    paths[`/gpt/${t.name}`] = {
      post: {
        operationId: t.name,
        summary: t.description,
        requestBody: {
          required: (t.inputSchema.required?.length ?? 0) > 0,
          content: { "application/json": { schema: t.inputSchema } },
        },
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "LifeOS",
      description: "LifeOS（1日のやること・日報・Todo・勉強時間・売上・目標）を読み書きする。",
      version: "0.2.0",
    },
    servers: [{ url: baseUrl }],
    paths,
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    security: [{ bearerAuth: [] }],
  };
}

// 本番(Render)はプロキシ越しなので https を固定。ローカルはそのまま。
const baseUrlOf = (req) => `${PROD ? "https" : req.protocol}://${req.get("host")}`;

// スキーマ本体は秘密ではない（トークンは含めない）ので認証不要で配る。GPTビルダーが取得する。
app.get("/gpt/openapi.json", (req, res) => res.json(buildOpenApi(baseUrlOf(req))));

// 各ツールを1エンドポイントとして公開。POST /gpt/<tool> にJSON引数を渡す。
app.post("/gpt/:tool", async (req, res) => {
  if (!MCP_TOKEN) return res.status(503).json({ error: "MCP_TOKEN が未設定です" });
  if (!gptAuthOk(req)) return res.status(401).json({ error: "無効なトークン" });
  if (!TOOLS.some((t) => t.name === req.params.tool)) {
    return res.status(404).json({ error: "未知のツール" });
  }
  try {
    res.json(await callTool(req.params.tool, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- ここから下はログイン必須 ---

app.use((req, res, next) => {
  if (verifyToken(req.cookies?.sid)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "ログインが必要です" });
  // OAuth関連のディスカバリはログインへ302せず404を返す。
  // これがないとリモートMCPコネクターが「OAuth対応サーバー」と誤認して登録に失敗する。
  // 404を返すことで「認証不要（URLトークン方式）のMCPサーバー」として扱われる。
  if (req.path.startsWith("/.well-known/") || req.path === "/register") {
    return res.status(404).json({ error: "not found" });
  }
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
  const { date = store.today(), title, source, time, cat, tags } = req.body;
  const { day } = await store.addTask(date, title, source, { time, cat, tags });
  res.json(day);
}));

// タスクの更新: 完了トグル(done) / 項目編集(title,cat,tags,time) / 所要時間加算(addMin)
app.patch("/api/tasks/:id", wrap(async (req, res) => {
  const { date = store.today(), done, title, cat, tags, time, addMin } = req.body;
  const { id } = req.params;
  let day;
  if (typeof addMin === "number") day = (await store.addTaskTime(date, id, addMin)).day;
  else if (typeof done === "boolean") day = (await store.setTaskDone(date, id, done)).day;
  else day = (await store.updateTask(date, id, { title, cat, tags, time })).day;
  res.json(day);
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

// 期間内の日（カレンダー用）
app.get("/api/days", wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) throw new Error("from と to が必要です");
  res.json(await store.daysInRange(from, to));
}));

// 汎用データ（モジュールごとのJSON文書: todos / study / sales / xp など）
app.get("/api/data/:key", wrap(async (req, res) => {
  res.json(await store.getDoc(req.params.key));
}));
app.put("/api/data/:key", wrap(async (req, res) => {
  res.json(await store.saveDoc(req.params.key, req.body));
}));

// お金の管理（残高・収入・支出）。取引はSQLテーブルなので専用エンドポイントで扱う。
app.get("/api/finance", wrap(async (req, res) => {
  res.json(await store.financeSummary(req.query.month || undefined));
}));
app.put("/api/finance/initial", wrap(async (req, res) => {
  res.json(await store.setInitialBalance(Number(req.body?.amount)));
}));
app.get("/api/transactions", wrap(async (req, res) => {
  res.json(await store.listTransactions({ month: req.query.month, type: req.query.type }));
}));
app.post("/api/transactions", wrap(async (req, res) => {
  res.json(await store.addTransaction(req.body));
}));
app.delete("/api/transactions/:id", wrap(async (req, res) => {
  res.json(await store.removeTransaction(req.params.id));
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
