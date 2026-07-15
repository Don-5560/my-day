# My Day 🗓️

自分に合った **1日のやることリスト** と、**やったことの記録（日記）** を残せるアプリ。
データは `data/` フォルダのJSONに保存され、**Claude（MCP連携）** から直接読み書きできます。

- ブラウザで「今日のやること」にチェック / 日記を書く
- Claudeに「今日のタスク教えて」「今日のふりかえりを日記に書いて」→ 同じデータを操作
- 全部GitHubでバックアップ & バージョン管理

---

## セットアップ

```bash
cd my-day
npm install
```

## 使い方（ウェブUI）

```bash
npm start
```

ブラウザで <http://localhost:3939> を開く。

- **やること**: 追加・チェック・名前編集・削除。定番タスクは自動で並ぶ
- **やったこと・ふりかえり**: 気分を選んで日記を書く（自動保存）
- **定番タスク**: 毎日/曜日ごとに自動で出るタスクを設定
- **AI用にコピー**: 直近7日ぶんをMarkdownでコピー → ChatGPT等に貼って相談

---

## Claude（MCP）と連携する

MCPサーバーを使うと、Claude Code / Claude Desktop があなたのタスク・日記を直接操作できます。

### Claude Desktop の場合

設定ファイルに以下を追記します（`パス` は自分の環境に合わせて置き換え）。

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-day": {
      "command": "node",
      "args": ["/Users/あなた/my-day/mcp/server.js"]
    }
  }
}
```

Claude Desktop を再起動すると、次のような頼み方ができます。

- 「今日のやること見せて」
- 「『部屋の掃除』をやることに追加して」
- 「◯◯を完了にして」
- 「今日のふりかえりを日記に書いておいて。今日は集中できた」
- 「最近1週間の記録から、今日おすすめのタスクを3つ提案して」

### Claude Code (CLI) の場合

```bash
claude mcp add my-day -- node /Users/あなた/my-day/mcp/server.js
```

### 使えるツール

| ツール | できること |
| --- | --- |
| `get_today` | 今日のタスク・日記を取得 |
| `add_task` | タスクを追加 |
| `complete_task` | タスクを完了/未完了 |
| `write_diary` | 日記・気分を書き込む |
| `get_history` | 直近n日の記録を取得（振り返り・提案の材料） |
| `get_templates` / `set_templates` | 定番タスクの取得・設定 |

> ウェブUIとMCPは同じ `data/` を見ています。どちらで変更しても、もう片方を再読み込みすれば反映されます。

---

## GitHubに上げる

```bash
git init
git add .
git commit -m "My Day: 初期版"
# GitHubで空のリポジトリを作ってから:
git remote add origin https://github.com/あなた/my-day.git
git push -u origin main
```

### ⚠️ プライバシーについて

`data/` にはあなたの**日記**が入ります。GitHubに上げるなら **必ずPrivateリポジトリ** にしてください。
公開したくない場合は、日記をGitに含めないようにできます:

```bash
echo "data/*.json" >> .gitignore   # 日ごとの日記を除外（templates.jsonは残る場合あり）
git rm -r --cached data
```

---

## データの形

- `data/YYYY-MM-DD.json` … その日のタスクと日記
- `data/templates.json` … 定番タスク

```json
{
  "date": "2026-07-15",
  "tasks": [
    { "id": "…", "title": "水を2L飲む", "done": true, "source": "template",
      "createdAt": "…", "completedAt": "…" }
  ],
  "diary": "今日は集中できた。明日は早めに始める。",
  "mood": "🙂"
}
```

シンプルなJSONなので、CLIやスクリプト、他のAIからも扱いやすい形にしてあります。
