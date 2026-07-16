// MCPツール定義と実装（共通）。
// stdio版(mcp/server.js = PCのClaude Desktop用)と、
// HTTP版(server.jsの /mcp/:token = スマホ/リモートのClaude用)の両方がこれを使う。

import { randomUUID } from "node:crypto";
import * as store from "../lib/store.js";

// フロント(core.js)と同じXPルール。MCP経由の行動にもXPを付けて整合させる。
const XP = { task: 10, todoHigh: 20, todoMid: 10, todoLow: 5, diary: 15 };

async function awardXp(amt, why) {
  const xp = (await store.getDoc("xp")) ?? { events: [] };
  xp.events.push({ id: randomUUID(), ts: Date.now(), amt, why });
  await store.saveDoc("xp", xp);
  return amt;
}

function levelOf(events) {
  let xp = events.reduce((s, e) => s + e.amt, 0), lvl = 1, need = 100;
  while (xp >= need) { xp -= need; lvl++; need = 100 + (lvl - 1) * 50; }
  return { lvl, cur: xp, need, total: events.reduce((s, e) => s + e.amt, 0) };
}

const CATS = ["勉強", "制作", "営業", "生活", "趣味"];
const PRIS = ["高", "中", "低"];

export const TOOLS = [
  {
    name: "get_overview",
    description:
      "LifeOSのダッシュボード概要を取得する。レベル/XP/連続記録、今日のタスク、今週が期限のTodo、今日の勉強時間、今月の売上、進行中の案件、目標。予定を組む・状況を確認するときは、まずこれを呼ぶ。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_today",
    description: "指定日（省略で今日）のやることリストと日報を取得する。",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD。省略で今日" } },
    },
  },
  {
    name: "add_task",
    description: "今日（または指定日）の「今日のやること」に1件追加する。時間割に載せるなら開始/終了時刻を指定できる。期限付き・カテゴリー付きの継続管理はadd_todoを使う。",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        time: { type: "string", description: "開始時刻 HH:MM（任意）" },
        endTime: { type: "string", description: "終了時刻 HH:MM（任意）" },
        cat: { type: "string", enum: CATS, description: "カテゴリー（任意）" },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
      },
      required: ["title"],
    },
  },
  {
    name: "set_schedule",
    description: "今日（または指定日）の1日のスケジュールをまとめて組み直す。渡したtasks配列で予定を置き換える。既存タスクと同じtitleのものは完了状態・実績時間を引き継ぐので、再計画で進捗が消えない。ユーザーの1日の予定を作る/更新するときはこれを使う。",
    inputSchema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "時刻順の予定。各要素 {title, time?(HH:MM), endTime?(HH:MM), cat?, tags?}",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              time: { type: "string", description: "開始 HH:MM" },
              endTime: { type: "string", description: "終了 HH:MM" },
              cat: { type: "string", enum: CATS },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["title"],
          },
        },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
      },
      required: ["tasks"],
    },
  },
  {
    name: "complete_task",
    description: "「今日のやること」のタスクを完了/未完了にする。done省略で反転。完了時はXPが入る。spentMinを渡すと実績時間(分)も記録する。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "タスクID（get_todayで取得）" },
        done: { type: "boolean" },
        spentMin: { type: "number", description: "実績の所要時間（分・任意）" },
        date: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "write_diary",
    description: "日報を書く/上書きする。diary=今日やったこと、reflect=反省、tomorrow=明日の目標、mood=気分(laugh/smile/meh/frown/tired)。",
    inputSchema: {
      type: "object",
      properties: {
        diary: { type: "string" },
        reflect: { type: "string" },
        tomorrow: { type: "string" },
        mood: { type: "string", enum: ["laugh", "smile", "meh", "frown", "tired", ""] },
        date: { type: "string" },
      },
    },
  },
  {
    name: "get_history",
    description: "直近n日ぶんの日次記録（タスク・日報）を取得する。振り返りや傾向分析の材料。",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", description: "既定14" } },
    },
  },
  {
    name: "list_todos",
    description: "Todoリスト（期限・カテゴリー・優先度付きのタスク管理）を取得する。完了済みも含む。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_todo",
    description: "Todoを追加する。予定を組むときはこれで期限付きのTodoを作る。",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        cat: { type: "string", enum: CATS, description: "カテゴリー。既定は制作" },
        pri: { type: "string", enum: PRIS, description: "優先度。既定は中" },
        due: { type: "string", description: "締切 YYYY-MM-DD" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_todo",
    description: "Todoを完了にする。idかtitle（完全一致）で指定。優先度に応じてXPが入る。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
      },
    },
  },
  {
    name: "log_study",
    description: "勉強時間を記録する（分単位）。学習グラフとXPに反映される。",
    inputSchema: {
      type: "object",
      properties: {
        min: { type: "number", description: "勉強した分数" },
        subject: { type: "string", description: "科目（例: React, JavaScript, 一般）" },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
      },
      required: ["min"],
    },
  },
  {
    name: "log_sale",
    description: "売上を記録する。source は Web制作 / Uber / その他。",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "金額（円）" },
        source: { type: "string", enum: ["Web制作", "Uber", "その他"] },
        memo: { type: "string" },
        date: { type: "string" },
      },
      required: ["amount"],
    },
  },
  {
    name: "set_initial_balance",
    description: "初期残高（元手）を設定する。残高は「初期残高 + 収入合計 − 支出合計」で常に計算される。",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "初期残高（円、0以上の整数）" },
      },
      required: ["amount"],
    },
  },
  {
    name: "add_transaction",
    description:
      "お金の収入/支出を1件記録する。収入カテゴリ例: Web制作 / Uber / その他。支出カテゴリ例: 生活費 / 事業経費 / ツール代 / その他。金額は整数(円)。",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense"], description: "income=収入 / expense=支出" },
        amount: { type: "number", description: "金額（円、1以上の整数）" },
        category: { type: "string", description: "カテゴリ。省略時は その他" },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
        memo: { type: "string" },
        source: { type: "string", description: "記録元。省略時 manual" },
      },
      required: ["type", "amount"],
    },
  },
  {
    name: "get_balance",
    description: "現在の残高と、今月（またはmonth指定）の収入合計・支出合計・差引を返す。お金の状況を見るときの起点。",
    inputSchema: {
      type: "object",
      properties: { month: { type: "string", description: "YYYY-MM。省略で今月" } },
    },
  },
  {
    name: "list_transactions",
    description: "取引一覧を返す。month(YYYY-MM)・type(income/expense)で絞り込める。",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "YYYY-MM" },
        type: { type: "string", enum: ["income", "expense"] },
      },
    },
  },
  {
    name: "get_templates",
    description: "毎日/曜日ごとの定番タスク設定を取得する。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_templates",
    description: "定番タスクを設定する。recurring配列: {title, days}。daysは 'daily' か曜日配列(['mon','wed'])。",
    inputSchema: {
      type: "object",
      properties: {
        recurring: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, days: {} },
            required: ["title"],
          },
        },
      },
      required: ["recurring"],
    },
  },
];

export async function callTool(name, args = {}) {
  switch (name) {
    case "get_overview": {
      const today = store.today();
      const [day, todosDoc, studyDoc, salesDoc, projDoc, xpDoc, settings, fin] = await Promise.all([
        store.getDay(today),
        store.getDoc("todos"), store.getDoc("study"), store.getDoc("sales"),
        store.getDoc("projects"), store.getDoc("xp"), store.getDoc("settings"),
        store.financeSummary(),
      ]);
      const todos = todosDoc?.items ?? [];
      const events = xpDoc?.events ?? [];
      const in7 = new Date(); in7.setDate(in7.getDate() + 6);
      const lim = `${in7.getFullYear()}-${String(in7.getMonth() + 1).padStart(2, "0")}-${String(in7.getDate()).padStart(2, "0")}`;
      return {
        date: today,
        level: levelOf(events),
        todayGoal: settings?.todayGoal || "",
        monthGoal: settings?.monthGoal || "",
        todayTasks: day.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, time: t.time || "", endTime: t.endTime || "", cat: t.cat || "", spentMin: t.spentMin || 0 })),
        weekTodos: todos
          .filter((t) => !t.done && t.due && t.due <= lim)
          .map((t) => ({ id: t.id, title: t.title, cat: t.cat, pri: t.pri, due: t.due })),
        openTodos: todos.filter((t) => !t.done).length,
        studyTodayMin: (studyDoc?.logs ?? []).filter((l) => l.date === today).reduce((s, l) => s + l.min, 0),
        salesThisMonth: (salesDoc?.logs ?? []).filter((l) => l.date?.slice(0, 7) === today.slice(0, 7)).reduce((s, l) => s + l.amount, 0),
        currentBalance: fin.currentBalance,
        incomeThisMonth: fin.incomeThisMonth,
        expenseThisMonth: fin.expenseThisMonth,
        netThisMonth: fin.netThisMonth,
        activeProjects: (projDoc?.items ?? []).filter((p) => (p.progress || 0) < 100).map((p) => ({ name: p.name, client: p.client, deadline: p.deadline, progress: p.progress })),
        diaryWritten: !!day.diary,
      };
    }

    case "get_today":
      return store.getDay(args.date || store.today());

    case "add_task": {
      const { title, time, endTime, cat } = args;
      const { task, day } = await store.addTask(args.date || store.today(), title, "ai", { time, endTime, cat });
      return { added: task, tasks: day.tasks };
    }

    case "set_schedule": {
      const day = await store.setSchedule(args.date || store.today(), args.tasks || [], "ai");
      return { date: day.date, tasks: day.tasks };
    }

    case "complete_task": {
      const date = args.date || store.today();
      const { task } = await store.setTaskDone(date, args.id, args.done);
      if (task.done) await awardXp(XP.task, "タスク完了");
      // 実績時間が渡されていれば所要時間(分)も記録
      let updated = task;
      if (typeof args.spentMin === "number") {
        updated = (await store.updateTask(date, args.id, { spentMin: args.spentMin })).task;
      }
      return { updated };
    }

    case "write_diary": {
      const day = await store.setDiary(args.date || store.today(), args);
      if (args.diary) await awardXp(XP.diary, "日報を書いた");
      return day;
    }

    case "get_history":
      return store.recentDays(args.days || 14);

    case "list_todos":
      return (await store.getDoc("todos")) ?? { items: [] };

    case "add_todo": {
      const doc = (await store.getDoc("todos")) ?? { items: [] };
      const todo = {
        id: randomUUID(),
        title: String(args.title).trim(),
        cat: CATS.includes(args.cat) ? args.cat : "制作",
        pri: PRIS.includes(args.pri) ? args.pri : "中",
        due: args.due || "",
        tags: Array.isArray(args.tags) ? args.tags : [],
        done: false, createdAt: Date.now(), order: doc.items.length,
        source: "ai",
      };
      doc.items.push(todo);
      await store.saveDoc("todos", doc);
      return { added: todo };
    }

    case "complete_todo": {
      const doc = (await store.getDoc("todos")) ?? { items: [] };
      const t = doc.items.find((x) => x.id === args.id || x.title === args.title);
      if (!t) throw new Error("Todoが見つかりません。list_todosでidを確認してください");
      t.done = true; t.doneAt = Date.now();
      await store.saveDoc("todos", doc);
      const amt = t.pri === "高" ? XP.todoHigh : t.pri === "低" ? XP.todoLow : XP.todoMid;
      await awardXp(amt, "Todo完了");
      return { completed: t, xp: amt };
    }

    case "log_study": {
      const doc = (await store.getDoc("study")) ?? { logs: [] };
      const log = {
        id: randomUUID(),
        date: args.date || store.today(),
        min: Math.max(1, Math.round(args.min)),
        subject: args.subject || "一般",
        src: "ai",
      };
      doc.logs.push(log);
      await store.saveDoc("study", doc);
      const xp = await awardXp(Math.min(log.min, 120), `勉強 ${log.min}分`);
      return { logged: log, xp };
    }

    case "log_sale": {
      const amount = Math.round(args.amount);
      const source = ["Web制作", "Uber", "その他"].includes(args.source) ? args.source : "その他";
      // 収入トランザクションとして記録 → addTransaction 内で売上明細(doc:sales)にも自動ミラーされる。
      const tx = await store.addTransaction({
        type: "income", amount, category: source,
        date: args.date || store.today(), memo: args.memo || "", source: "sale",
      });
      const xp = await awardXp(Math.min(Math.round(amount / 1000), 300), "売上を記録");
      return { logged: tx, xp };
    }

    case "set_initial_balance":
      return store.setInitialBalance(args.amount);

    case "add_transaction":
      return { added: await store.addTransaction(args) };

    case "get_balance":
      return store.financeSummary(args.month || undefined);

    case "list_transactions": {
      const items = await store.listTransactions({ month: args.month, type: args.type });
      return { items, count: items.length };
    }

    case "get_templates":
      return store.getTemplates();

    case "set_templates":
      return store.saveTemplates({ recurring: args.recurring });

    default:
      throw new Error(`未知のツール: ${name}`);
  }
}
