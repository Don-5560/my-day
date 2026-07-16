# My Day 🗓️

自分に合った **1日のやることリスト** と、**やったことの記録（日記）** を残せるアプリ。
スマホでもPCでも、サイトを開けばどこでも記録できて、**Claude** からも同じデータを読み書きできます。

- ログインで保護された、あなた専用のサイト
- データは1か所（DB）に集約 → スマホ・PC・Claude が全部同じデータを見る
- ローカルでも、ネット公開でも、同じコードで動く

---

## 仕組み（ざっくり）

```
[スマホのブラウザ] ┐
[PCのブラウザ]    ┼─→ My Day サーバー(Render) ─→ データベース(Turso)
[Claude]          ┘                                      ↑
                                          ローカル開発時は data/my-day.db
```

- `server.js` … ウェブサーバー（画面配信 + `/api/*` + ログイン）
- `lib/store.js` … データの読み書き（唯一の入口）。ローカルはファイル、本番はTurso
- `lib/auth.js` … ログイン（パスワード + 署名クッキー）
- `public/` … 画面（index.html / styles.css / app.js）
- `mcp/server.js` … Claude連携（MCP）サーバー

---

## ローカルで動かす

```bash
cd my-day
npm install
npm start
```

<http://localhost:3939> を開く → パスワードは初期値 **`myday`**（本番では変える）。

ローカルではデータは `data/my-day.db`（SQLiteファイル）に保存されます。

---

## ネットに公開する（スマホでどこでも使う）

### 1. Turso でデータベースを作る（無料）

1. <https://turso.tech> でサインアップ
2. データベースを1つ作成
3. 接続URL（`libsql://...`）と authToken をコピー

### 2. GitHub にリポジトリを作って push

```bash
git remote add origin https://github.com/あなた/my-day.git
git push -u origin main
```

### 3. Render で公開する（無料・カード不要）

1. <https://render.com> でサインアップ → GitHubを連携
2. 「New +」→ Blueprint → このリポジトリを選ぶ（`render.yaml` が読まれる）
3. 環境変数を入力：
   - `APP_PASSWORD` … 好きなログインパスワード
   - `SESSION_SECRET` … ランダムな長い文字列（生成: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`）
   - `DATABASE_URL` … Tursoの `libsql://...`
   - `DATABASE_AUTH_TOKEN` … Tursoのトークン
4. デプロイ完了 → `https://my-day-xxxx.onrender.com` がスマホでもPCでも開ける

以降は `git push` するだけで自動で更新されます。

---

## Claude と連携する

### A. パソコンのClaude（今すぐ・無料）

`data/my-day.db`（または本番Turso）を、パソコンのClaude Desktop / Claude Code から直接操作できます。

Claude Desktop の設定（`~/Library/Application Support/Claude/claude_desktop_config.json`）:

```json
{
  "mcpServers": {
    "my-day": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/あなた/my-day/mcp/server.js"]
    }
  }
}
```

本番Tursoと同じデータを見せたい場合は `env` を足す:

```json
      "args": ["/Users/あなた/my-day/mcp/server.js"],
      "env": {
        "DATABASE_URL": "libsql://...",
        "DATABASE_AUTH_TOKEN": "..."
      }
```

### B. スマホのClaudeからも（リモートMCPコネクター）

公開サーバーには `/mcp/<MCP_TOKEN>` というリモートMCPエンドポイントが内蔵されています。

1. トークンを生成: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
2. Render の Environment に `MCP_TOKEN` として設定 → 再デプロイ
3. [claude.ai/settings/connectors](https://claude.ai/settings/connectors) → 「カスタムコネクターを追加」→ URLに
   `https://<あなたのapp>.onrender.com/mcp/<MCP_TOKEN>` を登録
4. スマホ・PCどちらのClaudeアプリでも、そのコネクターを有効にして会話するだけ

⚠️ このURLを知っている人はあなたのデータを読み書きできます。他人に教えないこと。
漏れた場合は `MCP_TOKEN` を変えれば旧URLは即座に無効になります。

> Render無料プランは15分アクセスがないとスリープします。Claudeから最初の呼び出しが
> タイムアウトしたら、もう一度試すか、先にサイトを開いて起こしてください。

### C. ChatGPT（Plus）からも（カスタムGPT + Actions）

ChatGPTはMCPを安定して扱えないので、同じツール群を **REST API** としても公開しています。
Claudeと同じ `MCP_TOKEN` を流用するので、追加の設定は不要です。

1. ChatGPT（Plus以上）で [chatgpt.com/gpts/editor](https://chatgpt.com/gpts/editor) →「Create」
2. 「Configure」タブ →「Create new action」
3. **Authentication** →「API Key」→ Auth Type「Bearer」→ API Key に `MCP_TOKEN` の値を貼る
4. **Schema** →「Import from URL」に
   `https://<あなたのapp>.onrender.com/gpt/openapi.json` を入れる（13ツールが読み込まれる）
5. 保存してGPTと会話するだけ。「今日のやること教えて」「Todo追加して」などで動く

> スキーマURL(`/gpt/openapi.json`)にトークンは含まれず、認証はBearerヘッダーで行われます。
> URL自体は公開されても中身は読めません（`MCP_TOKEN` を知らないと401）。

### 使えるツール

| ツール | できること |
| --- | --- |
| `get_overview` | ダッシュボード概要（レベル・今週のTodo・売上・案件など）。予定を組む起点 |
| `get_today` / `add_task` / `complete_task` | 今日のやることの取得・追加・完了 |
| `write_diary` | 日報（やったこと・反省・明日の目標・気分） |
| `get_history` | 直近n日の記録（振り返り・分析の材料） |
| `list_todos` / `add_todo` / `complete_todo` | 期限・カテゴリー付きTodoの管理 |
| `log_study` | 勉強時間を記録（XPも入る） |
| `log_sale` | 売上を記録（収入としてお金の台帳にも自動計上） |
| `set_initial_balance` | 初期残高（元手）を設定 |
| `add_transaction` | 収入/支出を1件記録（income/expense） |
| `get_balance` | 現在残高・今月の収入/支出/差引を取得 |
| `list_transactions` | 取引一覧（月・種別で絞込） |
| `get_templates` / `set_templates` | 定番タスクの取得・設定 |

---

## 環境変数

`.env.example` を参照。ローカルでは未設定でOK（自動でファイルDB + パスワード `myday`）。
**本番では `APP_PASSWORD` と `SESSION_SECRET` を必ず設定してください。**
