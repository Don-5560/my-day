// LifeOS 画面: ナビ/ルーター + ホーム / Todo / タイマー / 日報 / 習慣 / メニュー
"use strict";

window.VIEWS = window.VIEWS || {};

const NAV_GROUPS = [
  { label: "メイン", items: ["home", "todo", "time", "reminders", "report", "habits"] },
  { label: "ワーク", items: ["projects", "outreach", "sales", "money", "portfolio", "learning", "notes"] },
  { label: "グロース", items: ["goals", "badges", "analytics", "calendar"] },
  { label: "", items: ["settings"] },
];
const BOTTOM_NAV = ["calendar", "todo", "home", "money", "menu"];
// 右ドロワーの構成（モバイルの「メニュー」から開く）
const DRAWER_GROUPS = [
  { label: "仕事", items: [["projects", "案件"], ["outreach", "営業"], ["money", "収支"], ["sales", "売上明細"], ["portfolio", "ポートフォリオ"]] },
  { label: "学習", items: [["learning", "学習管理"], ["time", "タイマー"], ["notes", "ノート"]] },
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
// iCloudカレンダーの予定を取得（未接続・失敗時は静かに空配列を返す。読み取り専用表示にしか使わない）
async function fetchIcloudEvents(from, to) {
  try {
    const r = await api(`/api/icloud/events?from=${from}&to=${to}`);
    return r.items || [];
  } catch { return []; }
}
// iCloudの予定1行のHTML（読み取り専用・タップ不可。LifeOSのタスクと区別できるよう紫のカテゴリー色にする）
function icloudEventHTML(ev) {
  const timeLabel = ev.allDay ? "終日" : new Date(ev.start).toTimeString().slice(0, 5);
  return `<div class="sched-item ical-item" style="--cat:var(--violet)">
    <div class="sched-time"><span class="st-start">${esc(timeLabel)}</span></div>
    <div class="li-body">
      <div class="li-title">${icon("calendar", 12)} ${esc(ev.title)}</div>
      <div class="li-tags"><span class="pill vio">${esc(ev.calendarName)}</span></div>
    </div>
  </div>`;
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

// ホーム冒頭の挨拶タップで今日/今月の目標をその場で編集（設定ページの奥に埋もれて使われていなかったため導線を追加）
function goalQuickModal() {
  return new Promise((resolve) => {
    const wrap = $("#modalWrap");
    wrap.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head"><h3>目標を設定</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <label class="f-label">今日の目標</label>
      <input type="text" id="gqToday" value="${esc(DB.settings.todayGoal || "")}" placeholder="例: LP制作を2時間">
      <label class="f-label">今月の目標</label>
      <input type="text" id="gqMonth" value="${esc(DB.settings.monthGoal || "")}" placeholder="例: 初案件を獲得">
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-x>キャンセル</button>
        <button type="button" class="btn" id="gqSave">${icon("checkline", 14)} 保存</button>
      </div>
    </div></div>`;
    document.body.classList.add("modal-open");
    const close = (v) => { wrap.innerHTML = ""; document.body.classList.remove("modal-open"); resolve(v); };
    wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) close(false); });
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => close(false)));
    $("#gqSave", wrap).addEventListener("click", async () => {
      DB.settings.todayGoal = $("#gqToday", wrap).value.trim();
      DB.settings.monthGoal = $("#gqMonth", wrap).value.trim();
      await saveDb("settings");
      close(true);
    });
  });
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
        <button type="button" class="greet-sub greet-goal" id="goalQuick" style="flex-wrap:wrap">
          <p>${esc(S.todayGoal) || "今日の目標を設定する"}</p>
          ${S.monthGoal ? `<p>${icon("target", 12)} 今月: ${esc(S.monthGoal)}</p>` : ""}
          ${icon("edit", 12, "greet-goal-edit")}
        </button>
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
      let day, icalEvents;
      try {
        [day, icalEvents] = await Promise.all([
          isToday ? DB.day : (SCHED_CACHE[date] || (SCHED_CACHE[date] = await api("/api/day?date=" + date))),
          fetchIcloudEvents(date, date),
        ]);
      } catch (err) { card.innerHTML = `<p class="empty">読み込み失敗: ${esc(err.message)}</p>`; return; }
      if ((SCHED_DATE || todayStr()) !== date) return; // 取得中に日付が変わっていたら破棄
      const tasks = [...day.tasks].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
      const rows = [
        ...tasks.map((t) => ({ time: t.time || "99:99", html: schedItemHTML(t, isToday) })),
        ...icalEvents.map((ev) => ({ time: ev.allDay ? "00:00" : new Date(ev.start).toTimeString().slice(0, 5), html: icloudEventHTML(ev) })),
      ].sort((a, b) => a.time.localeCompare(b.time));
      card.innerHTML = `
        <div class="card-head sched-head">
          <button class="icon-btn" data-day="prev" aria-label="前の日（過去）">${icon("chevR", 16, "flip")}</button>
          <h2 class="sched-title">${icon("calendar", 15)} ${esc(isToday ? "今日の予定" : schedDayLabel(date))}</h2>
          <button class="icon-btn" data-day="next" aria-label="次の日（未来）">${icon("chevR", 16)}</button>
        </div>
        ${isToday ? "" : `<div class="sched-back"><button class="btn ghost sm" data-day="today">${icon("rotate", 13)} 今日に戻る</button></div>`}
        <div id="schedule" class="sched">${rows.map((r) => r.html).join("") || `<p class="empty">${isToday ? "今日の予定はまだありません。「追加」から入れましょう。" : "この日の予定はありません。"}</p>`}</div>`;

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
    $("#goalQuick").addEventListener("click", async () => { if (await goalQuickModal()) rerender(); });
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

// ===== 学習ノート（自由記述・部分装飾対応の本文を持つ学習ログ） =====

let NOTE_FILTER = { subject: "すべて", tag: "", from: "", to: "" };
const NOTE_TEXT_COLORS = [
  { label: "デフォルト", value: "" },
  { label: "グレー", value: "#787774" },
  { label: "茶色", value: "#9F6B53" },
  { label: "オレンジ", value: "#D9730D" },
  { label: "黄色", value: "#CB912F" },
  { label: "緑", value: "#448361" },
  { label: "青", value: "#337EA9" },
  { label: "紫", value: "#9065B0" },
  { label: "ピンク", value: "#C14C8A" },
  { label: "赤", value: "#D44C47" },
];
const NOTE_BG_COLORS = [
  { label: "なし", value: "" },
  { label: "グレー", value: "#F1F1EF" },
  { label: "茶色", value: "#F4EEEE" },
  { label: "オレンジ", value: "#FAEBDD" },
  { label: "黄色", value: "#FBF3DB" },
  { label: "緑", value: "#EDF3EC" },
  { label: "青", value: "#E7F3F8" },
  { label: "紫", value: "#F6F3F9" },
  { label: "ピンク", value: "#FAF1F5" },
  { label: "赤", value: "#FDEBEC" },
];
const NOTE_ALLOWED_TAGS = new Set(["DIV", "BR", "SPAN", "B", "STRONG", "I", "EM", "UL", "OL", "LI", "P", "A"]);

// 選択範囲にインラインstyleを適用（execCommandに頼らず、自前でRangeを包む。ブラウザ間の挙動差を避けるため）
function applyNoteStyle(styleProps) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  Object.entries(styleProps).forEach(([k, v]) => (span.style[k] = v));
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.addRange(newRange);
}

// 選択範囲をリンク化する（インラインAaパネルの🔗ボタン用）
function applyInlineLink() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { toast("リンクにする文字を選択してください", "x"); return; }
  const url = window.prompt("リンク先のURL");
  if (!url) return;
  const range = sel.getRangeAt(0);
  const a = document.createElement("a");
  a.href = url;
  try {
    range.surroundContents(a);
  } catch {
    const frag = range.extractContents();
    a.appendChild(frag);
    range.insertNode(a);
  }
  sel.removeAllRanges();
}

// 保存前にHTMLをホワイトリストでサニタイズ（許可外タグは中身だけ残して展開、style属性もcolor/font-size/font-weightのみ許可）
function sanitizeNoteHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  const clean = (root) => {
    [...root.childNodes].forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        clean(node);
        if (!NOTE_ALLOWED_TAGS.has(node.tagName)) {
          if (node.tagName === "SCRIPT" || node.tagName === "STYLE") node.remove();
          else node.replaceWith(...node.childNodes);
          return;
        }
        const { color, fontSize, fontWeight, fontStyle, textDecoration, fontFamily, backgroundColor } = node.style;
        const href = node.tagName === "A" ? node.getAttribute("href") : null;
        [...node.attributes].forEach((a) => node.removeAttribute(a.name));
        if (color) node.style.color = color;
        if (fontSize) node.style.fontSize = fontSize;
        if (fontWeight) node.style.fontWeight = fontWeight;
        if (fontStyle) node.style.fontStyle = fontStyle;
        if (textDecoration) node.style.textDecoration = textDecoration;
        if (fontFamily) node.style.fontFamily = fontFamily;
        if (backgroundColor) node.style.backgroundColor = backgroundColor;
        if (href && /^(https?:|mailto:)/i.test(href)) {
          node.setAttribute("href", href);
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }
      } else if (node.nodeType !== Node.TEXT_NODE) {
        node.remove();
      }
    });
  };
  clean(tmp);
  return tmp.innerHTML;
}
// 一覧プレビュー用にHTMLからプレーンテキストを抜き出す
function stripHtmlPreview(html, maxLen = 100) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  const text = (tmp.textContent || "").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

// ===== ブロック型本文エディタ（Notionのような「/」コマンド・ドラッグ並び替え） =====

const NOTE_BLOCK_TYPES = [
  { type: "paragraph", label: "テキスト", glyph: "T" },
  { type: "heading", level: 1, label: "見出し1", glyph: "H1" },
  { type: "heading", level: 2, label: "見出し2", glyph: "H2" },
  { type: "heading", level: 3, label: "見出し3", glyph: "H3" },
  { type: "bulleted", label: "箇条書きリスト", glyph: "•" },
  { type: "numbered", label: "番号付きリスト", glyph: "1." },
  { type: "checkbox", label: "ToDoリスト", glyph: "☑" },
  { type: "toggle", label: "トグルリスト", glyph: "▸" },
  { type: "quote", label: "引用", glyph: "❝" },
  { type: "callout", label: "コールアウト", glyph: "💡" },
  { type: "code", label: "コード", glyph: "<>" },
  { type: "image", label: "画像", glyph: "🖼" },
  { type: "divider", label: "区切り線", glyph: "—" },
];

// ツールバー「+」ブロックピッカーシート用のカテゴリ分け（Notion風。【データベース】カテゴリは仕様書の指示により実装しない）
const NOTE_PICKER_CATEGORIES = [
  {
    label: "基本",
    items: [
      { type: "paragraph", label: "テキスト", glyph: "T" },
      { type: "heading", level: 1, label: "見出し1", glyph: "H1" },
      { type: "heading", level: 2, label: "見出し2", glyph: "H2" },
      { type: "heading", level: 3, label: "見出し3", glyph: "H3" },
      { type: "heading", level: 4, label: "見出し4", glyph: "H4" },
      { type: "bulleted", label: "箇条書きリスト", glyph: "•" },
      { type: "numbered", label: "番号付きリスト", glyph: "1." },
      { type: "checkbox", label: "ToDoリスト", glyph: "☑" },
      { type: "toggle", label: "トグルリスト", glyph: "▸" },
      { type: "callout", label: "コールアウト", glyph: "💡" },
      { type: "quote", label: "引用", glyph: "❝" },
      { type: "divider", label: "区切り線", glyph: "—" },
    ],
  },
  {
    label: "メディア",
    items: [
      { type: "image", label: "画像", icon: "image" },
      { type: "code", label: "コード", icon: "code" },
      { type: "soon", label: "動画", icon: "playSquare" },
      { type: "soon", label: "オーディオ", icon: "volume" },
      { type: "soon", label: "ファイル&メディア", icon: "paperclip" },
      { type: "soon", label: "Webブックマーク", icon: "bookmark" },
    ],
  },
];

// 旧形式(body=フラットHTML / memo=プレーンテキスト)から段落ブロック配列へ移行する
function migrateNoteToBlocks(note) {
  if (Array.isArray(note.blocks) && note.blocks.length) return note.blocks.map((b) => ({ ...b, id: b.id || uid() }));
  if (note.body) {
    const tmp = document.createElement("div");
    tmp.innerHTML = note.body;
    const lines = [...tmp.childNodes].filter((n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
    if (lines.length) return lines.map((n) => ({ id: uid(), type: "paragraph", html: n.nodeType === 1 ? n.innerHTML : esc(n.textContent) }));
    return [{ id: uid(), type: "paragraph", html: note.body }];
  }
  if (note.memo) return [{ id: uid(), type: "paragraph", html: esc(note.memo) }];
  return [{ id: uid(), type: "paragraph", html: "" }];
}

// 1ブロック行のHTML。番号付きリストの番号はDOM挿入後にrenumberNoteBlocks()で振り直す
function noteBlockRowHTML(b) {
  if (b.type === "divider") {
    return `<div class="note-block type-divider" data-block="${b.id}" data-type="divider">
      <span class="note-block-handle" data-drag>${icon("grip", 14)}</span>
      <hr class="note-divider">
      <button type="button" class="icon-btn danger note-block-del" data-block-del>${icon("x", 14)}</button>
    </div>`;
  }
  if (b.type === "image") {
    return `<div class="note-block type-image" data-block="${b.id}" data-type="image">
      <span class="note-block-handle" data-drag>${icon("grip", 14)}</span>
      <div class="note-image-wrap">
        ${b.url
          ? `<img src="${esc(b.url)}" class="note-image-img" alt="">`
          : `<div class="note-image-empty">${icon("image", 18)}<input type="url" class="note-image-url" placeholder="画像URLを入力してEnter"></div>`}
      </div>
      <button type="button" class="icon-btn danger note-block-del" data-block-del>${icon("x", 14)}</button>
    </div>`;
  }
  if (b.type === "code") {
    return `<div class="note-block type-code" data-block="${b.id}" data-type="code">
      <span class="note-block-handle" data-drag>${icon("grip", 14)}</span>
      <div class="note-block-text note-code-text" contenteditable="true" data-placeholder="コードを入力">${b.html || ""}</div>
      <button type="button" class="icon-btn danger note-block-del" data-block-del>${icon("x", 14)}</button>
    </div>`;
  }
  if (b.type === "callout") {
    return `<div class="note-block type-callout" data-block="${b.id}" data-type="callout">
      <span class="note-block-handle" data-drag>${icon("grip", 14)}</span>
      <button type="button" class="note-callout-emoji" data-callout-emoji>${esc(b.emoji || "💡")}</button>
      <div class="note-block-text" contenteditable="true" data-placeholder="コールアウト">${b.html || ""}</div>
    </div>`;
  }
  if (b.type === "toggle") {
    return `<div class="note-block type-toggle${b.open === false ? "" : " open"}" data-block="${b.id}" data-type="toggle">
      <span class="note-block-handle" data-drag>${icon("grip", 14)}</span>
      <button type="button" class="note-toggle-arrow" data-toggle-arrow>${icon("toggle", 14)}</button>
      <div class="note-toggle-col">
        <div class="note-block-text note-toggle-summary" contenteditable="true" data-placeholder="トグルリスト">${b.html || ""}</div>
        <div class="note-block-text note-toggle-body" contenteditable="true" data-placeholder="内容を入力">${b.childHtml || ""}</div>
      </div>
    </div>`;
  }
  if (b.type === "quote") {
    return `<div class="note-block type-quote" data-block="${b.id}" data-type="quote">
      <span class="note-block-handle" data-drag>${icon("grip", 14)}</span>
      <div class="note-block-text" contenteditable="true" data-placeholder="引用">${b.html || ""}</div>
    </div>`;
  }
  const prefix = b.type === "bulleted" ? `<span class="note-block-bullet">•</span>`
    : b.type === "numbered" ? `<span class="note-block-bullet" data-num></span>`
    : b.type === "checkbox" ? `<input type="checkbox" class="checkbox note-block-check" ${b.checked ? "checked" : ""}>`
    : "";
  const level = b.type === "heading" ? (b.level || 1) : null;
  return `<div class="note-block type-${b.type}${level ? " level-" + level : ""}${b.type === "checkbox" && b.checked ? " checked" : ""}" data-block="${b.id}" data-type="${b.type}"${level ? ` data-level="${level}"` : ""}>
    <span class="note-block-handle" data-drag>${icon("grip", 14)}</span>
    ${prefix}
    <div class="note-block-text" contenteditable="true" data-placeholder="${b.type === "heading" ? "見出し" + level : "入力するか「/」でメニュー"}">${b.html || ""}</div>
  </div>`;
}
// 番号付きリストの連番を、直前のブロックも番号付きリストである連続区間ごとに振り直す
function renumberNoteBlocks(container) {
  let n = 0;
  $$(".note-block", container).forEach((row) => {
    if (row.dataset.type !== "numbered") { n = 0; return; }
    n++;
    const el = $("[data-num]", row);
    if (el) el.textContent = n + ".";
  });
}

// ノートの追加・編集エディタ。1枚のノートを開いて書くような全画面シートUI＋Notionのような
// ブロック単位の本文編集（Enterで新規ブロック/空でBackspaceは削除/「/」でタイプ変換メニュー/ハンドルでドラッグ並び替え）。
function studyNoteEditor(note, subjects) {
  return new Promise((resolve) => {
    const wrap = $("#modalWrap");
    const isEdit = !!note.id;
    const subjOptions = note.subject && !subjects.includes(note.subject) ? [note.subject, ...subjects] : subjects;
    const initialBlocks = migrateNoteToBlocks(note);

    wrap.innerHTML = `<div class="note-sheet">
      <div class="note-sheet-top">
        <button type="button" class="icon-btn" data-x aria-label="閉じる">${icon("x", 20)}</button>
        <div style="flex:1"></div>
        ${isEdit ? `<button type="button" class="icon-btn danger" data-del aria-label="削除">${icon("trash", 18)}</button>` : ""}
        <button type="button" class="btn sm" id="noteSave">${icon("checkline", 14)} 完了</button>
      </div>
      <div class="note-sheet-body">
        <input type="text" id="noteTitle" class="note-page-title" placeholder="タイトルなし" value="${esc(note.title || "")}">
        <div class="note-page-meta">
          <input type="date" id="noteDate" value="${esc(note.date || todayStr())}">
          <select id="noteSubject">${subjOptions.map((s) => `<option ${s === note.subject ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
          <input type="number" id="noteMin" value="${note.min || ""}" placeholder="分" style="width:64px">
          <input type="text" id="noteTags" value="${esc((note.tags || []).join(", "))}" placeholder="#タグ（カンマ区切り）" style="flex:1;min-width:120px">
        </div>
        <div id="noteBlocks" class="note-blocks">${initialBlocks.map(noteBlockRowHTML).join("")}</div>
      </div>
      <div class="note-toolbar-outer" id="noteToolbarOuter">
        <div class="note-toolbar" id="noteToolbar"></div>
        <div class="note-bottom-area" id="noteBottomArea"></div>
      </div>
    </div>`;
    document.body.classList.add("modal-open");
    const toolbarOuter = $("#noteToolbarOuter", wrap);
    const toolbarEl = $("#noteToolbar", wrap);
    const bottomArea = $("#noteBottomArea", wrap);
    let vvResizeHandler = null;
    const close = (result) => {
      if (vvResizeHandler && window.visualViewport) {
        window.visualViewport.removeEventListener("resize", vvResizeHandler);
        window.visualViewport.removeEventListener("scroll", vvResizeHandler);
      }
      wrap.innerHTML = "";
      document.body.classList.remove("modal-open");
      resolve(result);
    };
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => close(null)));
    renumberNoteBlocks($("#noteBlocks", wrap));

    // ===== ブロック編集 =====
    const blocksEl = $("#noteBlocks", wrap);
    let slashMenu = null;
    let activeRow = null;
    const closeSlashMenu = () => { slashMenu?.remove(); slashMenu = null; };

    const focusTextEl = (row, atStart = false) => {
      const t = $(".note-block-text", row);
      if (!t) return;
      t.focus();
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNodeContents(t);
      r.collapse(atStart);
      sel.removeAllRanges();
      sel.addRange(r);
    };

    const insertBlockAfter = (row, type = "paragraph", html = "", extra = {}) => {
      const b = { id: uid(), type, html, ...extra };
      row.insertAdjacentHTML("afterend", noteBlockRowHTML(b));
      const newRow = row.nextElementSibling;
      bindBlockRow(newRow);
      renumberNoteBlocks(blocksEl);
      pushHistory();
      return newRow;
    };
    const removeBlock = (row) => {
      const prev = row.previousElementSibling;
      row.remove();
      renumberNoteBlocks(blocksEl);
      if (prev) focusTextEl(prev, false);
      pushHistory();
    };
    const convertBlockType = (row, newType, extra = {}) => {
      const b = { id: row.dataset.block, type: newType, html: "", checked: false, emoji: "💡", open: true, childHtml: "", url: "", ...extra };
      row.outerHTML = noteBlockRowHTML(b);
      const newRow = $(`[data-block="${b.id}"]`, blocksEl);
      bindBlockRow(newRow);
      renumberNoteBlocks(blocksEl);
      pushHistory();
      if (newType === "divider") { insertBlockAfter(newRow); focusTextEl(newRow.nextElementSibling); }
      else if (newType === "image") { $(".note-image-url", newRow)?.focus(); }
      else focusTextEl(newRow);
    };

    const openSlashMenu = (row, textEl) => {
      closeSlashMenu();
      slashMenu = document.createElement("div");
      slashMenu.className = "note-slash-menu";
      slashMenu.innerHTML = NOTE_BLOCK_TYPES.map((t, i) => `<button type="button" class="note-slash-item${i === 0 ? " active" : ""}" data-slash-type="${t.type}" data-slash-level="${t.level || ""}"><span class="note-slash-glyph">${t.glyph}</span>${t.label}</button>`).join("");
      row.style.position = "relative";
      row.appendChild(slashMenu);
      slashMenu.style.top = row.offsetHeight + "px";
      slashMenu.style.left = "22px";
      $$("[data-slash-type]", slashMenu).forEach((b) => b.addEventListener("mousedown", (e) => {
        e.preventDefault();
        textEl.textContent = "";
        closeSlashMenu();
        convertBlockType(row, b.dataset.slashType, b.dataset.slashLevel ? { level: Number(b.dataset.slashLevel) } : {});
      }));
    };

    // ドラッグ並び替え（ポインタイベントでマウス/タッチ両対応）
    const startDrag = (row) => {
      row.classList.add("dragging");
      const onMove = (e) => {
        const y = e.clientY;
        for (const r of $$(".note-block", blocksEl)) {
          if (r === row) continue;
          const rect = r.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (y < mid && r.previousElementSibling !== row) { blocksEl.insertBefore(row, r); break; }
          if (y >= mid && r.nextElementSibling !== row) { blocksEl.insertBefore(row, r.nextSibling); break; }
        }
      };
      const onUp = () => {
        row.classList.remove("dragging");
        renumberNoteBlocks(blocksEl);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        pushHistory();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    };

    const CALLOUT_EMOJIS = ["💡", "📌", "⚠️", "✅", "📝"];
    const cycleCalloutEmoji = (row, btn) => {
      const i = CALLOUT_EMOJIS.indexOf(btn.textContent.trim());
      btn.textContent = CALLOUT_EMOJIS[(i + 1) % CALLOUT_EMOJIS.length];
      pushHistory();
    };

    let historyTimer = null;
    const scheduleHistoryPush = () => { clearTimeout(historyTimer); historyTimer = setTimeout(() => pushHistory(), 800); };

    function bindImageBlock(row) {
      const urlInput = $(".note-image-url", row);
      if (urlInput) {
        urlInput.addEventListener("focus", () => { activeRow = row; });
        const commit = () => {
          const url = urlInput.value.trim();
          if (!url) return;
          const b = { id: row.dataset.block, type: "image", url };
          row.outerHTML = noteBlockRowHTML(b);
          const newRow = $(`[data-block="${b.id}"]`, blocksEl);
          bindBlockRow(newRow);
          pushHistory();
        };
        urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
        urlInput.addEventListener("blur", commit);
      }
      const delBtn = $("[data-block-del]", row);
      if (delBtn) delBtn.addEventListener("click", () => removeBlock(row));
      const handle = $("[data-drag]", row);
      if (handle) handle.addEventListener("pointerdown", (e) => { e.preventDefault(); startDrag(row); });
    }

    function bindToggleBlock(row) {
      const summary = $(".note-toggle-summary", row);
      const body = $(".note-toggle-body", row);
      const arrow = $("[data-toggle-arrow]", row);
      arrow.addEventListener("click", () => row.classList.toggle("open"));
      [summary, body].forEach((el) => el.addEventListener("focus", () => { activeRow = row; }));
      summary.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.isComposing || e.keyCode === 229)) return;
        if (e.key === "Enter") {
          e.preventDefault();
          closeSlashMenu();
          const newRow = insertBlockAfter(row, "paragraph");
          focusTextEl(newRow, true);
        } else if (e.key === "Backspace") {
          if (!summary.textContent.trim() && $$(".note-block", blocksEl).length > 1) { e.preventDefault(); removeBlock(row); }
        }
      });
      summary.addEventListener("input", () => {
        if (summary.textContent === "/") openSlashMenu(row, summary);
        else closeSlashMenu();
        scheduleHistoryPush();
      });
      summary.addEventListener("blur", () => setTimeout(closeSlashMenu, 150));
      body.addEventListener("input", scheduleHistoryPush);
      const handle = $("[data-drag]", row);
      if (handle) handle.addEventListener("pointerdown", (e) => { e.preventDefault(); startDrag(row); });
    }

    function bindBlockRow(row) {
      const type = row.dataset.type;
      if (type === "image") { bindImageBlock(row); return; }
      if (type === "toggle") { bindToggleBlock(row); return; }
      const textEl = $(".note-block-text", row);
      if (textEl) {
        textEl.addEventListener("focus", () => { activeRow = row; });
        textEl.addEventListener("keydown", (e) => {
          // 日本語IMEの変換確定Enterと誤認しないようにする（isComposing/keyCode 229は変換中の合図）
          if (e.key === "Enter" && (e.isComposing || e.keyCode === 229)) return;
          if (e.key === "Enter") {
            if (type === "code") return; // コードブロック内は改行を許可（ブロック分割しない）
            e.preventDefault();
            closeSlashMenu();
            // カーソル位置で分割: 後半をextractして新しいブロックへ
            const sel = window.getSelection();
            let afterHtml = "";
            if (sel.rangeCount) {
              const range = sel.getRangeAt(0);
              const afterRange = range.cloneRange();
              afterRange.selectNodeContents(textEl);
              afterRange.setStart(range.endContainer, range.endOffset);
              const frag = afterRange.extractContents();
              const div = document.createElement("div");
              div.appendChild(frag);
              afterHtml = sanitizeNoteHtml(div.innerHTML);
            }
            if (!textEl.textContent.trim() && !["paragraph", "quote"].includes(type)) {
              // 空のリスト/見出し/特殊ブロックでEnter: 段落に変換して抜ける（Notionの挙動に合わせる）
              convertBlockType(row, "paragraph");
              return;
            }
            const nextType = ["bulleted", "numbered", "checkbox", "quote"].includes(type) ? type : "paragraph";
            const newRow = insertBlockAfter(row, nextType, afterHtml);
            focusTextEl(newRow, true);
          } else if (e.key === "Backspace") {
            if (!textEl.textContent.trim() && $$(".note-block", blocksEl).length > 1) {
              e.preventDefault();
              closeSlashMenu();
              removeBlock(row);
            }
          } else if (e.key === "Escape") {
            closeSlashMenu();
          }
        });
        textEl.addEventListener("input", () => {
          if (textEl.textContent === "/") openSlashMenu(row, textEl);
          else closeSlashMenu();
          scheduleHistoryPush();
        });
        textEl.addEventListener("blur", () => setTimeout(closeSlashMenu, 150));
      }
      const check = $(".note-block-check", row);
      if (check) check.addEventListener("change", () => { row.classList.toggle("checked", check.checked); pushHistory(); });
      const delBtn = $("[data-block-del]", row);
      if (delBtn) delBtn.addEventListener("click", () => removeBlock(row));
      const handle = $("[data-drag]", row);
      if (handle) handle.addEventListener("pointerdown", (e) => { e.preventDefault(); startDrag(row); });
      const emojiBtn = $("[data-callout-emoji]", row);
      if (emojiBtn) emojiBtn.addEventListener("click", () => cycleCalloutEmoji(row, emojiBtn));
    }
    $$(".note-block", blocksEl).forEach(bindBlockRow);

    // ===== Undo履歴（ブロック構造のスナップショット方式） =====
    let history = [blocksEl.innerHTML];
    let histIndex = 0;
    function pushHistory() {
      const html = blocksEl.innerHTML;
      if (html === history[histIndex]) return;
      history = history.slice(0, histIndex + 1);
      history.push(html);
      histIndex = history.length - 1;
      if (history.length > 50) { history.shift(); histIndex--; }
      const undoBtn = $("#noteTbUndo", wrap);
      if (undoBtn) undoBtn.disabled = histIndex <= 0;
    }
    function doUndo() {
      if (histIndex <= 0) return;
      histIndex--;
      blocksEl.innerHTML = history[histIndex];
      $$(".note-block", blocksEl).forEach(bindBlockRow);
      renumberNoteBlocks(blocksEl);
      activeRow = null;
      const undoBtn = $("#noteTbUndo", wrap);
      if (undoBtn) undoBtn.disabled = histIndex <= 0;
    }

    // ===== キーボード追従ツールバー（Notion風ピル型） =====
    let toolbarMode = "keyboard"; // keyboard | picker | aa | color
    let pickerMode = "insert"; // insert | turnInto
    let colorPanelKind = "text"; // text | bg
    let lastKeyboardHeight = 0;

    const blurActive = () => { document.activeElement?.blur?.(); };
    const refocusActive = () => {
      if (!activeRow || !document.body.contains(activeRow)) return;
      const t = activeRow.dataset.type === "toggle" ? $(".note-toggle-summary", activeRow) : $(".note-block-text", activeRow);
      t?.focus();
    };
    const lastBlockRow = () => blocksEl.lastElementChild;

    const mainRowHTML = () => `
      <button type="button" class="note-tb-btn" data-tb="pen" disabled title="近日対応">${icon("edit", 18)}</button>
      <button type="button" class="note-tb-btn${toolbarMode === "picker" && pickerMode === "insert" ? " active" : ""}" data-tb="plus">${icon("plus", 18)}</button>
      <button type="button" class="note-tb-btn${toolbarMode === "aa" || toolbarMode === "color" ? " active" : ""}" data-tb="aa">Aa</button>
      <button type="button" class="note-tb-btn" data-tb="mic" disabled title="近日対応">${icon("mic", 18)}</button>
      <button type="button" class="note-tb-btn" data-tb="image" title="画像を挿入">${icon("image", 18)}</button>
      <button type="button" class="note-tb-btn${toolbarMode === "picker" && pickerMode === "turnInto" ? " active" : ""}" data-tb="swap" title="ブロックの種類を変換">${icon("swap", 18)}</button>
      <button type="button" class="note-tb-btn" data-tb="undo" id="noteTbUndo" ${histIndex <= 0 ? "disabled" : ""}>${icon("rotate", 18)}</button>
      <button type="button" class="note-tb-btn" data-tb="smile" disabled title="近日対応">${icon("smile", 18)}</button>
      <span class="note-tb-sep"></span>
      <button type="button" class="note-tb-btn" data-tb="close">${toolbarMode === "keyboard" ? icon("keyboardIc", 18) : icon("x", 18)}</button>
    `;
    const aaRowHTML = () => `
      <button type="button" class="note-tb-btn" data-aa="back" title="戻る">${icon("chevR", 18, "rot180")}</button>
      <button type="button" class="note-tb-btn${toolbarMode === "color" ? " active" : ""}" data-aa="color"><span class="note-aa-glyph">あ</span></button>
      <button type="button" class="note-tb-btn" data-aa="bold"><b>B</b></button>
      <button type="button" class="note-tb-btn" data-aa="italic"><i>I</i></button>
      <button type="button" class="note-tb-btn" data-aa="underline" style="text-decoration:underline">U</button>
      <button type="button" class="note-tb-btn" data-aa="strike" style="text-decoration:line-through">S</button>
      <button type="button" class="note-tb-btn" data-aa="link">${icon("link", 16)}</button>
      <button type="button" class="note-tb-btn" data-aa="code">${icon("code", 16)}</button>
      <span class="note-tb-sep"></span>
      <button type="button" class="note-tb-btn" data-tb="close">${icon("x", 18)}</button>
    `;
    const pickerItemHTML = (it) => `
      <button type="button" class="note-picker-item" data-picker-type="${it.type}" data-picker-level="${it.level || ""}">
        <span class="note-picker-icon">${it.icon ? icon(it.icon, 20) : `<span class="note-picker-glyph">${esc(it.glyph)}</span>`}</span>
        <span>${esc(it.label)}</span>
      </button>`;
    const pickerHTML = () => {
      const cats = pickerMode === "turnInto" ? [NOTE_PICKER_CATEGORIES[0]] : NOTE_PICKER_CATEGORIES;
      return cats.map((cat) => `
        <div class="note-picker-cat-label">${esc(cat.label)}</div>
        <div class="note-picker-grid">${cat.items.map(pickerItemHTML).join("")}</div>`).join("");
    };
    const colorPanelHTML = () => {
      const colors = colorPanelKind === "bg" ? NOTE_BG_COLORS : NOTE_TEXT_COLORS;
      return `
        <div class="note-color-tabs">
          <button type="button" class="note-color-tab${colorPanelKind === "text" ? " active" : ""}" data-color-kind="text">テキストの色</button>
          <button type="button" class="note-color-tab${colorPanelKind === "bg" ? " active" : ""}" data-color-kind="bg">背景色</button>
        </div>
        <div class="note-picker-grid">${colors.map((c) => `
          <button type="button" class="note-picker-item" data-color-value="${esc(c.value)}">
            <span class="note-picker-icon">${colorPanelKind === "bg"
              ? `<span class="note-color-swatch" style="background:${c.value || "transparent"}"></span>`
              : `<span class="note-color-swatch-text" style="color:${c.value || "var(--ink)"}">あ</span>`}</span>
            <span>${esc(c.label)}</span>
          </button>`).join("")}</div>`;
    };

    function updateToolbarPosition() {
      const vv = window.visualViewport;
      if (!vv) return;
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (kh > 40) lastKeyboardHeight = kh;
      const showBottom = toolbarMode !== "keyboard";
      const used = showBottom ? (kh > 40 ? kh : (lastKeyboardHeight || 260)) : kh;
      const outerH = toolbarOuter.offsetHeight || 60;
      toolbarOuter.style.top = Math.max(0, window.innerHeight - used - outerH) + "px";
    }
    vvResizeHandler = () => updateToolbarPosition();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", vvResizeHandler);
      window.visualViewport.addEventListener("scroll", vvResizeHandler);
    }

    function setToolbarMode(mode) {
      toolbarMode = mode;
      toolbarEl.innerHTML = (mode === "aa" || mode === "color") ? aaRowHTML() : mainRowHTML();
      if (mode === "picker") {
        bottomArea.innerHTML = pickerHTML();
        bottomArea.classList.add("open");
      } else if (mode === "color") {
        bottomArea.innerHTML = colorPanelHTML();
        bottomArea.classList.add("open");
      } else {
        bottomArea.innerHTML = "";
        bottomArea.classList.remove("open");
      }
      updateToolbarPosition();
    }
    setToolbarMode("keyboard");

    function handlePickerChoice(btn) {
      const type = btn.dataset.pickerType;
      const level = btn.dataset.pickerLevel ? Number(btn.dataset.pickerLevel) : undefined;
      if (type === "soon") { toast("この機能は近日対応予定です", "clock"); return; }
      const extra = level ? { level } : {};
      const target = activeRow || lastBlockRow();
      if (pickerMode === "turnInto") {
        if (target) convertBlockType(target, type, extra);
      } else {
        const newRow = insertBlockAfter(target, type, "", extra);
        activeRow = newRow;
        if (type === "image") $(".note-image-url", newRow)?.focus();
        else focusTextEl(newRow, true);
      }
      setToolbarMode("keyboard");
    }

    toolbarEl.addEventListener("mousedown", (e) => {
      const btn = e.target.closest("button");
      if (!btn || btn.disabled) return;
      e.preventDefault();
      const tb = btn.dataset.tb;
      const aa = btn.dataset.aa;
      if (tb === "plus") {
        const wasInsertOpen = toolbarMode === "picker" && pickerMode === "insert";
        pickerMode = "insert";
        if (wasInsertOpen) { setToolbarMode("keyboard"); refocusActive(); }
        else { blurActive(); setToolbarMode("picker"); }
      } else if (tb === "aa") {
        if (toolbarMode === "aa" || toolbarMode === "color") setToolbarMode("keyboard");
        else setToolbarMode("aa");
      } else if (tb === "image") {
        const target = activeRow || lastBlockRow();
        const newRow = insertBlockAfter(target, "image");
        activeRow = newRow;
        $(".note-image-url", newRow)?.focus();
      } else if (tb === "swap") {
        const wasTurnIntoOpen = toolbarMode === "picker" && pickerMode === "turnInto";
        pickerMode = "turnInto";
        if (wasTurnIntoOpen) { setToolbarMode("keyboard"); refocusActive(); }
        else { blurActive(); setToolbarMode("picker"); }
      } else if (tb === "undo") {
        doUndo();
      } else if (tb === "close") {
        if (toolbarMode !== "keyboard") { setToolbarMode("keyboard"); refocusActive(); }
        else blurActive();
      } else if (aa === "color") {
        blurActive();
        setToolbarMode("color");
      } else if (aa === "back") {
        if (toolbarMode === "color") { setToolbarMode("aa"); refocusActive(); }
        else { setToolbarMode("keyboard"); refocusActive(); }
      } else if (aa === "bold") {
        applyNoteStyle({ fontWeight: "700" });
      } else if (aa === "italic") {
        applyNoteStyle({ fontStyle: "italic" });
      } else if (aa === "underline") {
        applyNoteStyle({ textDecoration: "underline" });
      } else if (aa === "strike") {
        applyNoteStyle({ textDecoration: "line-through" });
      } else if (aa === "link") {
        applyInlineLink();
      } else if (aa === "code") {
        applyNoteStyle({ fontFamily: "monospace", backgroundColor: "var(--surface-2)" });
      }
    });

    bottomArea.addEventListener("mousedown", (e) => {
      const tabBtn = e.target.closest("[data-color-kind]");
      if (tabBtn) { e.preventDefault(); colorPanelKind = tabBtn.dataset.colorKind; setToolbarMode("color"); return; }
      const colorBtn = e.target.closest("[data-color-value]");
      if (colorBtn) {
        e.preventDefault();
        const v = colorBtn.dataset.colorValue;
        if (colorPanelKind === "bg") applyNoteStyle({ backgroundColor: v || "transparent" });
        else applyNoteStyle({ color: v || "" });
        setToolbarMode("keyboard");
        refocusActive();
        return;
      }
      const pickerBtn = e.target.closest("[data-picker-type]");
      if (pickerBtn) { e.preventDefault(); handlePickerChoice(pickerBtn); }
    });

    if (isEdit) {
      $("[data-del]", wrap).addEventListener("click", async () => {
        if (await confirmBox("このノートを削除しますか？")) close({ __delete: true });
      });
    }
    $("#noteSave", wrap).addEventListener("click", () => {
      const title = $("#noteTitle", wrap).value.trim();
      const min = Number($("#noteMin", wrap).value) || 0;
      const blocks = $$(".note-block", blocksEl).map((row) => {
        const type = row.dataset.type;
        if (type === "divider") return { id: row.dataset.block, type, html: "" };
        if (type === "image") {
          const img = $(".note-image-img", row);
          return { id: row.dataset.block, type, url: img ? img.getAttribute("src") : "" };
        }
        if (type === "toggle") {
          const summary = $(".note-toggle-summary", row);
          const body = $(".note-toggle-body", row);
          return {
            id: row.dataset.block, type,
            html: sanitizeNoteHtml(summary.innerHTML),
            childHtml: sanitizeNoteHtml(body.innerHTML),
            open: row.classList.contains("open"),
          };
        }
        const textEl = $(".note-block-text", row);
        const html = sanitizeNoteHtml(textEl.innerHTML);
        const out = { id: row.dataset.block, type, html };
        if (type === "checkbox") out.checked = $(".note-block-check", row)?.checked || false;
        if (type === "heading") out.level = Number(row.dataset.level) || 1;
        if (type === "callout") out.emoji = $("[data-callout-emoji]", row)?.textContent.trim() || "💡";
        return out;
      }).filter((b) => b.type === "divider" || b.type === "image" || stripHtmlPreview(b.html, 1) || (b.type === "toggle" && stripHtmlPreview(b.childHtml, 1)));
      const bodyHtml = blocks.map((b) => {
        if (b.type === "divider") return "<div>ーーーーー</div>";
        if (b.type === "image") return b.url ? `<div>🖼 ${esc(b.url)}</div>` : "";
        if (b.type === "toggle") return `<div>▸ ${b.html}</div><div>${b.childHtml}</div>`;
        const prefix = b.type === "bulleted" ? "• " : b.type === "checkbox" ? (b.checked ? "☑ " : "☐ ") : b.type === "quote" ? "❝ " : b.type === "callout" ? `${b.emoji} ` : "";
        return `<div>${prefix}${b.html}</div>`;
      }).join("");
      const bodyText = stripHtmlPreview(bodyHtml, 1);
      if (!title && !bodyText && !min) { toast("タイトル・本文・分のいずれかを入力してください", "x"); return; }
      close({
        title,
        date: $("#noteDate", wrap).value || todayStr(),
        subject: $("#noteSubject", wrap).value,
        min,
        tags: $("#noteTags", wrap).value.split(/[,、]/).map((s) => s.trim()).filter(Boolean),
        links: note.links || (note.link ? [note.link] : []),
        body: bodyHtml,
        blocks,
      });
    });
  });
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
  },
};

// ===== ノート（学習ノート専用ページ） =====
VIEWS.notes = {
  title: "ノート", icon: "edit",
  render(main) {
    const logs = DB.study.logs;
    const subjects = ["一般", ...DB.learning.items.map((i) => i.name), "案件作業", "その他"];
    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Notes</p><h1>ノート</h1></div>
        <button class="btn" id="noteAdd">${icon("plus", 15)} ノートを書く</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <select id="noteFSubject" style="max-width:150px">
          <option ${NOTE_FILTER.subject === "すべて" ? "selected" : ""}>すべて</option>
          ${subjects.map((s) => `<option ${NOTE_FILTER.subject === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
        </select>
        <input type="text" id="noteFTag" placeholder="タグで絞り込み" value="${esc(NOTE_FILTER.tag)}" style="max-width:150px">
        <input type="date" id="noteFFrom" value="${esc(NOTE_FILTER.from)}" style="max-width:145px">
        <input type="date" id="noteFTo" value="${esc(NOTE_FILTER.to)}" style="max-width:145px">
        ${(NOTE_FILTER.subject !== "すべて" || NOTE_FILTER.tag || NOTE_FILTER.from || NOTE_FILTER.to) ? `<button class="btn ghost sm" id="noteFClear">クリア</button>` : ""}
      </div>
      <div class="section-list"><div class="section">
        <div style="padding:16px 0 18px" id="noteList">${noteListHTML(logs)}</div>
      </div></div>`;

    const bindNoteList = () => {
      $$("[data-log]", main).forEach((el) => el.addEventListener("click", async () => {
        const l = DB.study.logs.find((x) => x.id === el.dataset.log);
        if (!l) return;
        const v = await studyNoteEditor(l, subjects);
        if (!v) return;
        if (v.__delete) {
          DB.study.logs = DB.study.logs.filter((x) => x.id !== l.id);
        } else {
          Object.assign(l, v);
        }
        await saveDb("study");
        $("#noteList", main).innerHTML = noteListHTML(DB.study.logs);
        bindNoteList();
      }));
    };
    bindNoteList();

    $("#noteAdd").addEventListener("click", async () => {
      const v = await studyNoteEditor({}, subjects);
      if (!v) return;
      DB.study.logs.push({ id: uid(), createdAt: new Date().toISOString(), src: "manual", ...v });
      await saveDb("study");
      if (v.min) await addXP(Math.min(v.min, 120), "勉強を記録");
      toast("ノートを保存しました");
      $("#noteList", main).innerHTML = noteListHTML(DB.study.logs);
      bindNoteList();
    });

    const refreshNoteList = () => { $("#noteList", main).innerHTML = noteListHTML(DB.study.logs); bindNoteList(); };
    $("#noteFSubject").addEventListener("change", (e) => { NOTE_FILTER.subject = e.target.value; rerender(); });
    $("#noteFTag").addEventListener("input", (e) => { NOTE_FILTER.tag = e.target.value; refreshNoteList(); });
    $("#noteFFrom").addEventListener("change", (e) => { NOTE_FILTER.from = e.target.value; rerender(); });
    $("#noteFTo").addEventListener("change", (e) => { NOTE_FILTER.to = e.target.value; rerender(); });
    $("#noteFClear")?.addEventListener("click", () => { NOTE_FILTER = { subject: "すべて", tag: "", from: "", to: "" }; rerender(); });
  },
};

// フィルタ済みノート一覧のHTML（新しい順）
function filteredNotes(logs) {
  return logs.filter((l) => {
    if (NOTE_FILTER.subject !== "すべて" && l.subject !== NOTE_FILTER.subject) return false;
    if (NOTE_FILTER.tag && !(l.tags || []).some((t) => t.toLowerCase().includes(NOTE_FILTER.tag.toLowerCase()))) return false;
    if (NOTE_FILTER.from && l.date < NOTE_FILTER.from) return false;
    if (NOTE_FILTER.to && l.date > NOTE_FILTER.to) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || String(b.id).localeCompare(String(a.id)));
}
function noteItemHTML(l) {
  const title = l.title || fmtDateFull(l.date);
  const preview = l.body ? stripHtmlPreview(l.body) : (l.memo || "");
  const linksArr = l.links?.length ? l.links : (l.link ? [l.link] : []);
  return `<div class="list-item" data-log="${l.id}" role="button" tabindex="0" style="cursor:pointer">
    <span class="li-time">${esc(fmtShort(l.date))}</span>
    <div class="li-body">
      <div class="li-title">${esc(title)} <span class="pill">${esc(l.subject)}</span>${l.min ? ` <span class="pill">${fmtMin(l.min)}</span>` : ""}</div>
      ${l.tags?.length ? `<div class="small muted">${l.tags.map((t) => "#" + esc(t)).join(" ")}</div>` : ""}
      ${preview ? `<div class="li-memo">${esc(preview)}</div>` : ""}
    </div>
    ${linksArr.length ? `<span class="pill">${icon("external", 10)} ${linksArr.length}</span>` : ""}
  </div>`;
}
function noteListHTML(logs) {
  const items = filteredNotes(logs).slice(0, 30);
  return items.map(noteItemHTML).join("") || '<p class="empty">条件に合うノートがありません</p>';
}

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
