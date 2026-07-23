// MCPツール定義と実装（共通）。
// stdio版(mcp/server.js = PCのClaude Desktop用)と、
// HTTP版(server.jsの /mcp/:token = スマホ/リモートのClaude用)の両方がこれを使う。

import { randomUUID } from "node:crypto";
import * as store from "../lib/store.js";

// フロント(core.js)と同じXPルール。MCP経由の行動にもXPを付けて整合させる。
const XP = { task: 10, todoHigh: 20, todoMid: 10, todoLow: 5, diary: 15, project: 200, projectPaid: 300 };

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
const LEAD_STATUS = ["見込み", "商談中", "受注", "失注"];

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
        pri: { type: "string", enum: PRIS, description: "優先度（任意・高/中/低）" },
        memo: { type: "string", description: "メモ・やった内容（任意）" },
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
          description: "時刻順の予定。各要素 {title, time?(HH:MM), endTime?(HH:MM), cat?, tags?, pri?}",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              time: { type: "string", description: "開始 HH:MM" },
              endTime: { type: "string", description: "終了 HH:MM" },
              cat: { type: "string", enum: CATS },
              pri: { type: "string", enum: PRIS, description: "優先度（任意・高/中/低）" },
              tags: { type: "array", items: { type: "string" } },
              memo: { type: "string" },
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
    description: "勉強時間を記録する（分単位）。メモ・タグ・参考リンクも残せる。学習グラフとXPに反映される。",
    inputSchema: {
      type: "object",
      properties: {
        min: { type: "number", description: "勉強した分数" },
        subject: { type: "string", description: "科目（例: React, JavaScript, 一般）" },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
        memo: { type: "string", description: "やった内容・詰まった点・次回やることなどの自由メモ" },
        tags: { type: "array", items: { type: "string" }, description: "タグ（例: [\"React\",\"案件系\"]）" },
        link: { type: "string", description: "参考リンク（YouTube・記事URLなど）" },
      },
      required: ["min"],
    },
  },
  {
    name: "log_sale",
    description: "売上を記録する。source は Web制作 / Uber / その他。cost に経費(円)を渡すと支出としても記録され、利益(売上−経費)が出せる。",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "売上金額（円）" },
        cost: { type: "number", description: "経費（円・任意）。支出として台帳にも入る" },
        source: { type: "string", enum: ["Web制作", "Uber", "その他"] },
        memo: { type: "string" },
        date: { type: "string" },
      },
      required: ["amount"],
    },
  },
  {
    name: "add_project",
    description: "案件（案件管理ページ）を1件登録する。進行中の案件がget_overviewのactiveProjectsに出るようになる。登録するとXPが入る。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "案件名" },
        client: { type: "string", description: "クライアント名（任意）" },
        amount: { type: "number", description: "金額（円・任意）" },
        contract: { type: "string", description: "契約日 YYYY-MM-DD（任意）" },
        deadline: { type: "string", description: "納期 YYYY-MM-DD（任意）" },
        progress: { type: "number", description: "進捗率 0-100。省略で0" },
        memo: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_projects",
    description: "案件一覧を取得する（完了済みも含む）。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_project",
    description: "案件を更新する。idはlist_projectsで確認。進捗・請求状況・入金状況・納期・メモを更新できる。入金済みに変えるとXPが入る。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        progress: { type: "number", description: "進捗率 0-100" },
        invoice: { type: "string", enum: ["未請求", "請求済み"] },
        paid: { type: "string", enum: ["未入金", "入金済み"] },
        deadline: { type: "string", description: "YYYY-MM-DD" },
        memo: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_lead",
    description: "見込み案件（営業パイプライン）を1件登録する。まだ確定していない商談・見込みを追跡する。確定売上はlog_sale、進行中の受注済み案件はadd_projectを使う。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "相手・案件名（例: ○○サロン）" },
        status: { type: "string", enum: LEAD_STATUS, description: "省略で 見込み" },
        amount: { type: "number", description: "想定金額（円・任意）" },
        nextAction: { type: "string", description: "次にやること（任意）" },
        memo: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_leads",
    description: "見込み案件（営業パイプライン）の一覧を取得する。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_lead",
    description: "見込み案件のステータス・次アクション・金額・メモを更新する。idはlist_leadsで確認。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: LEAD_STATUS },
        amount: { type: "number" },
        nextAction: { type: "string" },
        memo: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_client",
    description: "顧客（クライアント）の基本情報を登録する。連絡先・メモを残しておける。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "顧客名" },
        contact: { type: "string", description: "連絡先（電話・メール・SNSなど・任意）" },
        memo: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_clients",
    description: "顧客一覧を取得する。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_client",
    description: "顧客情報を更新する。idはlist_clientsで確認。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        contact: { type: "string" },
        memo: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_reminder",
    description: "一回きりのリマインダーを登録する（定番タスクとは別枠）。指定した日付・時刻を過ぎるとget_overviewのdueRemindersに出るようになり、アプリを開いていればブラウザ通知でも知らせる。",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "内容（例: ○○さんに電話する）" },
        date: { type: "string", description: "YYYY-MM-DD。省略で今日" },
        time: { type: "string", description: "HH:MM（任意・省略でその日の始まりから対象）" },
        memo: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_reminders",
    description: "リマインダー一覧を取得する（完了済みも含む）。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "complete_reminder",
    description: "リマインダーを完了にする。idはlist_remindersで確認。",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "mark_budget_item_done",
    description: "予想収支の項目を「実現済み」にする（または解除する）。実際の取引として記録された予定を実現済みにすると、予想残高の二重計上を防げる。idはget_budget_planで確認。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "予想収支の項目ID" },
        done: { type: "boolean", description: "省略で現在の状態を反転" },
      },
      required: ["id"],
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
    name: "get_budget_plan",
    description: "「予想収支」タブの内容を取得する。現在の残高と、予想収入/予想出費/残高チェックポイントの各ブロック（タイトル・内訳項目・その時点での累計予想残高）を返す。get_balance/get_overviewには含まれない。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_employers",
    description: "勤務先（バイト先/取引先）の一覧を取得する。給与体系（時給制/歩合制、時給額）・支払いサイクル（週払い/月払いと締め日・支払日・支払い曜日）・連動している収入カテゴリー・現在の未収合計・次回入金日を返す。get_balance/get_overviewには含まれない。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_templates",
    description: "定番タスクを設定する。recurring配列: {title, days, time}。daysは 'daily' か曜日配列(['mon','wed'])。timeは任意の開始時刻 'HH:MM'。",
    inputSchema: {
      type: "object",
      properties: {
        recurring: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, days: {}, time: { type: "string" } },
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
      const [day, todosDoc, studyDoc, salesDoc, projDoc, leadsDoc, remindersDoc, xpDoc, settings, fin] = await Promise.all([
        store.getDay(today),
        store.getDoc("todos"), store.getDoc("study"), store.getDoc("sales"),
        store.getDoc("projects"), store.getDoc("leads"), store.getDoc("reminders"), store.getDoc("xp"), store.getDoc("settings"),
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
        todayTasks: day.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, time: t.time || "", endTime: t.endTime || "", cat: t.cat || "", pri: t.pri || "", spentMin: t.spentMin || 0 })),
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
        openLeads: (leadsDoc?.items ?? []).filter((l) => l.status === "見込み" || l.status === "商談中").map((l) => ({ name: l.name, status: l.status, amount: l.amount, nextAction: l.nextAction })),
        dueReminders: (remindersDoc?.items ?? [])
          .filter((r) => !r.done && (r.date < today || (r.date === today && (!r.time || r.time <= new Date().toTimeString().slice(0, 5)))))
          .map((r) => ({ id: r.id, title: r.title, date: r.date, time: r.time, memo: r.memo })),
        diaryWritten: !!day.diary,
      };
    }

    case "get_today":
      return store.getDay(args.date || store.today());

    case "add_task": {
      const { title, time, endTime, cat, pri, memo } = args;
      const { task, day } = await store.addTask(args.date || store.today(), title, "ai", { time, endTime, cat, pri, memo });
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
        memo: args.memo || "",
        tags: Array.isArray(args.tags) ? args.tags.map(String).map((s) => s.trim()).filter(Boolean) : [],
        link: args.link || "",
        src: "ai",
      };
      doc.logs.push(log);
      await store.saveDoc("study", doc);
      const xp = await awardXp(Math.min(log.min, 120), `勉強 ${log.min}分`);
      return { logged: log, xp };
    }

    case "log_sale": {
      const amount = Math.round(args.amount);
      const cost = Math.round(args.cost || 0);
      const source = ["Web制作", "Uber", "その他"].includes(args.source) ? args.source : "その他";
      // 売上(収入)＋任意の経費(支出)を記録。売上明細(doc:sales)にミラーされ、利益も計算できる。
      const { income, expense } = await store.recordSale({
        amount, cost, source, date: args.date || store.today(), memo: args.memo || "",
      });
      const xp = await awardXp(Math.min(Math.round(amount / 1000), 300), "売上を記録");
      return { logged: income, expense, profit: amount - cost, xp };
    }

    case "add_project": {
      const doc = (await store.getDoc("projects")) ?? { items: [] };
      const project = {
        id: randomUUID(),
        name: String(args.name).trim(),
        client: args.client || "",
        amount: Math.round(Number(args.amount) || 0),
        contract: args.contract || "",
        deadline: args.deadline || "",
        invoice: "未請求",
        paid: "未入金",
        progress: Math.max(0, Math.min(100, Math.round(Number(args.progress) || 0))),
        memo: args.memo || "",
      };
      doc.items.push(project);
      await store.saveDoc("projects", doc);
      const xp = await awardXp(XP.project, "案件を獲得！");
      return { project, xp };
    }

    case "list_projects":
      return (await store.getDoc("projects")) ?? { items: [] };

    case "update_project": {
      const doc = (await store.getDoc("projects")) ?? { items: [] };
      const p = doc.items.find((x) => x.id === args.id);
      if (!p) throw new Error("案件が見つかりません。list_projectsでidを確認してください");
      const wasPaid = p.paid;
      if (args.progress != null) p.progress = Math.max(0, Math.min(100, Math.round(Number(args.progress))));
      if (args.invoice) p.invoice = args.invoice;
      if (args.paid) p.paid = args.paid;
      if (args.deadline != null) p.deadline = args.deadline;
      if (args.memo != null) p.memo = args.memo;
      await store.saveDoc("projects", doc);
      let xp = 0;
      if (wasPaid !== "入金済み" && p.paid === "入金済み") xp = await awardXp(XP.projectPaid, "入金確認！");
      return { project: p, xp };
    }

    case "add_lead": {
      const doc = (await store.getDoc("leads")) ?? { items: [] };
      const lead = {
        id: randomUUID(),
        name: String(args.name).trim(),
        status: LEAD_STATUS.includes(args.status) ? args.status : "見込み",
        amount: Math.round(Number(args.amount) || 0),
        nextAction: args.nextAction || "",
        memo: args.memo || "",
        updatedAt: Date.now(),
      };
      doc.items.push(lead);
      await store.saveDoc("leads", doc);
      return { lead };
    }

    case "list_leads":
      return (await store.getDoc("leads")) ?? { items: [] };

    case "update_lead": {
      const doc = (await store.getDoc("leads")) ?? { items: [] };
      const l = doc.items.find((x) => x.id === args.id);
      if (!l) throw new Error("見込み案件が見つかりません。list_leadsでidを確認してください");
      if (args.status && LEAD_STATUS.includes(args.status)) l.status = args.status;
      if (args.amount != null) l.amount = Math.round(Number(args.amount) || 0);
      if (args.nextAction != null) l.nextAction = args.nextAction;
      if (args.memo != null) l.memo = args.memo;
      l.updatedAt = Date.now();
      await store.saveDoc("leads", doc);
      return { lead: l };
    }

    case "add_client": {
      const doc = (await store.getDoc("clients")) ?? { items: [] };
      const client = { id: randomUUID(), name: String(args.name).trim(), contact: args.contact || "", memo: args.memo || "", createdAt: Date.now() };
      doc.items.push(client);
      await store.saveDoc("clients", doc);
      return { client };
    }

    case "list_clients":
      return (await store.getDoc("clients")) ?? { items: [] };

    case "update_client": {
      const doc = (await store.getDoc("clients")) ?? { items: [] };
      const c = doc.items.find((x) => x.id === args.id);
      if (!c) throw new Error("顧客が見つかりません。list_clientsでidを確認してください");
      if (args.name != null) c.name = String(args.name).trim();
      if (args.contact != null) c.contact = args.contact;
      if (args.memo != null) c.memo = args.memo;
      await store.saveDoc("clients", doc);
      return { client: c };
    }

    case "add_reminder": {
      const doc = (await store.getDoc("reminders")) ?? { items: [] };
      const reminder = {
        id: randomUUID(),
        title: String(args.title).trim(),
        date: args.date || store.today(),
        time: args.time || "",
        memo: args.memo || "",
        done: false,
      };
      doc.items.push(reminder);
      await store.saveDoc("reminders", doc);
      return { reminder };
    }

    case "list_reminders":
      return (await store.getDoc("reminders")) ?? { items: [] };

    case "complete_reminder": {
      const doc = (await store.getDoc("reminders")) ?? { items: [] };
      const r = doc.items.find((x) => x.id === args.id);
      if (!r) throw new Error("リマインダーが見つかりません。list_remindersでidを確認してください");
      r.done = true;
      await store.saveDoc("reminders", doc);
      return { reminder: r };
    }

    case "mark_budget_item_done": {
      const doc = (await store.getDoc("budgetplan")) ?? { blocks: [] };
      let found = null;
      for (const b of doc.blocks || []) {
        const it = (b.items || []).find((x) => x.id === args.id);
        if (it) { found = it; break; }
      }
      if (!found) throw new Error("項目が見つかりません。get_budget_planでidを確認してください");
      found.done = typeof args.done === "boolean" ? args.done : !found.done;
      await store.saveDoc("budgetplan", doc);
      return { item: found };
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

    case "get_budget_plan": {
      const [budgetDoc, fin] = await Promise.all([store.getDoc("budgetplan"), store.financeSummary()]);
      const blocks = budgetDoc?.blocks ?? [];
      // 起点は確定残高(残高+未収-引き落とし予定)。ここから手動ブロックを積み上げる。
      let running = fin.projectedBalance;
      const out = blocks.map((b) => {
        if (b.type === "balance") {
          return { id: b.id, type: "balance", title: b.title || "予想残高", runningBalance: running };
        }
        // 実現済み(done)の項目はすでに残高(currentBalance)側に反映済みのため、二重計上を避けて合計・累計から除外する
        const total = (b.items ?? []).filter((i) => !i.done).reduce((s, i) => s + (Number(i.amount) || 0), 0);
        running += b.type === "income" ? total : -total;
        return {
          id: b.id,
          type: b.type,
          title: b.title || (b.type === "income" ? "予想収入" : "予想出費"),
          total,
          runningBalance: running,
          items: (b.items ?? []).map((i) => ({
            id: i.id, label: i.label, amount: i.amount, from: i.from || "", to: i.to || "", done: i.done === true,
            breakdown: (i.breakdown ?? []).map((bd) => ({ name: bd.name, amount: bd.amount, note: bd.note || "" })),
          })),
        };
      });
      return {
        currentBalance: fin.currentBalance,
        confirmedBalance: fin.projectedBalance,
        pendingIncome: fin.pendingIncome,
        pendingExpense: fin.pendingExpense,
        blocks: out,
        finalProjectedBalance: running,
      };
    }

    case "get_employers": {
      const [empDoc, pending] = await Promise.all([store.getDoc("employers"), store.employerPendingSummary()]);
      const pendingMap = Object.fromEntries(pending.map((p) => [p.employerId, p]));
      const items = (empDoc?.items ?? []).map((e) => {
        const p = pendingMap[e.id];
        return {
          id: e.id,
          name: e.name,
          location: e.location || "",
          wageType: e.wageType,
          hourlyWage: e.hourlyWage ?? null,
          payCycle: e.payCycle,
          weeklyPayDay: e.weeklyPayDay ?? null,
          closingDay: e.closingDay ?? null,
          paymentDay: e.paymentDay ?? null,
          linkedCategory: e.linkedCategory || null,
          pendingTotal: p?.total ?? 0,
          nextPayoutDate: p?.nextPayoutDate ?? null,
        };
      });
      return { items };
    }

    default:
      throw new Error(`未知のツール: ${name}`);
  }
}
