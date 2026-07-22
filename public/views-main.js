// LifeOS 画面: ナビ/ルーター + ホーム / Todo / タイマー / 日報 / 習慣 / メニュー
"use strict";

window.VIEWS = window.VIEWS || {};

const NAV_GROUPS = [
  { label: "メイン", items: ["home", "todo", "time", "reminders", "report", "habits"] },
  { label: "ワーク", items: ["projects", "outreach", "sales", "money", "portfolio", "learning"] },
  { label: "グロース", items: ["goals", "badges", "analytics", "calendar"] },
  { label: "", items: ["settings"] },
];
const BOTTOM_NAV = ["calendar", "todo", "home", "money", "menu"];
// 右ドロワーの構成（モバイルの「メニュー」から開く）
const DRAWER_GROUPS = [
  { label: "仕事", items: [["projects", "案件"], ["outreach", "営業"], ["money", "収支"], ["sales", "売上明細"], ["portfolio", "ポートフォリオ"]] },
  { label: "学習", items: [["learning", "学習管理"], ["time", "タイマー"]] },
  { label: "人生・習慣", items: [["goals", "目標管理"], ["badges", "実績・バッジ"], ["reminders", "リマインダー"]] },
  { label: "分析・レポート", items: [["report", "日報"], ["analytics", "分析・レポート"]] },
];

const CAT_COLORS = { "勉強": "var(--accent)", "制作": "var(--violet)", "営業": "var(--green)", "生活": "var(--amber)", "趣味": "var(--pink)" };
const CATS = Object.keys(CAT_COLORS);

// 予定の所要時間（分）を開始〜終了時刻から求める。片方でも欠ければ0。
const planMin = (t) => {
  if (!t.time || !t.endTime) return 0;
  const [h1, m1] = t.time.split(":").map(Number);
  const [h2, m2] = t.endTime.split(":").map(Number);
  const d = (h2 * 60 + m2) - (h1 * 60 + m1);
  return Number.isFinite(d) && d > 0 ? d : 0;
};
const PRIS = ["高", "中", "低"];

// ホームの「予定」カードで表示中の日付（null=今日）。左右スワイプ/矢印で前後の日へ。
let SCHED_DATE = null;
const SCHED_CACHE = {}; // 今日以外の日データのキャッシュ（date -> day）

// 日付(YYYY-MM-DD)に n 日足す
function addDays(date, n) {
  const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// 予定カードの日付見出し（今日以外）。明日/昨日は相対でも示す。
function schedDayLabel(date) {
  const diff = Math.round((new Date(date + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
  const rel = diff === 1 ? "明日 · " : diff === -1 ? "昨日 · " : "";
  return rel + fmtJP(date);
}
// 横スワイプ検出。左=過去/右=未来を cb("left"|"right") で通知（左右方向が明確なときだけ）。
function attachSwipe(el, cb) {
  let x0 = null, y0 = null;
  el.addEventListener("touchstart", (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) cb(dx > 0 ? "right" : "left");
  }, { passive: true });
}
// 優先度ピル。中/未設定は表示しない（一覧が煩雑になるのを避ける）
function priPill(pri) {
  if (pri === "高") return `<span class="pill red">高</span>`;
  if (pri === "低") return `<span class="pill">低</span>`;
  return "";
}
// 予定カード1行のHTML。タイマーボタンは今日のみ表示。
function schedItemHTML(t, isToday) {
  const catCol = t.cat ? (CAT_COLORS[t.cat] || "var(--muted)") : "var(--line)";
  const pm = planMin(t);
  const badges = [
    t.cat ? `<span class="pill" style="color:${catCol};background:color-mix(in srgb, ${catCol} 15%, transparent)">${esc(t.cat)}</span>` : "",
    priPill(t.pri),
    t.source === "template" ? '<span class="pill">定番</span>' : t.source === "ai" ? '<span class="pill acc">AI</span>' : "",
    ...(t.tags || []).map((tag) => `<span class="pill">#${esc(tag)}</span>`),
    t.spentMin ? `<span class="pill grn">${icon("timer", 10)} 実績 ${fmtHM(t.spentMin)}</span>` : "",
  ].join("");
  return `<div class="sched-item ${t.done ? "done" : ""}" data-row="${t.id}" style="--cat:${catCol}">
    <div class="sched-time">
      <span class="st-start ${t.time ? "" : "none"}">${t.time ? esc(t.time) : "—"}</span>
      ${t.endTime ? `<span class="st-end">${esc(t.endTime)}</span>` : ""}
      ${pm ? `<span class="st-dur">${fmtHM(pm)}</span>` : ""}
    </div>
    <input type="checkbox" class="checkbox" data-task="${t.id}" ${t.done ? "checked" : ""}>
    <div class="li-body" data-open="${t.id}" role="button" tabindex="0">
      <div class="li-title">${t.important ? `<span style="color:var(--amber)">${icon("star", 13, "filled")}</span> ` : ""}${esc(t.title)}</div>
      ${t.memo ? `<div class="li-memo">${esc(t.memo)}</div>` : ""}
      ${badges ? `<div class="li-tags">${badges}</div>` : ""}
    </div>
    ${isToday ? `<div class="li-right"><button class="icon-btn" data-play="${t.id}" aria-label="タイマー">${icon("timer", 15)}</button></div>` : ""}
  </div>`;
}

// タスクの詳細（情報を表示し、右上に編集・下に削除）。返り値: "edit" | "delete" | "toggle" | null
// ホームの予定・カレンダーの日別詳細の両方から使う共通モーダル。
function taskDetailModal(t, opts = {}) {
  return new Promise((resolve) => {
    const wrap = $("#modalWrap");
    const catCol = t.cat ? (CAT_COLORS[t.cat] || "var(--muted)") : "var(--line)";
    const pm = planMin(t);
    const range = t.time ? (esc(t.time) + (t.endTime ? " → " + esc(t.endTime) : "")) : "時刻の指定なし";
    const rows = [
      ["時間", range + (pm ? `（${fmtHM(pm)}）` : "")],
      t.spentMin ? ["実績", fmtHM(t.spentMin)] : null,
      t.cat ? ["カテゴリー", `<span class="pill" style="color:${catCol};background:color-mix(in srgb, ${catCol} 15%, transparent)">${esc(t.cat)}</span>`] : null,
      t.pri ? ["優先度", `<span class="pill ${t.pri === "高" ? "red" : ""}">${esc(t.pri)}</span>`] : null,
      (t.tags && t.tags.length) ? ["タグ", t.tags.map((x) => `<span class="pill">#${esc(x)}</span>`).join(" ")] : null,
      ["状態", t.done ? "✅ 完了" : "未完了"],
    ].filter(Boolean);
    wrap.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head">
        <h3>${esc(t.title)}</h3>
        <div style="display:flex;gap:6px;align-items:center">
          <button type="button" class="btn ghost sm" data-act="edit">${icon("edit", 14)} 編集</button>
          <button type="button" class="icon-btn" data-x>${icon("x", 17)}</button>
        </div>
      </div>
      <div class="td-info">
        ${rows.map(([k, v]) => `<div class="td-row"><span class="td-k">${esc(k)}</span><span class="td-v">${v}</span></div>`).join("")}
        ${t.memo ? `<div class="td-memo">${esc(t.memo)}</div>` : ""}
      </div>
      <button type="button" class="btn ghost sm" data-act="mit" style="width:100%;margin-top:4px;${t.important ? "color:var(--amber);border-color:var(--amber)" : ""}">
        ${icon("star", 14, t.important ? "filled" : "")} ${t.important ? "今日の最重要タスクを解除" : "今日の最重要タスクにする"}
      </button>
      <div class="modal-foot" style="justify-content:space-between">
        <button type="button" class="btn ghost sm" data-act="delete" style="color:var(--red)">${icon("trash", 14)} 削除</button>
        ${opts.canToggle ? `<button type="button" class="btn sm" data-act="toggle">${t.done ? "未完了に戻す" : "完了にする"}</button>` : `<button type="button" class="btn sm" data-x>閉じる</button>`}
      </div>
    </div></div>`;
    document.body.classList.add("modal-open");
    const close = (r) => { wrap.innerHTML = ""; document.body.classList.remove("modal-open"); resolve(r); };
    wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) close(null); });
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => close(null)));
    $$("[data-act]", wrap).forEach((b) => b.addEventListener("click", () => close(b.dataset.act)));
  });
}
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

// 上から引っ張って更新（pull-to-refresh）。AIが予定を更新した後もリロード不要で最新化できる。
function initPullToRefresh() {
  if ($("#ptr")) return;
  const ind = document.createElement("div");
  ind.id = "ptr";
  ind.innerHTML = `<div class="ptr-spin">${icon("rotate", 18)}</div>`;
  document.body.appendChild(ind);

  let startY = 0, pulling = false, dist = 0, refreshing = false;
  const TH = 72; // 発火しきい値(px)
  const canPull = () => !refreshing && window.scrollY <= 0 && !document.body.classList.contains("modal-open");

  window.addEventListener("touchstart", (e) => {
    if (!canPull()) { pulling = false; return; }
    startY = e.touches[0].clientY; pulling = true; dist = 0;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    dist = e.touches[0].clientY - startY;
    if (dist <= 0 || window.scrollY > 0) { ind.style.transform = ""; ind.classList.remove("ready"); if (window.scrollY > 0) pulling = false; return; }
    e.preventDefault(); // ネイティブの引っ張り更新を抑える
    const pull = Math.min(dist * 0.5, 90); // 抵抗をつける
    ind.style.transform = `translateX(-50%) translateY(${pull}px)`;
    ind.classList.toggle("ready", dist >= TH);
  }, { passive: false });

  const end = async () => {
    if (!pulling) return;
    pulling = false;
    if (dist >= TH && !refreshing) {
      refreshing = true;
      ind.classList.add("spinning"); ind.classList.remove("ready");
      ind.style.transform = "translateX(-50%) translateY(56px)";
      try { await loadAll(); rerender(); toast("最新の状態に更新しました", "rotate"); }
      catch (err) { if (err.message !== "要ログイン") toast("更新に失敗: " + err.message, "x"); }
      ind.classList.remove("spinning");
      refreshing = false;
    }
    ind.style.transform = "";
  };
  window.addEventListener("touchend", end, { passive: true });
  window.addEventListener("touchcancel", end, { passive: true });
}

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
    playTapAnim(b);
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
  // ドロワーが閉じきる前にページが切り替わると、閉じるアニメーション中のタップ演出が新しいページの上に残像として残るため、
  // 閉じるアニメーション(.3s)が終わってからページを切り替える
  $$("#drawer .drawer-item").forEach((b) => b.addEventListener("click", () => { playTapAnim(b); closeDrawer(); setTimeout(() => go(b.dataset.view), 300); }));
  attachSwipe($("#drawer"), (dir) => { if (dir === "right") closeDrawer(); }); // 右スワイプで閉じる
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
    SCHED_DATE = todayStr();                       // ホームは常に今日から表示
    for (const k in SCHED_CACHE) delete SCHED_CACHE[k];
    const done = DB.day.tasks.filter((t) => t.done).length;
    const total = DB.day.tasks.length;
    const dayPct = total ? Math.round((done / total) * 100) : 0;
    const studyToday = DB.study.logs.filter((l) => l.date === todayStr()).reduce((s, l) => s + l.min, 0);
    const salesToday = DB.sales.logs.filter((l) => l.date === todayStr()).reduce((s, l) => s + l.amount, 0);
    const acts = [...DB.xp.events].slice(-6).reverse();
    const dueRem = dueReminders();

    main.innerHTML = `
      <div class="greet">
        <div class="greet-top">
          <h1 class="greet-hello">おかえり、${esc(S.name || "しどう")} <span class="wave">👋</span></h1>
          <div class="greet-now">
            <span class="gn-date">${esc(fmtJP(todayStr()))}</span>
            <span id="clock" class="gn-time">${new Date().toTimeString().slice(0, 8)}</span>
          </div>
        </div>
        <div class="greet-sub" style="flex-wrap:wrap">
          <p>${esc(S.todayGoal) || "今日も最高の1日にしよう。"}</p>
          ${S.monthGoal ? `<p>${icon("target", 12)} 今月: ${esc(S.monthGoal)}</p>` : ""}
        </div>
      </div>

      ${dueRem.length ? `
      <div class="section-list"><div class="section">
        <p class="section-title" style="margin-top:16px;color:var(--red)">${icon("bell", 15)} リマインダー（${dueRem.length}）</p>
        <div style="padding-bottom:16px">
          ${dueRem.map((r) => `<div class="list-item">
            <input type="checkbox" class="checkbox" data-remdone="${r.id}">
            <div class="li-body">
              <div class="li-title">${esc(r.title)}</div>
              ${r.memo ? `<div class="li-memo">${esc(r.memo)}</div>` : ""}
            </div>
            <span class="pill red">${r.date < todayStr() ? "期限切れ" : esc(r.time || "")}</span>
          </div>`).join("")}
        </div>
      </div></div>` : ""}

      <div class="section-list">
      <div class="section">
        <div class="task-summary" style="padding:16px 0 18px">
          <div class="ts-main">
            <div class="ts-label">今日のタスク</div>
            <div class="ts-count"><span id="tsCount">${done}</span> <small>/ <span id="tsTotal">${total}</span> 完了</small></div>
            <div class="bar"><i id="tsBar" style="width:${dayPct}%"></i></div>
          </div>
          <button class="btn ghost sm" id="addTask">${icon("plus", 14)} 追加</button>
        </div>
      </div>
      <div class="section">
        <div id="schedCard" style="padding:16px 0 18px"><!-- 予定は mountSchedule() が日付ごとに描画 --></div>
      </div>
      </div>

      <div class="home-stats">
        ${homeStat("勉強時間 (今日)", studyToday ? fmtHM(studyToday) : "0m", "目標: " + fmtHM(S.dailyStudyGoalMin || 360), "timer")}
        ${homeStat("売上 (今日)", fmtYen(salesToday), "目標: " + fmtYen(S.dailySalesGoal || 20000), "yen")}
        ${homeStat("連続記録", streak() + "日", "ベスト: " + bestStreakVal() + "日", "flame")}
      </div>

      <div class="section-list">
      <div class="section">
        <div style="padding:16px 0 18px">
          <div class="card-head"><h2 class="section-title" style="margin-bottom:0">${icon("flame", 15)} 最近の活動</h2>
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
        </div>
      </div>
      </div>`;

    // 上部「今日のタスク」サマリーの数値を更新（常に今日基準）
    const refreshSummary = () => {
      const d = DB.day.tasks.filter((t) => t.done).length, tt = DB.day.tasks.length;
      const c = $("#tsCount"), tot = $("#tsTotal"), bar = $("#tsBar");
      if (c) c.textContent = d;
      if (tot) tot.textContent = tt;
      if (bar) bar.style.width = (tt ? Math.round((d / tt) * 100) : 0) + "%";
    };

    // 指定日のデータを取り直して予定カードを再描画
    const reloadSchedDay = async (date) => {
      try {
        if (date === todayStr()) DB.day = await api("/api/day");
        else SCHED_CACHE[date] = await api("/api/day?date=" + date);
      } catch (err) { toast(err.message, "x"); }
      await mountSchedule();
      refreshSummary();
    };

    // 完了時に実績時間（何時間やったか）を任意入力してもらう
    const askSpentTime = async (date, taskId) => {
      const day = date === todayStr() ? DB.day : SCHED_CACHE[date];
      const t = day && day.tasks.find((x) => x.id === taskId);
      if (!t) return;
      const cur = t.spentMin || planMin(t) || 0; // 既存の実績、無ければ予定の所要を初期値に
      const v = await modal("実績時間を記録（任意）", [
        { key: "h", label: "時間", type: "number", default: Math.floor(cur / 60), placeholder: "0" },
        { key: "m", label: "分", type: "number", default: cur % 60, placeholder: "0" },
      ]);
      if (!v) return; // キャンセル＝スキップ（完了はそのまま）
      const total = Math.max(0, (Number(v.h) || 0) * 60 + (Number(v.m) || 0));
      if (total === (t.spentMin || 0)) return;
      try { await api("/api/tasks/" + taskId, { method: "PATCH", body: JSON.stringify({ date, spentMin: total }) }); }
      catch (err) { toast(err.message, "x"); return; }
      await reloadSchedDay(date);
    };

    // 予定の編集（日付を変えると別の日へ移動）
    const editTask = async (date, t) => {
      const v = await modalWithCatAdd("予定を編集", [
        { key: "title", label: "やること", type: "text" },
        { key: "date", label: "日付", type: "date", default: date },
        { type: "timerange", label: "時間（開始 → 終了・任意）", startKey: "time", endKey: "endTime" },
        { key: "cat", label: "カテゴリー（任意）", type: "select", options: ["", ...CATS, ...(DB.categories.task || [])] },
        { key: "pri", label: "優先度（任意）", type: "select", options: ["", ...PRIS] },
        { key: "tags", label: "タグ（任意・カンマ区切り）", type: "tags", placeholder: "例: LP, 急ぎ" },
        { key: "memo", label: "メモ（やった内容など・任意）", type: "textarea", placeholder: "例: ヒーロー部分まで完成。残りは明日。" },
      ], { ...t, date });
      if (!v || !v.title) return;
      const newDate = v.date || date;
      const body = { title: v.title, time: v.time, endTime: v.endTime, cat: v.cat, pri: v.pri, tags: v.tags, memo: v.memo };
      try {
        if (newDate !== date) {
          await api("/api/tasks/" + t.id, { method: "PATCH", body: JSON.stringify({ ...body, date, moveTo: newDate }) });
          delete SCHED_CACHE[newDate];
          toast(fmtShort(newDate) + " に移動しました");
        } else {
          await api("/api/tasks/" + t.id, { method: "PATCH", body: JSON.stringify({ ...body, date }) });
        }
      } catch (err) { toast(err.message, "x"); return; }
      await reloadSchedDay(date);
    };
    const deleteTask = async (date, t) => {
      if (!(await confirmBox(`「${t.title}」を削除しますか？`))) return;
      try { await api("/api/tasks/" + t.id + "?date=" + date, { method: "DELETE" }); }
      catch (err) { toast(err.message, "x"); return; }
      await reloadSchedDay(date);
    };

    // 予定カードを SCHED_DATE の日付で描画。矢印/左右スワイプで前後の日へ（左=過去 / 右=未来）。
    async function mountSchedule() {
      const card = $("#schedCard");
      if (!card) return;
      const date = SCHED_DATE || todayStr();
      const isToday = date === todayStr();
      let day;
      try {
        day = isToday ? DB.day : (SCHED_CACHE[date] || (SCHED_CACHE[date] = await api("/api/day?date=" + date)));
      } catch (err) { card.innerHTML = `<p class="empty">読み込み失敗: ${esc(err.message)}</p>`; return; }
      if ((SCHED_DATE || todayStr()) !== date) return; // 取得中に日付が変わっていたら破棄
      const tasks = [...day.tasks].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
      card.innerHTML = `
        <div class="card-head sched-head">
          <button class="icon-btn" data-day="prev" aria-label="前の日（過去）">${icon("chevR", 16, "flip")}</button>
          <h2 class="sched-title">${icon("calendar", 15)} ${esc(isToday ? "今日の予定" : schedDayLabel(date))}</h2>
          <button class="icon-btn" data-day="next" aria-label="次の日（未来）">${icon("chevR", 16)}</button>
        </div>
        ${isToday ? "" : `<div class="sched-back"><button class="btn ghost sm" data-day="today">${icon("rotate", 13)} 今日に戻る</button></div>`}
        <div id="schedule" class="sched">${tasks.map((t) => schedItemHTML(t, isToday)).join("") || `<p class="empty">${isToday ? "今日の予定はまだありません。「追加」から入れましょう。" : "この日の予定はありません。"}</p>`}</div>`;

      // 日移動（矢印）
      $$("[data-day]", card).forEach((b) => b.addEventListener("click", () => {
        SCHED_DATE = b.dataset.day === "today" ? todayStr() : addDays(date, b.dataset.day === "prev" ? -1 : 1);
        mountSchedule();
      }));
      // 左右スワイプ（右へスワイプ=過去 / 左へスワイプ=未来）。#schedule は毎回作り直すのでリスナは重複しない。
      attachSwipe($("#schedule", card), (dir) => {
        SCHED_DATE = addDays(date, dir === "right" ? -1 : 1);
        mountSchedule();
      });

      // 完了トグル（＋実績入力）
      $$("#schedule [data-task]", card).forEach((cb) => cb.addEventListener("change", async () => {
        const row = cb.closest(".sched-item");
        row.classList.toggle("done", cb.checked);
        try {
          const d = await api("/api/tasks/" + cb.dataset.task, { method: "PATCH", body: JSON.stringify({ date, done: cb.checked }) });
          if (isToday) DB.day = d; else SCHED_CACHE[date] = d;
        } catch (err) { cb.checked = !cb.checked; row.classList.toggle("done", cb.checked); toast(err.message, "x"); return; }
        refreshSummary();
        if (cb.checked) {
          await addXP(XP_RULES.task, "タスク完了");
          if (day.tasks.find((x) => x.id === cb.dataset.task)?.important) await addXP(XP_RULES.mitBonus, "最重要タスク達成！");
          await askSpentTime(date, cb.dataset.task);
        }
      }));
      // タイマー（今日のみボタンあり）
      $$("#schedule [data-play]", card).forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const t = day.tasks.find((x) => x.id === b.dataset.play);
        if (t) startTaskTimer(t);
      }));
      // タイトルタップで詳細 → 編集/削除
      $$("#schedule [data-open]", card).forEach((el) => {
        const open = async () => {
          const t = day.tasks.find((x) => x.id === el.dataset.open);
          if (!t) return;
          const act = await taskDetailModal(t);
          if (act === "edit") await editTask(date, t);
          else if (act === "delete") await deleteTask(date, t);
          else if (act === "mit") {
            try { await api("/api/tasks/" + t.id, { method: "PATCH", body: JSON.stringify({ date, important: !t.important }) }); }
            catch (err) { toast(err.message, "x"); return; }
            await reloadSchedDay(date);
          }
        };
        el.addEventListener("click", open);
        el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      });
    }
    mountSchedule();

    // 追加（既定の日付は表示中の日。開始/終了時刻・カテゴリー・タグ・メモ）
    $("#addTask").addEventListener("click", async () => {
      const viewDate = SCHED_DATE || todayStr();
      const v = await modalWithCatAdd("やることを追加", [
        { key: "title", label: "やること", type: "text", placeholder: "例: LPデザイン制作" },
        { key: "date", label: "日付", type: "date", default: viewDate },
        { type: "timerange", label: "時間（開始 → 終了・任意）", startKey: "time", endKey: "endTime" },
        { key: "cat", label: "カテゴリー（任意）", type: "select", options: ["", ...CATS, ...(DB.categories.task || [])] },
        { key: "pri", label: "優先度（任意）", type: "select", options: ["", ...PRIS] },
        { key: "tags", label: "タグ（任意・カンマ区切り）", type: "tags", placeholder: "例: LP, 急ぎ" },
        { key: "memo", label: "メモ（任意）", type: "textarea", placeholder: "例: ◯◯様向け" },
      ]);
      if (!v || !v.title) return;
      const date = v.date || viewDate;
      try {
        const day = await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: v.title, date, time: v.time, endTime: v.endTime, cat: v.cat, pri: v.pri, tags: v.tags, memo: v.memo }) });
        if (date === todayStr()) DB.day = day; else SCHED_CACHE[date] = day;
      } catch (err) { toast(err.message, "x"); return; }
      // 追加先が今表示中の日ならカードを更新、そうでなければ知らせるだけ
      if (date === (SCHED_DATE || todayStr())) await reloadSchedDay(date);
      else toast(fmtShort(date) + " に追加しました");
    });

    $("#logActivity").addEventListener("click", logActivity);
    $$("[data-go]", main).forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
    $$("[data-remdone]").forEach((cb) => cb.addEventListener("change", async () => {
      const r = DB.reminders.items.find((x) => x.id === cb.dataset.remdone);
      if (!r) return;
      r.done = true;
      await saveDb("reminders"); rerender();
    }));
  },
};

// 学習ログのフォーム項目（分/科目に加え、メモ・タグ・参考リンクを残せる）
function studyFields(subjects, forDate, currentSubject) {
  const options = currentSubject && !subjects.includes(currentSubject) ? [currentSubject, ...subjects] : subjects;
  return [
    { key: "date", label: "日付", type: "date", default: forDate || todayStr() },
    { key: "min", label: "分", type: "number", placeholder: "60" },
    { key: "subject", label: "科目", type: "select", options },
    { key: "tags", label: "タグ（任意・カンマ区切り）", type: "tags" },
    { key: "link", label: "参考リンク（任意）", type: "url", placeholder: "https://…" },
    { key: "memo", label: "メモ（やった内容・詰まった点・次回やることなど）", type: "textarea" },
  ];
}
async function addStudyLog(v) {
  DB.study.logs.push({ id: uid(), date: v.date || todayStr(), min: v.min, subject: v.subject, tags: v.tags || [], link: v.link || "", memo: v.memo || "", src: "manual" });
  await saveDb("study");
  await addXP(Math.min(v.min, 120), "勉強を記録");
}

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
    const v = await modal("勉強を記録", studyFields(["一般", ...DB.learning.items.map((i) => i.name), "その他"]));
    if (!v || !v.min) return;
    await addStudyLog(v); toast("勉強を記録しました");
  } else if (pick === "sale") {
    const v = await modal("売上を記録", [
      { key: "amount", label: "売上金額（円）", type: "money", placeholder: "50000" },
      { key: "cost", label: "経費（任意・円）", type: "money", placeholder: "0" },
      { key: "source", label: "収入源", type: "select", options: SALE_SOURCES },
      { key: "date", label: "日付", type: "date", default: todayStr() },
      { key: "memo", label: "メモ", type: "text" },
    ]);
    if (!v || !v.amount) return;
    try { await api("/api/sales", { method: "POST", body: JSON.stringify({ amount: Math.round(v.amount), cost: Math.round(v.cost || 0), source: v.source, date: v.date || todayStr(), memo: v.memo }) }); }
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
      .filter((t) => !TODO_FILTER.q || (t.title + (t.tags || []).join()).toLowerCase().includes(TODO_FILTER.q.toLowerCase()));

    // 4セクションに振り分け（左上=高 / 右上=中 / 左下=低 / 右下=完了）
    const groups = { "高": [], "中": [], "低": [], done: [] };
    for (const t of items) {
      if (t.done) groups.done.push(t);
      else groups[PRIS.includes(t.pri) ? t.pri : "中"].push(t);
    }
    groups["高"].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    groups["中"].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    groups["低"].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    groups.done.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

    const rowHTML = (t) => {
      const over = t.due && t.due < todayStr() && !t.done;
      return `<div class="row ${t.done ? "done" : ""}" draggable="true" data-id="${t.id}">
        <span style="cursor:grab;color:var(--faint)" class="drag-h">${icon("grip", 15)}</span>
        <input type="checkbox" class="checkbox" data-check="${t.id}" ${t.done ? "checked" : ""}>
        <span class="row-title">${esc(t.title)}</span>
        <span class="row-meta">
          <span class="pill" style="color:${CAT_COLORS[t.cat]};background:color-mix(in srgb, ${CAT_COLORS[t.cat]} 14%, transparent)">${esc(t.cat)}</span>
          ${t.due ? `<span class="pill ${over ? "red" : ""}">${fmtShort(t.due)}</span>` : ""}
          ${(t.tags || []).map((tag) => `<span class="pill">#${esc(tag)}</span>`).join("")}
        </span>
        <button class="icon-btn row-edit" data-edit="${t.id}">${icon("edit", 14)}</button>
        <button class="icon-btn danger row-del" data-del="${t.id}">${icon("trash", 14)}</button>
      </div>`;
    };
    const SECTIONS = [
      { key: "高", label: "優先度 高", cls: "red" },
      { key: "中", label: "優先度 中", cls: "amb" },
      { key: "低", label: "優先度 低", cls: "" },
      { key: "done", label: "完了", cls: "grn" },
    ];
    const sectionHTML = (s) => `
      <div class="todo-sec sec-${s.key === "done" ? "done" : s.cls || "low"}" data-drop-sec="${s.key}">
        <div class="todo-sec-head"><span class="pill ${s.cls}">${esc(s.label)}</span><span class="todo-sec-n">${groups[s.key].length}</span></div>
        <div class="todo-sec-body" data-sec="${s.key}">
          ${groups[s.key].map(rowHTML).join("") || `<p class="empty sm">${s.key === "done" ? "まだありません" : "ここにドラッグ／「追加」で作成"}</p>`}
        </div>
      </div>`;

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Tasks</p><h1>Todo</h1></div>
        <button class="btn" id="addTodo">${icon("plus", 15)} 追加</button>
      </div>
      <div class="section-list"><div class="section" style="padding:16px 0 18px">
        <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
          <div style="position:relative;flex:1;min-width:180px">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--faint)">${icon("search", 15)}</span>
            <input type="text" id="todoSearch" placeholder="検索…" value="${esc(TODO_FILTER.q)}" style="padding-left:38px">
          </div>
        </div>
        <div class="tabs" style="margin-bottom:0">${["すべて", ...CATS, ...(DB.categories.task || [])].map((c) =>
          `<button class="tab ${TODO_FILTER.cat === c ? "active" : ""}" data-cat="${c}">${c}</button>`).join("")}</div>
      </div></div>
      <div class="todo-grid">${SECTIONS.map(sectionHTML).join("")}</div>`;

    const FIELDS = () => [
      { key: "title", label: "タイトル", type: "text", placeholder: "何をやる？" },
      { key: "cat", label: "カテゴリー", type: "select", options: [...CATS, ...(DB.categories.task || [])] },
      { key: "pri", label: "優先度", type: "select", options: PRIS },
      { key: "due", label: "締切", type: "date" },
      { key: "tags", label: "タグ", type: "tags", placeholder: "例: LP, 営業資料" },
    ];

    $("#addTodo").addEventListener("click", async () => {
      const v = await modalWithCatAdd("Todoを追加", FIELDS(), { cat: "制作", pri: "中" });
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
      const v = await modalWithCatAdd("Todoを編集", FIELDS(), t);
      if (!v || !v.title) return;
      Object.assign(t, v); await saveDb("todos"); rerender();
    }));
    $$("[data-del]", main).forEach((b) => b.addEventListener("click", async () => {
      if (!(await confirmBox("このTodoを削除しますか？"))) return;
      DB.todos.items = DB.todos.items.filter((x) => x.id !== b.dataset.del);
      await saveDb("todos"); rerender();
    }));

    // ドラッグ&ドロップ（PC）: 別セクションへ落とすと優先度/完了が変わる。行の上に落とすとその前へ並び替え。
    let dragId = null;
    const applyDrop = async (secKey, beforeId) => {
      const arr = DB.todos.items;
      const t = arr.find((x) => x.id === dragId);
      if (!t) return;
      const wasDone = t.done;
      if (secKey === "done") { t.done = true; t.doneAt = t.doneAt || Date.now(); }
      else { t.done = false; t.doneAt = null; t.pri = secKey; }
      arr.splice(arr.indexOf(t), 1);
      let at = beforeId ? arr.findIndex((x) => x.id === beforeId) : arr.length;
      if (at < 0) at = arr.length;
      arr.splice(at, 0, t);
      arr.forEach((x, i) => (x.order = i));
      await saveDb("todos");
      if (secKey === "done" && !wasDone) { await addXP(t.pri === "高" ? XP_RULES.todoHigh : t.pri === "低" ? XP_RULES.todoLow : XP_RULES.todoMid, "Todo完了"); }
      rerender();
    };
    $$(".row[draggable]", main).forEach((row) => {
      row.addEventListener("dragstart", (e) => { dragId = row.dataset.id; row.style.opacity = ".4"; e.dataTransfer.effectAllowed = "move"; });
      row.addEventListener("dragend", () => { row.style.opacity = ""; });
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!dragId || dragId === row.dataset.id) return;
        const sec = row.closest("[data-drop-sec]")?.dataset.dropSec;
        if (sec) applyDrop(sec, row.dataset.id);
      });
    });
    $$("[data-drop-sec]", main).forEach((zone) => {
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drop-over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("drop-over"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault(); zone.classList.remove("drop-over");
        if (!dragId) return;
        applyDrop(zone.dataset.dropSec, null); // セクション末尾へ
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

      <div class="section-list"><div class="grid2">
        <div style="text-align:center">
          <p class="section-title" style="justify-content:center">${icon("timer", 15)} ポモドーロ</p>
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

        <div>
          <p class="section-title">${icon("chart", 15)} 直近14日の勉強時間</p>
          ${vbars(mins14, days14.map(fmtShort), fmtMin)}
          <div style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px">
            <button class="btn ghost sm" id="manualAdd">${icon("plus", 14)} 手動で記録を追加</button>
          </div>
        </div>
      </div></div>

      <div class="section-list">
      <div class="section">
        <div style="padding:16px 0 18px">
          <p class="section-title">${icon("book", 15)} 科目別（累計）</p>
          ${hbars(Object.entries(logs.reduce((m, l) => (m[l.subject] = (m[l.subject] || 0) + l.min, m), {}))
            .sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([label, value]) => ({ label, value })), fmtMin)}
        </div>
      </div>
      </div>

      <div class="section-list">
      <div class="section">
        <div style="padding:16px 0 18px">
          <p class="section-title">${icon("book", 15)} 最近の学習ログ</p>
          ${[...logs].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))).slice(0, 15).map((l) => `
            <div class="list-item" data-log="${l.id}" role="button" tabindex="0" style="cursor:pointer">
              <span class="li-time">${esc(fmtShort(l.date))}</span>
              <div class="li-body">
                <div class="li-title">${esc(l.subject)} <span class="pill">${fmtMin(l.min)}</span></div>
                ${l.tags?.length ? `<div class="small muted">${l.tags.map((t) => "#" + esc(t)).join(" ")}</div>` : ""}
                ${l.memo ? `<div class="li-memo">${esc(l.memo)}</div>` : ""}
              </div>
              ${l.link ? `<a class="icon-btn" href="${esc(l.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${icon("external", 14)}</a>` : ""}
            </div>`).join("") || '<p class="empty">まだ記録がありません</p>'}
        </div>
      </div>
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
      const v = await modal("勉強時間を記録", studyFields(subjects));
      if (!v || !v.min) return;
      await addStudyLog(v);
      rerender();
    });

    $$("[data-log]").forEach((el) => el.addEventListener("click", async () => {
      const l = DB.study.logs.find((x) => x.id === el.dataset.log);
      if (!l) return;
      const v = await modal("学習ログを編集", studyFields(subjects, l.date, l.subject), l, { onDelete: "この学習ログを削除しますか？" });
      if (!v) return;
      if (v.__delete) {
        DB.study.logs = DB.study.logs.filter((x) => x.id !== l.id);
      } else {
        Object.assign(l, { date: v.date || l.date, min: v.min || l.min, subject: v.subject, tags: v.tags || [], link: v.link || "", memo: v.memo || "" });
      }
      await saveDb("study");
      rerender();
    }));
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

      <div class="section-list">
      <div class="section">
        <div style="padding:16px 0 18px">
          <p class="section-title">${icon("smile", 15)} 今日の気分</p>
          <div class="mood-row">${MOODS.map((m) => `<button class="mood-btn ${d.mood === m ? "active" : ""}" data-mood="${m}">${icon(m, 22)}</button>`).join("")}</div>
        </div>
      </div>

      <div class="section">
        <div style="padding:16px 0 18px">
          <p class="section-title">${icon("file", 15)} 今日やったこと</p>
          <textarea id="rDiary" placeholder="今日の作業・学習・気づき…">${esc(d.diary || "")}</textarea>
          <p class="section-title" style="margin-top:16px">${icon("rotate", 15)} 反省</p>
          <textarea id="rReflect" style="min-height:70px" placeholder="改善したいこと…">${esc(d.reflect || "")}</textarea>
          <p class="section-title" style="margin-top:16px">${icon("target", 15)} 明日の目標</p>
          <textarea id="rTomorrow" style="min-height:70px" placeholder="明日やること…">${esc(d.tomorrow || "")}</textarea>
          <p class="small muted" id="rState" style="margin:10px 2px 0;height:16px"></p>
        </div>
      </div>

      <div class="section">
        <div style="padding:16px 0 18px">
          <p class="section-title">${icon("calendar", 15)} 過去の日報</p>
          <div id="pastReports"><p class="empty">読み込み中…</p></div>
        </div>
      </div>
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
      <div class="section-list">
        ${H.list.map((h) => `
          <div class="list-item" style="padding:13px 2px">
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

// ===== リマインダー =====
// 定番タスクとは別に、一回きりの「いつ何をリマインドされたいか」を持てる軽量な通知機能。
// アプリを開いている間、期限が来たものをトースト＋（許可していれば）ブラウザ通知で知らせる。
// アプリを閉じている間の配信（真のプッシュ通知）は別途Service Worker/VAPIDが必要なため対象外。

const REMINDER_FIELDS = [
  { key: "title", label: "内容", type: "text", placeholder: "例: ○○さんに電話する" },
  { key: "date", label: "日付", type: "date", default: todayStr() },
  { key: "time", label: "時刻（任意）", type: "time" },
  { key: "memo", label: "メモ（任意）", type: "textarea" },
];
// 期限が来ていて未完了のリマインダー（日付昇順）
function dueReminders() {
  if (!DB.reminders) return [];
  const d = todayStr(), hm = new Date().toTimeString().slice(0, 5);
  return DB.reminders.items
    .filter((r) => !r.done && (r.date < d || (r.date === d && (!r.time || r.time <= hm))))
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}
const REMINDER_NOTIFIED = new Set(); // このセッション中に一度通知済みのID（再読込のたびリセット）
function checkReminders() {
  const due = dueReminders();
  let fresh = false;
  for (const r of due) {
    if (REMINDER_NOTIFIED.has(r.id)) continue;
    REMINDER_NOTIFIED.add(r.id);
    fresh = true;
    toast("⏰ " + r.title, "bell");
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification("LifeOS リマインダー", { body: r.title + (r.memo ? "\n" + r.memo : ""), tag: "lifeos-rem-" + r.id }); } catch (e) {}
    }
  }
  // ホーム/リマインダー画面が開いていれば、モーダル操作中でなければバナーに反映
  if (fresh && (CURRENT === "home" || CURRENT === "reminders") && !$("#modalWrap .overlay")) rerender();
}

VIEWS.reminders = {
  title: "リマインダー", icon: "bell",
  render(main) {
    const items = [...DB.reminders.items].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    const open = items.filter((r) => !r.done);
    const done = items.filter((r) => r.done);
    const hasNotifApi = typeof Notification !== "undefined";
    const remRow = (r) => {
      const overdue = !r.done && (r.date < todayStr() || (r.date === todayStr() && r.time && r.time <= new Date().toTimeString().slice(0, 5)));
      return `<div class="list-item" data-rem="${r.id}" role="button" tabindex="0" style="cursor:pointer">
        <input type="checkbox" class="checkbox" data-remchk="${r.id}" ${r.done ? "checked" : ""}>
        <div class="li-body">
          <div class="li-title" style="${r.done ? "text-decoration:line-through;opacity:.6" : ""}">${esc(r.title)}</div>
          ${r.memo ? `<div class="li-memo">${esc(r.memo)}</div>` : ""}
        </div>
        <span class="pill ${overdue ? "red" : ""}">${fmtShort(r.date)}${r.time ? " " + esc(r.time) : ""}</span>
      </div>`;
    };

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Reminders</p><h1>リマインダー</h1></div>
        <button class="btn" id="add">${icon("plus", 15)} 追加</button>
      </div>
      ${hasNotifApi && Notification.permission !== "granted" ? `
      <div class="section-list"><div class="section">
        <div style="padding:14px 2px;display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap">
          <p class="small muted" style="margin:0;flex:1;min-width:200px">アプリを開いている間、期限が来たリマインダーをブラウザ通知でも知らせます。</p>
          <button class="btn ghost sm" id="notifEnable" style="white-space:nowrap">${icon("bell", 14)} 通知を有効化</button>
        </div>
      </div></div>` : ""}
      <div class="section-list">
      <div class="section">
        <p class="section-title" style="margin-top:16px">${icon("bell", 15)} 未対応（${open.length}）</p>
        <div style="padding-bottom:16px">${open.length ? open.map(remRow).join("") : '<p class="empty">リマインダーはありません。</p>'}</div>
      </div>
      ${done.length ? `<div class="section">
        <p class="section-title" style="margin-top:16px">${icon("checkline", 15)} 完了済み</p>
        <div style="padding-bottom:16px">${done.slice(-10).reverse().map(remRow).join("")}</div>
      </div>` : ""}
      </div>`;

    $("#add").addEventListener("click", async () => {
      const v = await modal("リマインダーを追加", REMINDER_FIELDS, { date: todayStr() });
      if (!v || !v.title) return;
      DB.reminders.items.push({ id: uid(), ...v, done: false });
      await saveDb("reminders"); rerender();
    });
    $("#notifEnable")?.addEventListener("click", async () => {
      const perm = await Notification.requestPermission();
      toast(perm === "granted" ? "通知を有効にしました" : "通知が許可されませんでした", perm === "granted" ? "checkline" : "x");
      rerender();
    });
    $$("[data-remchk]").forEach((cb) => cb.addEventListener("click", (e) => e.stopPropagation()));
    $$("[data-remchk]").forEach((cb) => cb.addEventListener("change", async () => {
      const r = DB.reminders.items.find((x) => x.id === cb.dataset.remchk);
      r.done = cb.checked;
      await saveDb("reminders"); rerender();
    }));
    $$("[data-rem]").forEach((el) => el.addEventListener("click", async () => {
      const r = DB.reminders.items.find((x) => x.id === el.dataset.rem);
      if (!r) return;
      const v = await modal("リマインダーを編集", REMINDER_FIELDS, r, { onDelete: "このリマインダーを削除しますか？" });
      if (!v) return;
      if (v.__delete) DB.reminders.items = DB.reminders.items.filter((x) => x.id !== r.id);
      else Object.assign(r, v);
      await saveDb("reminders"); rerender();
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
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => { playTapAnim(b); go(b.dataset.go); }));
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
  initPullToRefresh();
  window.addEventListener("hashchange", route);
  route();
  checkReminders();
  setInterval(checkReminders, 30000); // アプリを開いている間、30秒おきに期限切れリマインダーを確認
});
