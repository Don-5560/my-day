// LifeOS 画面: ナビ/ルーター + ホーム / Todo / タイマー / 日報 / 習慣 / メニュー
"use strict";

window.VIEWS = window.VIEWS || {};

const NAV_GROUPS = [
  { label: "メイン", items: ["home", "todo", "time", "report", "habits"] },
  { label: "ワーク", items: ["projects", "outreach", "sales", "portfolio", "learning"] },
  { label: "グロース", items: ["goals", "badges", "analytics", "calendar"] },
  { label: "", items: ["settings"] },
];
const BOTTOM_NAV = ["home", "todo", "time", "report", "menu"];

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
  $("#bottomNav").innerHTML = BOTTOM_NAV.map((v) =>
    `<button class="nav-item" data-view="${v}">${icon(VIEWS[v].icon, 20)}<span>${esc(VIEWS[v].title)}</span></button>`).join("");
  $$(".nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
}

// ===== ホーム =====

VIEWS.home = {
  title: "ホーム", icon: "home",
  render(main) {
    const S = DB.settings;
    const tasks = DB.day.tasks, done = tasks.filter((t) => t.done).length;
    const dayPct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const studyToday = DB.study.logs.filter((l) => l.date === todayStr()).reduce((s, l) => s + l.min, 0);
    const salesMonth = DB.sales.logs.filter((l) => monthKey(l.date) === monthKey(todayStr())).reduce((s, l) => s + l.amount, 0);
    const activeProjects = DB.projects.items.filter((p) => (p.progress || 0) < 100).length;
    const pf = DB.portfolio.items;
    const pfPct = pf.length ? Math.round(pf.reduce((s, p) => s + (p.progress || 0), 0) / pf.length) : 0;
    const L = levelInfo();

    // 今週やること（期限が今日〜6日後 or 期限切れの未完了Todo）
    const week = DB.todos.items
      .filter((t) => !t.done && t.due && t.due <= todayStr(6))
      .sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8);

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Dashboard</p><h1>${fmtJP(todayStr())}</h1></div>
        <div class="clock" id="clock"></div>
      </div>

      <div class="stat-grid">
        ${statCard("zap", `Lv ${L.lvl}`, `${L.cur} / ${L.need} XP`)}
        ${statCard("flame", streak(), "連続記録", "日")}
        ${statCard("timer", fmtMin(studyToday) || "0分", "今日の勉強")}
        ${statCard("yen", fmtYen(salesMonth), "今月の売上")}
        ${statCard("briefcase", activeProjects, "進行中の案件", "件")}
        ${statCard("layers", pfPct + "%", "ポートフォリオ完成率")}
      </div>

      <div class="grid2">
        <div class="card" id="goalCard">
          <h2>${icon("target", 15)} 目標</h2>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div><span class="pill acc">今日</span><p style="margin:6px 0 0;font-size:14.5px">${esc(S.todayGoal) || '<span class="muted">未設定 — クリックして設定</span>'}</p></div>
            <div><span class="pill">今月</span><p style="margin:6px 0 0;font-size:14.5px">${esc(S.monthGoal) || '<span class="muted">未設定</span>'}</p></div>
          </div>
        </div>

        <div class="card">
          <h2>${icon("check", 15)} 今日のやること <span style="margin-left:auto" class="pill ${dayPct === 100 && tasks.length ? "grn" : "acc"}">${done}/${tasks.length}</span></h2>
          <div id="dayTasks">${tasks.map((t) => `
            <label class="row ${t.done ? "done" : ""}">
              <input type="checkbox" class="checkbox" data-task="${t.id}" ${t.done ? "checked" : ""}>
              <span class="row-title">${esc(t.title)}</span>
              ${t.source === "template" ? '<span class="pill">定番</span>' : t.source === "ai" ? '<span class="pill acc">AI</span>' : ""}
            </label>`).join("") || '<p class="empty">今日のタスクはまだありません</p>'}
          </div>
          <form id="quickAdd" style="display:flex;gap:8px;margin-top:10px">
            <input type="text" placeholder="やることを追加…" id="quickInput" autocomplete="off">
            <button class="btn sm" type="submit">${icon("plus", 14)}</button>
          </form>
        </div>
      </div>

      <div class="card">
        <h2>${icon("calendar", 15)} 今週やること</h2>
        ${week.map((t) => {
          const over = t.due < todayStr();
          return `<div class="row">
            <span style="color:${CAT_COLORS[t.cat] || "var(--muted)"}">${icon("chevR", 15)}</span>
            <span class="row-title">${esc(t.title)}</span>
            <span class="pill ${over ? "red" : ""}">${over ? "期限切れ " : ""}${fmtShort(t.due)}</span>
          </div>`;
        }).join("") || '<p class="empty">今週が期限のTodoはありません。Todoタブで期限を付けると、ここに出ます。</p>'}
      </div>`;

    // 時計
    const tick = () => { const c = $("#clock"); if (c) { const d = new Date(); c.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":"); } };
    tick();

    // 目標編集
    $("#goalCard").addEventListener("click", async () => {
      const v = await modal("目標を設定", [
        { key: "todayGoal", label: "今日の目標", type: "text", placeholder: "例: LP制作を2時間進める" },
        { key: "monthGoal", label: "今月の目標", type: "text", placeholder: "例: 初案件を獲得する" },
      ], S);
      if (!v) return;
      Object.assign(S, v); await saveDb("settings"); rerender();
    });

    // 今日のタスク
    $$("#dayTasks [data-task]").forEach((cb) => cb.addEventListener("change", async () => {
      DB.day = await api("/api/tasks/" + cb.dataset.task, { method: "PATCH", body: JSON.stringify({ done: cb.checked }) });
      if (cb.checked) await addXP(XP_RULES.task, "タスク完了");
      rerender();
    }));
    $("#quickAdd").addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = $("#quickInput").value.trim();
      if (!v) return;
      DB.day = await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: v }) });
      rerender();
    });
  },
};
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

const POMO = { dur: 25 * 60, left: 25 * 60, run: false, subject: "一般", id: null };

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
  await addXP(min, `ポモドーロ ${min}分`);
  toast(`${min}分 完了！おつかれさま`, "timer");
  try { // 完了音
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .08;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 500);
  } catch {}
  POMO.left = POMO.dur;
  if (CURRENT === "time") rerender();
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
    $("#pomoReset").addEventListener("click", () => { POMO.run = false; clearInterval(POMO.id); POMO.left = POMO.dur; rerender(); });

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
