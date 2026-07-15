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

### B. スマホのClaudeからも（Phase 2・準備中）

公開したサイトに「リモートMCP」を追加し、Claude(Pro)の**コネクター**として登録する予定。
これでスマホのClaudeからもタスク・日記を読み書きできるようになります。

### 使えるツール

| ツール | できること |
| --- | --- |
| `get_today` | 今日のタスク・日記を取得 |
| `add_task` | タスクを追加 |
| `complete_task` | タスクを完了/未完了 |
| `write_diary` | 日記・気分を書き込む |
| `get_history` | 直近n日の記録を取得（振り返り・提案の材料） |
| `get_templates` / `set_templates` | 定番タスクの取得・設定 |

---

## 環境変数

`.env.example` を参照。ローカルでは未設定でOK（自動でファイルDB + パスワード `myday`）。
**本番では `APP_PASSWORD` と `SESSION_SECRET` を必ず設定してください。**
