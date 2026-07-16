// LifeOS 画面: ナビ/ルーター + ホーム / Todo / タイマー / 日報 / 習慣 / メニュー
"use strict";

window.VIEWS = window.VIEWS || {};

const NAV_GROUPS = [
  { label: "メイン", items: ["home", "todo", "time", "report", "habits"] },
  { label: "ワーク", items: ["projects", "outreach", "sales", "money", "portfolio", "learning"] },
  { label: "グロース", items: ["goals", "badges", "analytics", "calendar"] },
  { label: "", items: ["settings"] },
];
const BOTTOM_NAV = ["calendar", "todo", "home", "habits", "menu"];
// 右ドロワーの構成（モバイルの「メニュー」から開く）
const DRAWER_GROUPS = [
  { label: "仕事", items: [["projects", "案件"], ["outreach", "営業"], ["money", "売上・収支"], ["sales", "売上明細"], ["portfolio", "ポートフォリオ"]] },
  { label: "学習", items: [["learning", "学習管理"], ["time", "タイマー"]] },
  { label: "人生・習慣", items: [["goals", "目標管理"], ["badges", "実績・バッジ"]] },
  { label: "分析・レポート", items: [["report", "日報"], ["analytics", "分析・レポート"]] },
];

const CAT_COLORS = { "勉強": "var(--accent)", "制作": "var(--violet)", "営業": "var(--green)", "生活": "var(--amber)", "趣味": "var(--pink)" };
const CATS = Object.keys(CAT_COLORS);
const PRIS = ["高", "中", "低"];
const MOODS = ["laugh", "smile", "meh", "frown", "tired"];

// ===== ルーター =====

let CURRENT = "home";
function go(name) { location.hash = "#/" + name; }
function route() {
  const name = location.hash.replace(/^#\//, "") || "home";
  CURRENT = VIEWS[name] ? name : "home";
  document.body.classList.toggle("home-view", CURRENT === "home"); // ホームだけ上部バーを出す
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === CURRENT));
  const main = $("#main");
  main.innerHTML = "";
  VIEWS[CURRENT].render(main);
  window.scrollTo(0, 0);
}
function rerender() { route(); }

function buildNav() {
  $("#logoBadge").innerHTML = icon("zap", 18);
  const m = $("#logoBadgeM"); if (m) m.innerHTML = icon("zap", 15);
  $("#sideNav").innerHTML = NAV_GROUPS.map((g) => `<div class="nav-group">
    ${g.label ? `<div class="nav-label">${esc(g.label)}</div>` : ""}
    ${g.items.map((v) => `<button class="nav-item" data-view="${v}">${icon(VIEWS[v].icon, 17)}${esc(VIEWS[v].title)}</button>`).join("")}
  </div>`).join("");
  $("#bottomNav").innerHTML = BOTTOM_NAV.map((v) => {
    const isMenu = v === "menu";
    const label = isMenu ? "メニュー" : VIEWS[v].title;
    const ic = isMenu ? "menu" : VIEWS[v].icon;
    const cls = v === "home" ? "nav-item center" : "nav-item";
    return `<button class="${cls}" data-view="${v}">${icon(ic, v === "home" ? 24 : 20)}<span>${esc(label)}</span></button>`;
  }).join("");
  $$(".nav-item").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.view === "menu") openDrawer();
    else go(b.dataset.view);
  }));
}

// ===== 右ドロワーメニュー =====

function openDrawer() {
  const wrap = $("#drawerWrap");
  wrap.innerHTML = `
    <div class="drawer-overlay" id="drawerOverlay"></div>
    <aside class="drawer" id="drawer">
      <div class="drawer-head"><h3>ダッシュボード</h3><button class="icon-btn" id="drawerClose">${icon("x", 18)}</button></div>
      ${DRAWER_GROUPS.map((g) => `<div class="drawer-group">
        <div class="drawer-label">${esc(g.label)}</div>
        ${g.items.map(([v, label]) => `<button class="drawer-item" data-view="${v}">
          <span class="di-ic">${icon(VIEWS[v] ? VIEWS[v].icon : "grid", 16)}</span>
          <span class="di-label">${esc(label)}</span>
          <span class="di-chev">${icon("chevR", 16)}</span></button>`).join("")}
      </div>`).join("")}
      <hr class="drawer-sep">
      <button class="drawer-item" data-view="settings">
        <span class="di-ic">${icon("settings", 16)}</span>
        <span class="di-label">設定</span>
        <span class="di-chev">${icon("chevR", 16)}</span></button>
    </aside>`;
  requestAnimationFrame(() => {
    const ov = $("#drawerOverlay"), dr = $("#drawer");
    if (ov) ov.classList.add("open");
    if (dr) dr.classList.add("open");
  });
  $("#drawerOverlay").addEventListener("click", closeDrawer);
  $("#drawerClose").addEventListener("click", closeDrawer);
  $$("#drawer .drawer-item").forEach((b) => b.addEventListener("click", () => { closeDrawer(); go(b.dataset.view); }));
}

function closeDrawer() {
  const ov = $("#drawerOverlay"), dr = $("#drawer");
  if (ov) ov.classList.remove("open");
  if (dr) dr.classList.remove("open");
  setTimeout(() => { const w = $("#drawerWrap"); if (w) w.innerHTML = ""; }, 320);
}

// ===== ホーム =====

// 最近の活動のカテゴリバッジ（XPイベントのwhyから推定）
function activityBadge(why) {
  if (/習慣/.test(why)) return { label: "習慣", cls: "grn" };
  if (/勉強|ポモ/.test(why)) return { label: "学習", cls: "acc" };
  if (/売上|入金/.test(why)) return { label: "営業", cls: "amb" };
  if (/日報/.test(why)) return { label: "生活", cls: "vio" };
  if (/Todo|タスク|案件|バッジ/.test(why)) return { label: "制作", cls: "pnk" };
  return null;
}
// 過去の最長連続記録
function bestStreakVal() {
  const map = activityMap();
  const days = Object.keys(map).filter((k) => map[k] > 0).sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev && (new Date(d) - new Date(prev)) === 86400000 ? run + 1 : 1;
    best = Math.max(best, run); prev = d;
  }
  return best;
}

VIEWS.home = {
  title: "ホーム", icon: "home",
  render(main) {
    const S = DB.settings;
    const tasks = [...DB.day.tasks].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    const done = DB.day.tasks.filter((t) => t.done).length;
    const total = DB.day.tasks.length;
    const dayPct = total ? Math.round((done / total) * 100) : 0;
    const studyToday = DB.study.logs.filter((l) => l.date === todayStr()).reduce((s, l) => s + l.min, 0);
    const salesToday = DB.sales.logs.filter((l) => l.date === todayStr()).reduce((s, l) => s + l.amount, 0);
    const acts = [...DB.xp.events].slice(-6).reverse();

    main.innerHTML = `
      <div class="greet">
        <div class="greet-top">
          <h1 class="greet-hello">おかえり、${esc(S.name || "しどう")} <span class="wave">👋</span></h1>
        </div>
        <div class="greet-sub">
          <p>${esc(S.todayGoal) || "今日も最高の1日にしよう。"}</p>
          <span class="greet-date">${fmtDateFull(todayStr())}</span>
        </div>
      </div>

      <div class="card task-summary">
        <div class="ts-main">
          <div class="ts-label">今日のタスク</div>
          <div class="ts-count"><span id="tsCount">${done}</span> <small>/ <span id="tsTotal">${total}</span> 完了</small></div>
          <div class="bar"><i id="tsBar" style="width:${dayPct}%"></i></div>
        </div>
        <button class="btn ghost sm" id="addTask">${icon("plus", 14)} 追加</button>
      </div>

      <div class="card">
        <div class="card-head"><h2>${icon("calendar", 15)} 今日の予定</h2></div>
        <div id="schedule">${tasks.map((t) => {
          const catCol = t.cat ? (CAT_COLORS[t.cat] || "var(--muted)") : "";
          const badges = [
            t.cat ? `<span class="pill" style="color:${catCol};background:color-mix(in srgb, ${catCol} 15%, transparent)">${esc(t.cat)}</span>` : "",
            t.source === "template" ? '<span class="pill">定番</span>' : t.source === "ai" ? '<span class="pill acc">AI</span>' : "",
            ...(t.tags || []).map((tag) => `<span class="pill">#${esc(tag)}</span>`),
            t.spentMin ? `<span class="pill grn">${icon("timer", 10)} ${fmtHM(t.spentMin)}</span>` : "",
          ].join("");
          return `<div class="list-item ${t.done ? "done" : ""}" data-row="${t.id}">
            <input type="checkbox" class="checkbox" data-task="${t.id}" ${t.done ? "checked" : ""}>
            ${t.time ? `<span class="li-time">${esc(t.time)}</span>` : ""}
            <div class="li-body">
              <div class="li-title">${esc(t.title)}</div>
              ${badges ? `<div class="li-tags">${badges}</div>` : ""}
            </div>
            <div class="li-right">
              <button class="icon-btn" data-play="${t.id}" aria-label="タイマー開始">${icon("play", 14)}</button>
              <button class="icon-btn danger row-del" data-del="${t.id}" aria-label="削除">${icon("trash", 14)}</button>
            </div>
          </div>`;
        }).join("") || '<p class="empty">今日の予定はまだありません。「追加」から入れましょう。</p>'}
        </div>
      </div>

      <div class="home-stats">
        ${homeStat("勉強時間 (今日)", studyToday ? fmtHM(studyToday) : "0m", "目標: " + fmtHM(S.dailyStudyGoalMin || 360), "timer")}
        ${homeStat("売上 (今日)", fmtYen(salesToday), "目標: " + fmtYen(S.dailySalesGoal || 20000), "yen")}
        ${homeStat("連続記録", streak() + "日", "ベスト: " + bestStreakVal() + "日", "flame")}
      </div>

      <div class="card">
        <div class="card-head"><h2>${icon("flame", 15)} 最近の活動</h2>
          <div style="display:flex;gap:10px;align-items:center">
            <button class="link-more" data-go="analytics">すべて見る ${icon("chevR", 12)}</button>
            <button class="btn sm" id="logActivity">${icon("plus", 13)} 記録</button>
          </div></div>
        ${acts.map((e) => {
          const b = activityBadge(e.why);
          return `<div class="list-item">
            <div class="li-body"><div class="li-title" style="white-space:normal">${esc(e.why)}</div></div>
            <div class="li-right">${b ? `<span class="pill ${b.cls}">${b.label}</span>` : ""}<span class="li-meta">${relTime(e.ts)}</span></div>
          </div>`;
        }).join("") || '<p class="empty">まだ活動がありません。タスクを完了するとここに出ます。</p>'}
      </div>`;

    // 今日のタスクの進捗表示をその場で更新（再描画しない）
    const refreshSummary = () => {
      const d = DB.day.tasks.filter((t) => t.done).length, tt = DB.day.tasks.length;
      const c = $("#tsCount"), tot = $("#tsTotal"), bar = $("#tsBar");
      if (c) c.textContent = d;
      if (tot) tot.textContent = tt;
      if (bar) bar.style.width = (tt ? Math.round((d / tt) * 100) : 0) + "%";
    };

    // チェック: その場でトグル（再描画やチェック位置へのジャンプをしない）
    $$("#schedule [data-task]").forEach((cb) => cb.addEventListener("change", async () => {
      const row = cb.closest(".list-item");
      row.classList.toggle("done", cb.checked);
      try {
        DB.day = await api("/api/tasks/" + cb.dataset.task, { method: "PATCH", body: JSON.stringify({ done: cb.checked }) });
      } catch (err) { cb.checked = !cb.checked; row.classList.toggle("done", cb.checked); toast(err.message, "x"); return; }
      refreshSummary();
      if (cb.checked) await addXP(XP_RULES.task, "タスク完了");
    }));

    // 削除: その場で行を消す
    $$("#schedule [data-del]").forEach((b) => b.addEventListener("click", async () => {
      try { DB.day = await api("/api/tasks/" + b.dataset.del + "?date=" + todayStr(), { method: "DELETE" }); }
      catch (err) { toast(err.message, "x"); return; }
      const row = b.closest(".list-item"); if (row) row.remove();
      refreshSummary();
      if (!DB.day.tasks.length) $("#schedule").innerHTML = '<p class="empty">今日の予定はまだありません。「追加」から入れましょう。</p>';
    }));

    // タイマー開始（そのタスクの時間を計測）
    $$("#schedule [data-play]").forEach((b) => b.addEventListener("click", () => {
      const t = DB.day.tasks.find((x) => x.id === b.dataset.play);
      if (t) startTaskTimer(t);
    }));

    // 追加（タイトル＋任意の時刻・カテゴリー・タグ）
    $("#addTask").addEventListener("click", async () => {
      const v = await modal("やることを追加", [
        { key: "title", label: "やること", type: "text", placeholder: "例: LPデザイン制作" },
        { key: "time", label: "時刻（任意）", type: "time" },
        { key: "cat", label: "カテゴリー（任意）", type: "select", options: ["", ...CATS] },
        { key: "tags", label: "タグ（任意・カンマ区切り）", type: "tags", placeholder: "例: LP, 急ぎ" },
      ]);
      if (!v || !v.title) return;
      DB.day = await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: v.title, time: v.time, cat: v.cat, tags: v.tags }) });
      rerender();
    });

    $("#logActivity").addEventListener("click", logActivity);
    $$("[data-go]", main).forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  },
};

// 「やったことを記録」: 種類を選ぶと、対応する管理ページ（勉強/売上/営業/作品）に自動で記録される
async function logActivity() {
  const types = [
    { key: "study", label: "勉強", icon: "timer" },
    { key: "sale", label: "売上", icon: "yen" },
    { key: "outreach", label: "営業", icon: "send" },
    { key: "work", label: "作品", icon: "layers" },
  ];
  const pick = await new Promise((resolve) => {
    const wrap = $("#modalWrap");
    wrap.innerHTML = `<div class="overlay"><div class="modal" style="width:min(94vw,360px)">
      <div class="modal-head"><h3>やったことを記録</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <div class="act-grid">${types.map((t) => `<button type="button" class="act-btn" data-t="${t.key}">${icon(t.icon, 22)}<span>${t.label}</span></button>`).join("")}</div>
    </div></div>`;
    const close = (r) => { wrap.innerHTML = ""; resolve(r); };
    wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) close(null); });
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => close(null)));
    $$("[data-t]", wrap).forEach((b) => b.addEventListener("click", () => close(b.dataset.t)));
  });
  if (!pick) return;

  if (pick === "study") {
    const v = await modal("勉強を記録", [
      { key: "min", label: "分", type: "number", placeholder: "60" },
      { key: "subject", label: "科目", type: "select", options: ["一般", ...DB.learning.items.map((i) => i.name), "その他"] },
      { key: "date", label: "日付", type: "date", default: todayStr() },
    ]);
    if (!v || !v.min) return;
    DB.study.logs.push({ id: uid(), date: v.date || todayStr(), min: v.min, subject: v.subject, src: "manual" });
    await saveDb("study"); await addXP(Math.min(v.min, 120), "勉強を記録"); toast("勉強を記録しました");
  } else if (pick === "sale") {
    const v = await modal("売上を記録", [
      { key: "amount", label: "金額（円）", type: "money", placeholder: "50000" },
      { key: "source", label: "収入源", type: "select", options: SALE_SOURCES },
      { key: "date", label: "日付", type: "date", default: todayStr() },
      { key: "memo", label: "メモ", type: "text" },
    ]);
    if (!v || !v.amount) return;
    try { await api("/api/transactions", { method: "POST", body: JSON.stringify({ type: "income", amount: Math.round(v.amount), category: v.source, date: v.date || todayStr(), memo: v.memo }) }); }
    catch (e) { toast(e.message, "x"); return; }
    await refreshSales(); await addXP(Math.min(Math.round(v.amount / 1000), 300), "売上を記録"); toast("売上を記録しました");
  } else if (pick === "outreach") {
    const v = await modal("営業を記録", [
      { key: "channel", label: "チャネル", type: "select", options: ["Instagram", "X", "TikTok", "メール", "DM", "その他"] },
      { key: "sent", label: "送信数", type: "number" },
      { key: "replies", label: "返信数", type: "number" },
      { key: "orders", label: "受注数", type: "number" },
      { key: "date", label: "日付", type: "date", default: todayStr() },
    ]);
    if (!v || !v.channel) return;
    DB.outreach.logs.push({ id: uid(), date: v.date || todayStr(), channel: v.channel, sent: v.sent, replies: v.replies, orders: v.orders });
    await saveDb("outreach"); await addXP(5, "営業を記録"); toast("営業を記録しました");
  } else if (pick === "work") {
    const v = await modal("作品を追加", [
      { key: "name", label: "作品名", type: "text", placeholder: "例: ○○のLP" },
      { key: "progress", label: "進捗", type: "range" },
      { key: "link", label: "リンク（任意）", type: "url" },
    ]);
    if (!v || !v.name) return;
    DB.portfolio.items.push({ id: uid(), name: v.name, progress: v.progress || 0, link: v.link || "", memo: "" });
    await saveDb("portfolio"); await addXP(10, "作品を追加"); toast("作品を追加しました");
  }
  rerender();
}
setInterval(() => { const c = $("#clock"); if (c) { const d = new Date(); c.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":"); } }, 1000);

// ===== Todo =====

let TODO_FILTER = { q: "", cat: "すべて" };

VIEWS.todo = {
  title: "Todo", icon: "check",
  render(main) {
    const items = DB.todos.items
      .filter((t) => TODO_FILTER.cat === "すべて" || t.cat === TODO_FILTER.cat)
      .filter((t) => !TODO_FILTER.q || (t.title + (t.tags || []).join()).toLowerCase().includes(TODO_FILTER.q.toLowerCase()))
      .sort((a, b) => (a.done - b.done) || (a.order ?? 0) - (b.order ?? 0));

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Tasks</p><h1>Todo</h1></div>
        <button class="btn" id="addTodo">${icon("plus", 15)} 追加</button>
      </div>
      <div class="card">
        <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
          <div style="position:relative;flex:1;min-width:180px">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--faint)">${icon("search", 15)}</span>
            <input type="text" id="todoSearch" placeholder="検索…" value="${esc(TODO_FILTER.q)}" style="padding-left:38px">
          </div>
        </div>
        <div class="tabs">${["すべて", ...CATS].map((c) =>
          `<button class="tab ${TODO_FILTER.cat === c ? "active" : ""}" data-cat="${c}">${c}</button>`).join("")}</div>
        <div id="todoList">
        ${items.map((t) => {
          const over = t.due && t.due < todayStr() && !t.done;
          return `<div class="row ${t.done ? "done" : ""}" draggable="true" data-id="${t.id}">
            <span style="cursor:grab;color:var(--faint)" class="drag-h">${icon("grip", 15)}</span>
            <input type="checkbox" class="checkbox" data-check="${t.id}" ${t.done ? "checked" : ""}>
            <span class="row-title">${esc(t.title)}</span>
            <span class="row-meta">
              <span class="pill" style="color:${CAT_COLORS[t.cat]};background:color-mix(in srgb, ${CAT_COLORS[t.cat]} 14%, transparent)">${esc(t.cat)}</span>
              <span class="pill ${t.pri === "高" ? "red" : t.pri === "中" ? "amb" : ""}">${esc(t.pri)}</span>
              ${t.due ? `<span class="pill ${over ? "red" : ""}">${fmtShort(t.due)}</span>` : ""}
              ${(t.tags || []).map((tag) => `<span class="pill">#${esc(tag)}</span>`).join("")}
            </span>
            <button class="icon-btn row-edit" data-edit="${t.id}">${icon("edit", 14)}</button>
            <button class="icon-btn danger row-del" data-del="${t.id}">${icon("trash", 14)}</button>
          </div>`;
        }).join("") || '<p class="empty">Todoがありません。「追加」から作成しましょう。</p>'}
        </div>
      </div>`;

    const FIELDS = [
      { key: "title", label: "タイトル", type: "text", placeholder: "何をやる？" },
      { key: "cat", label: "カテゴリー", type: "select", options: CATS },
      { key: "pri", label: "優先度", type: "select", options: PRIS },
      { key: "due", label: "締切", type: "date" },
      { key: "tags", label: "タグ", type: "tags", placeholder: "例: LP, 営業資料" },
    ];

    $("#addTodo").addEventListener("click", async () => {
      const v = await modal("Todoを追加", FIELDS, { cat: "制作", pri: "中" });
      if (!v || !v.title) return;
      DB.todos.items.push({ id: uid(), ...v, done: false, createdAt: Date.now(), order: DB.todos.items.length });
      await saveDb("todos"); rerender();
    });

    $("#todoSearch").addEventListener("input", (e) => {
      TODO_FILTER.q = e.target.value;
      clearTimeout(this._t); this._t = setTimeout(rerender, 250);
    });
    $$("[data-cat]", main).forEach((b) => b.addEventListener("click", () => { TODO_FILTER.cat = b.dataset.cat; rerender(); }));

    $$("[data-check]", main).forEach((cb) => cb.addEventListener("change", async () => {
      const t = DB.todos.items.find((x) => x.id === cb.dataset.check);
      t.done = cb.checked; t.doneAt = cb.checked ? Date.now() : null;
      await saveDb("todos");
      if (cb.checked) await addXP(t.pri === "高" ? XP_RULES.todoHigh : t.pri === "低" ? XP_RULES.todoLow : XP_RULES.todoMid, "Todo完了");
      rerender();
    }));
    $$("[data-edit]", main).forEach((b) => b.addEventListener("click", async () => {
      const t = DB.todos.items.find((x) => x.id === b.dataset.edit);
      const v = await modal("Todoを編集", FIELDS, t);
      if (!v || !v.title) return;
      Object.assign(t, v); await saveDb("todos"); rerender();
    }));
    $$("[data-del]", main).forEach((b) => b.addEventListener("click", async () => {
      if (!(await confirmBox("このTodoを削除しますか？"))) return;
      DB.todos.items = DB.todos.items.filter((x) => x.id !== b.dataset.del);
      await saveDb("todos"); rerender();
    }));

    // ドラッグ&ドロップで並び替え
    let dragId = null;
    $$("#todoList [draggable]").forEach((row) => {
      row.addEventListener("dragstart", () => { dragId = row.dataset.id; row.style.opacity = ".4"; });
      row.addEventListener("dragend", () => { row.style.opacity = ""; });
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", async (e) => {
        e.preventDefault();
        if (!dragId || dragId === row.dataset.id) return;
        const arr = DB.todos.items;
        const from = arr.findIndex((x) => x.id === dragId);
        const to = arr.findIndex((x) => x.id === row.dataset.id);
        arr.splice(to, 0, arr.splice(from, 1)[0]);
        arr.forEach((x, i) => (x.order = i));
        await saveDb("todos"); rerender();
      });
    });
  },
};

// ===== タイマー（ポモドーロ + 勉強時間） =====

const POMO = { dur: 25 * 60, left: 25 * 60, run: false, subject: "一般", id: null, taskId: null, taskDate: null, taskTitle: "" };

// タスクからタイマーを開始（▶ボタン）。完了/終了時にそのタスクへ時間を自動加算する。
function startTaskTimer(task) {
  if (POMO.run) { toast("すでにタイマー実行中です", "x"); return; }
  POMO.taskId = task.id;
  POMO.taskDate = todayStr();
  POMO.taskTitle = task.title;
  POMO.subject = task.cat || "一般";
  POMO.left = POMO.dur;
  POMO.run = true;
  clearInterval(POMO.id); POMO.id = setInterval(pomoTick, 1000);
  toast(`タイマー開始: ${task.title}`, "play");
  go("time");
}

function pomoTick() {
  if (!POMO.run) return;
  POMO.left--;
  const el = $("#pomoTime");
  if (el) el.textContent = pomoFmt();
  if (POMO.left <= 0) pomoFinish();
}
function pomoFmt() {
  const m = Math.floor(POMO.left / 60), s = POMO.left % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
async function pomoFinish() {
  POMO.run = false;
  clearInterval(POMO.id);
  const min = Math.round(POMO.dur / 60);
  DB.study.logs.push({ id: uid(), date: todayStr(), min, subject: POMO.subject, src: "pomodoro" });
  await saveDb("study");
  // タスク連動なら、そのタスクに所要時間を加算
  if (POMO.taskId) {
    try {
      DB.day = await api("/api/tasks/" + POMO.taskId, { method: "PATCH", body: JSON.stringify({ date: POMO.taskDate, addMin: min }) });
    } catch (e) { /* タスクが消えていても勉強時間は記録済み */ }
  }
  await addXP(min, `ポモドーロ ${min}分`);
  toast(`${min}分 完了！${POMO.taskTitle ? POMO.taskTitle + " に記録" : "おつかれさま"}`, "timer");
  try { // 完了音
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .08;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 500);
  } catch {}
  POMO.left = POMO.dur;
  POMO.taskId = null; POMO.taskTitle = ""; POMO.taskDate = null;
  if (CURRENT === "time" || CURRENT === "home") rerender();
}

VIEWS.time = {
  title: "タイマー", icon: "timer",
  render(main) {
    const logs = DB.study.logs;
    const sum = (from) => logs.filter((l) => l.date >= from).reduce((s, l) => s + l.min, 0);
    const weekAgo = todayStr(-6), monthStart = todayStr().slice(0, 8) + "01";
    const total = logs.reduce((s, l) => s + l.min, 0);
    const subjects = ["一般", ...DB.learning.items.map((i) => i.name), "案件作業", "その他"];

    // 直近14日
    const days14 = [...Array(14)].map((_, i) => todayStr(i - 13));
    const mins14 = days14.map((d) => logs.filter((l) => l.date === d).reduce((s, l) => s + l.min, 0));

    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Focus</p><h1>タイマー</h1></div></div>

      <div class="stat-grid">
        ${statCard("timer", fmtMin(sum(todayStr())) || "0分", "今日")}
        ${statCard("calendar", fmtMin(sum(weekAgo)) || "0分", "直近7日")}
        ${statCard("chart", fmtMin(sum(monthStart)) || "0分", "今月")}
        ${statCard("trophy", (total / 60).toFixed(1), "総勉強時間", "時間")}
      </div>

      <div class="grid2">
        <div class="card" style="text-align:center">
          <h2 style="justify-content:center">${icon("timer", 15)} ポモドーロ</h2>
          <div class="seg" id="pomoDur">
            ${[25, 50, 90].map((m) => `<button class="${POMO.dur === m * 60 ? "active" : ""}" data-min="${m}">${m}分</button>`).join("")}
          </div>
          ${POMO.taskTitle ? `<p class="pill acc" style="margin:4px auto 0">${icon("play", 11)} ${esc(POMO.taskTitle)}</p>` : ""}
          <div class="pomo-time" id="pomoTime">${pomoFmt()}</div>
          <div style="margin-bottom:16px">
            <select id="pomoSubject" style="max-width:220px">${subjects.map((s) => `<option ${s === POMO.subject ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
          </div>
          <div style="display:flex;gap:10px;justify-content:center">
            <button class="btn" id="pomoStart" style="min-width:130px">${POMO.run ? icon("pause", 15) + " 一時停止" : icon("play", 15) + " スタート"}</button>
            <button class="btn ghost" id="pomoReset">${icon("rotate", 15)}</button>
          </div>
          <p class="hint" style="margin-top:14px">終了すると自動で勉強時間に記録され、XPが入ります</p>
        </div>

        <div class="card">
          <h2>${icon("chart", 15)} 直近14日の勉強時間</h2>
          ${vbars(mins14, days14.map(fmtShort), fmtMin)}
          <div style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px">
            <button class="btn ghost sm" id="manualAdd">${icon("plus", 14)} 手動で記録を追加</button>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>${icon("book", 15)} 科目別（累計）</h2>
        ${hbars(Object.entries(logs.reduce((m, l) => (m[l.subject] = (m[l.subject] || 0) + l.min, m), {}))
          .sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([label, value]) => ({ label, value })), fmtMin)}
      </div>`;

    $$("#pomoDur button").forEach((b) => b.addEventListener("click", () => {
      if (POMO.run) return toast("実行中は変更できません", "x");
      POMO.dur = POMO.left = Number(b.dataset.min) * 60; rerender();
    }));
    $("#pomoSubject").addEventListener("change", (e) => (POMO.subject = e.target.value));
    $("#pomoStart").addEventListener("click", () => {
      POMO.run = !POMO.run;
      if (POMO.run) { clearInterval(POMO.id); POMO.id = setInterval(pomoTick, 1000); }
      else clearInterval(POMO.id);
      rerender();
    });
    $("#pomoReset").addEventListener("click", () => { POMO.run = false; clearInterval(POMO.id); POMO.left = POMO.dur; POMO.taskId = null; POMO.taskTitle = ""; POMO.taskDate = null; rerender(); });

    $("#manualAdd").addEventListener("click", async () => {
      const v = await modal("勉強時間を記録", [
        { key: "date", label: "日付", type: "date", default: todayStr() },
        { key: "min", label: "分", type: "number", placeholder: "60" },
        { key: "subject", label: "科目", type: "select", options: subjects },
      ]);
      if (!v || !v.min) return;
      DB.study.logs.push({ id: uid(), date: v.date || todayStr(), min: v.min, subject: v.subject, src: "manual" });
      await saveDb("study");
      await addXP(Math.min(v.min, 120), "勉強を記録");
      rerender();
    });
  },
};

// ===== 日報 =====

let diaryTimer = null;
VIEWS.report = {
  title: "日報", icon: "file",
  async render(main) {
    const d = DB.day;
    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Daily Report</p><h1>日報</h1></div>
        <span class="pill acc">${fmtJP(todayStr())}</span></div>

      <div class="card">
        <h2>${icon("smile", 15)} 今日の気分</h2>
        <div class="mood-row">${MOODS.map((m) => `<button class="mood-btn ${d.mood === m ? "active" : ""}" data-mood="${m}">${icon(m, 22)}</button>`).join("")}</div>
      </div>

      <div class="card">
        <h2>${icon("file", 15)} 今日やったこと</h2>
        <textarea id="rDiary" placeholder="今日の作業・学習・気づき…">${esc(d.diary || "")}</textarea>
        <h2 style="margin-top:16px">${icon("rotate", 15)} 反省</h2>
        <textarea id="rReflect" style="min-height:70px" placeholder="改善したいこと…">${esc(d.reflect || "")}</textarea>
        <h2 style="margin-top:16px">${icon("target", 15)} 明日の目標</h2>
        <textarea id="rTomorrow" style="min-height:70px" placeholder="明日やること…">${esc(d.tomorrow || "")}</textarea>
        <p class="small muted" id="rState" style="margin:10px 2px 0;height:16px"></p>
      </div>

      <div class="card">
        <h2>${icon("calendar", 15)} 過去の日報</h2>
        <div id="pastReports"><p class="empty">読み込み中…</p></div>
      </div>`;

    const save = () => {
      const st = $("#rState"); st.textContent = "保存中…";
      clearTimeout(diaryTimer);
      diaryTimer = setTimeout(async () => {
        const hadDiary = !!DB.day.diary;
        DB.day = await api("/api/diary", { method: "PUT", body: JSON.stringify({
          diary: $("#rDiary").value, reflect: $("#rReflect").value, tomorrow: $("#rTomorrow").value,
        })});
        if (!hadDiary && DB.day.diary) await addXP(XP_RULES.diary, "日報を書いた");
        const st2 = $("#rState"); if (st2) st2.textContent = "保存済み";
      }, 700);
    };
    ["rDiary", "rReflect", "rTomorrow"].forEach((id) => $("#" + id).addEventListener("input", save));

    $$("[data-mood]").forEach((b) => b.addEventListener("click", async () => {
      const mood = DB.day.mood === b.dataset.mood ? "" : b.dataset.mood;
      DB.day = await api("/api/diary", { method: "PUT", body: JSON.stringify({ mood }) });
      $$("[data-mood]").forEach((x) => x.classList.toggle("active", x.dataset.mood === DB.day.mood));
    }));

    // 過去の日報
    const hist = await api("/api/history?days=30");
    const past = hist.filter((x) => x.date !== todayStr() && (x.diary || x.reflect));
    const wrap = $("#pastReports");
    if (wrap) wrap.innerHTML = past.map((x) => `
      <div style="padding:12px 4px;border-bottom:1px solid var(--line)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <strong style="font-size:13.5px">${fmtJP(x.date)}</strong>
          ${x.mood && ICONS[x.mood] ? `<span style="color:var(--accent)">${icon(x.mood, 16)}</span>` : ""}
          <span class="pill">${x.tasks.filter((t) => t.done).length}/${x.tasks.length} 完了</span>
        </div>
        ${x.diary ? `<p class="small" style="margin:2px 0;white-space:pre-wrap">${esc(x.diary)}</p>` : ""}
        ${x.reflect ? `<p class="small muted" style="margin:2px 0">反省: ${esc(x.reflect)}</p>` : ""}
      </div>`).join("") || '<p class="empty">過去の日報はまだありません</p>';
  },
};

// ===== 習慣 =====

VIEWS.habits = {
  title: "習慣", icon: "flame",
  render(main) {
    const H = DB.habits;
    const checks = H.checks;
    const isChecked = (id, date) => (checks[date] || []).includes(id);
    const habitStreak = (id) => {
      let n = 0, off = isChecked(id, todayStr()) ? 0 : -1;
      while (isChecked(id, todayStr(off - n))) n++;
      return n;
    };
    const last7 = [...Array(7)].map((_, i) => todayStr(i - 6));

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Habits</p><h1>習慣</h1></div>
        <button class="btn" id="addHabit">${icon("plus", 15)} 追加</button>
      </div>
      <div class="card">
        ${H.list.map((h) => `
          <div class="row" style="padding:13px 8px">
            <button class="icon-btn" data-toggle="${h.id}" style="width:38px;height:38px;border-radius:11px;
              ${isChecked(h.id, todayStr())
                ? "background:var(--accent);color:#fff"
                : "border:1.5px solid var(--line)"}">${icon("checkline", 17)}</button>
            <div style="flex:1;min-width:0">
              <div style="font-size:14.5px;font-weight:600">${esc(h.name)}</div>
              <div style="display:flex;gap:3.5px;margin-top:5px">
                ${last7.map((d) => `<span title="${d}" style="width:9px;height:9px;border-radius:3px;background:${isChecked(h.id, d) ? "var(--accent)" : "rgba(255,255,255,.09)"}"></span>`).join("")}
              </div>
            </div>
            <span class="pill ${habitStreak(h.id) >= 3 ? "acc" : ""}" style="display:inline-flex;gap:4px">${icon("flame", 12)} ${habitStreak(h.id)}日</span>
            <button class="icon-btn danger row-del" data-del="${h.id}">${icon("trash", 14)}</button>
          </div>`).join("") || '<p class="empty">習慣がありません</p>'}
      </div>
      <p class="hint">毎日チェックすると連続記録が伸び、XPが貯まります（+${XP_RULES.habit} XP/回）</p>`;

    $("#addHabit").addEventListener("click", async () => {
      const v = await modal("習慣を追加", [{ key: "name", label: "習慣の名前", type: "text", placeholder: "例: 朝ラン" }]);
      if (!v || !v.name) return;
      H.list.push({ id: uid(), name: v.name });
      await saveDb("habits"); rerender();
    });
    $$("[data-toggle]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.toggle, key = todayStr();
      checks[key] = checks[key] || [];
      const on = checks[key].includes(id);
      checks[key] = on ? checks[key].filter((x) => x !== id) : [...checks[key], id];
      await saveDb("habits");
      if (!on) await addXP(XP_RULES.habit, "習慣を実行");
      rerender();
    }));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!(await confirmBox("この習慣を削除しますか？"))) return;
      H.list = H.list.filter((x) => x.id !== b.dataset.del);
      await saveDb("habits"); rerender();
    }));
  },
};

// ===== メニュー（モバイル: その他） =====

VIEWS.menu = {
  title: "メニュー", icon: "grid",
  render(main) {
    const all = NAV_GROUPS.flatMap((g) => g.items);
    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Menu</p><h1>すべての機能</h1></div></div>
      <div class="menu-grid">
        ${all.map((v) => `<button class="menu-item" data-go="${v}">${icon(VIEWS[v].icon, 22)}${esc(VIEWS[v].title)}</button>`).join("")}
      </div>`;
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  },
};

// ===== 起動 =====

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadAll();
  } catch (e) {
    if (e.message !== "要ログイン") toast("読み込みに失敗: " + e.message, "x");
    return;
  }
  buildNav();
  renderLevel();
  window.addEventListener("hashchange", route);
  route();
});
