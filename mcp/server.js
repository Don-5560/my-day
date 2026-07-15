// MCPサーバー。Claude Code / Claude Desktop がここにつなぐと、
// あなたの「やること」と「日記」を直接 読み書き できるようになる。
// server.js(ウェブ) と同じ lib/store.js を使うので、データは常に共有される。

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as store from "../lib/store.js";

const server = new Server(
  { name: "my-day", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Claudeに見せる道具（ツール）の一覧
const TOOLS = [
  {
    name: "get_today",
    description:
      "今日のやることリストと日記を取得する。日付を省略すると今日。まず状況を知りたいときに使う。",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD。省略で今日" } },
    },
  },
  {
    name: "add_task",
    description:
      "今日（または指定日）のやることを1件追加する。ユーザーの依頼やAIの提案でタスクを足すときに使う。",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "タスク名" },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
        source: {
          type: "string",
          enum: ["manual", "ai"],
          description: "AIが提案したタスクなら 'ai'",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_task",
    description: "タスクを完了/未完了に切り替える。done を省略すると反転する。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "タスクのID（get_todayで取得）" },
        done: { type: "boolean" },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
      },
      required: ["id"],
    },
  },
  {
    name: "write_diary",
    description: "その日の日記（やったこと・ふりかえり）と気分を書き込む/上書きする。",
    inputSchema: {
      type: "object",
      properties: {
        diary: { type: "string", description: "日記本文" },
        mood: { type: "string", description: "気分（絵文字1つでもOK）" },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
      },
    },
  },
  {
    name: "get_history",
    description:
      "直近n日ぶんの記録をまとめて取得する。振り返り・傾向分析・今日のおすすめタスク提案の材料に使う。",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", description: "取得する日数（既定14）" } },
    },
  },
  {
    name: "get_templates",
    description: "毎日/曜日ごとの定番タスク設定を取得する。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_templates",
    description:
      "定番タスクを設定する。recurring 配列で、各要素は {title, days}。days は 'daily' か曜日配列（例 ['mon','wed']）。",
    inputSchema: {
      type: "object",
      properties: {
        recurring: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              days: {
                description: "'daily' または ['mon','tue',...]",
              },
            },
            required: ["title"],
          },
        },
      },
      required: ["recurring"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// JSONをそのまま返す小さなヘルパー
const ok = (data) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case "get_today":
        return ok(await store.getDay(args.date || store.today()));

      case "add_task": {
        const { task, day } = await store.addTask(
          args.date || store.today(),
          args.title,
          args.source || "ai"
        );
        return ok({ added: task, tasks: day.tasks });
      }

      case "complete_task": {
        const { task } = await store.setTaskDone(
          args.date || store.today(),
          args.id,
          args.done
        );
        return ok({ updated: task });
      }

      case "write_diary":
        return ok(
          await store.setDiary(args.date || store.today(), args.diary, args.mood)
        );

      case "get_history":
        return ok(await store.recentDays(args.days || 14));

      case "get_templates":
        return ok(await store.getTemplates());

      case "set_templates":
        return ok(await store.saveTemplates({ recurring: args.recurring }));

      default:
        throw new Error(`未知のツール: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `エラー: ${err.message}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("my-day MCP server running on stdio");
