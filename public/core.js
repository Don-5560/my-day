// LifeOS コア: API・データ管理・XPエンジン・UI部品（モーダル/トースト/チャート）
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));

async function api(url, opts) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  if (res.status === 401) { location.href = "/login"; throw new Error("要ログイン"); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

// ===== 日付ヘルパー =====

const WD = ["日", "月", "火", "水", "木", "金", "土"];
function todayStr(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const fmtJP = (iso) => { const d = new Date(iso + "T00:00:00"); return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };
const fmtShort = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
const fmtYen = (n) => "¥" + Number(n || 0).toLocaleString();
const monthKey = (iso) => iso.slice(0, 7);
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? (m % 60) + "分" : ""}` : `${m}分`);

// ===== データ（Tursoに保存される各モジュールのJSON文書） =====

const DB = {};
const DOC_DEFAULTS = {
  settings: { todayGoal: "", monthGoal: "", salesGoal: 300000 },
  todos: { items: [] },
  study: { logs: [] },          // {id,date,min,subject,src}
  habits: { list: [], checks: {} },
  xp: { events: [] },           // {id,ts,amt,why}
  learning: { items: [] },      // {id,name,progress,start,end,memo,link}
  portfolio: { items: [] },
  projects: { items: [] },
  outreach: { logs: [] },       // {id,date,channel,sent,replies,orders}
  sales: { logs: [] },          // {id,date,amount,source,memo}
  goals: { y1: [], y3: [], y5: [], y10: [] },
  badges: { unlocked: {} },
};
const LEARN_SEED = ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "SQL", "Git", "GitHub", "Python"];
const HABIT_SEED = ["筋トレ", "英語", "SNS投稿", "読書", "早寝"];

async function loadAll() {
  const keys = Object.keys(DOC_DEFAULTS);
  const [day, ...docs] = await Promise.all([
    api("/api/day"),
    ...keys.map((k) => api("/api/data/" + k)),
  ]);
  DB.day = day;
  keys.forEach((k, i) => { DB[k] = docs[i] ?? structuredClone(DOC_DEFAULTS[k]); });
  // 初回シード
  if (!DB.learning.items.length) {
    DB.learning.items = LEARN_SEED.map((name) => ({ id: uid(), name, progress: 0, start: "", end: "", memo: "", link: "" }));
    await saveDb("learning");
  }
  if (!DB.habits.list.length) {
    DB.habits.list = HABIT_SEED.map((name) => ({ id: uid(), name }));
    await saveDb("habits");
  }
}
async function saveDb(key) {
  await api("/api/data/" + key, { method: "PUT", body: JSON.stringify(DB[key]) });
}

// ===== XP・レベル =====

const XP_RULES = { task: 10, todoHigh: 20, todoMid: 10, todoLow: 5, habit: 5, diary: 15, project: 200, paid: 300, badge: 50 };

const xpTotal = () => DB.xp.events.reduce((s, e) => s + e.amt, 0);

function levelInfo() {
  let xp = xpTotal(), lvl = 1, need = 100;
  while (xp >= need) { xp -= need; lvl++; need = 100 + (lvl - 1) * 50; }
  return { lvl, cur: xp, need, pct: Math.min(100, Math.round((xp / need) * 100)), total: xpTotal() };
}

async function addXP(amt, why) {
  DB.xp.events.push({ id: uid(), ts: Date.now(), amt, why });
  await saveDb("xp");
  renderLevel();
  xpToast(amt, why);
}

// 日付ごとの獲得XP（ヒートマップ・連続記録用）
function activityMap() {
  const map = {};
  for (const e of DB.xp.events) {
    const d = new Date(e.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    map[key] = (map[key] || 0) + e.amt;
  }
  return map;
}

function streak() {
  const map = activityMap();
  let n = 0, offset = map[todayStr()] ? 0 : -1; // 今日まだ何もしてなければ昨日から数える
  while (map[todayStr(offset - n)]) n++;
  return n;
}

function renderLevel() {
  const L = levelInfo();
  const side = $("#sideLevel");
  if (side) side.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">
      <span style="font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px;color:var(--accent)">${icon("zap", 14)} Lv ${L.lvl}</span>
      <span class="small muted">${L.cur} / ${L.need} XP</span>
    </div>
    <div class="bar"><i style="width:${L.pct}%"></i></div>`;
  const chip = $("#levelChip");
  if (chip) chip.innerHTML = `${icon("zap", 12)} Lv ${L.lvl}`;
}

// ===== トースト =====

function toast(msg, ic = "checkline") {
  const wrap = $("#toastWrap");
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `${icon(ic, 16)}<span>${esc(msg)}</span>`;
  wrap.append(t);
  setTimeout(() => t.remove(), 2600);
}
function xpToast(amt, why) {
  const wrap = $("#toastWrap");
  const t = document.createElement("div");
  t.className = "toast xp";
  t.innerHTML = `${icon("zap", 15)}<span>+${amt} XP</span><span class="muted" style="font-weight:500">${esc(why)}</span>`;
  wrap.append(t);
  setTimeout(() => t.remove(), 2200);
}

// ===== モーダル（フォーム生成） =====
// fields: [{key,label,type,options?,placeholder?}] type: text|number|money|date|select|textarea|tags|range|url

function fieldHTML(f, val) {
  const v = val ?? f.default ?? "";
  const label = `<label class="f-label">${esc(f.label)}</label>`;
  switch (f.type) {
    case "select":
      return label + `<select name="${f.key}">${f.options.map((o) => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    case "textarea":
      return label + `<textarea name="${f.key}" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
    case "range":
      return label + `<div style="display:flex;gap:12px;align-items:center">
        <input type="range" name="${f.key}" min="0" max="100" step="5" value="${Number(v) || 0}" oninput="this.nextElementSibling.textContent=this.value+'%'">
        <b style="width:44px;text-align:right;font-size:13px">${Number(v) || 0}%</b></div>`;
    case "tags":
      return label + `<input type="text" name="${f.key}" value="${esc(Array.isArray(v) ? v.join(", ") : v)}" placeholder="${esc(f.placeholder || "カンマ区切り")}">`;
    case "number": case "money":
      return label + `<input type="number" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" inputmode="numeric">`;
    case "date":
      return label + `<input type="date" name="${f.key}" value="${esc(v)}">`;
    default:
      return label + `<input type="${f.type === "url" ? "url" : "text"}" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}">`;
  }
}

function modal(title, fields, values = {}) {
  return new Promise((resolve) => {
    const wrap = $("#modalWrap");
    wrap.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <form id="mform">
        ${fields.map((f) => fieldHTML(f, values[f.key])).join("")}
        <div class="modal-foot">
          <button type="button" class="btn ghost" data-x>キャンセル</button>
          <button type="submit" class="btn">${icon("checkline", 15)} 保存</button>
        </div>
      </form>
    </div></div>`;
    const close = (result) => { wrap.innerHTML = ""; resolve(result); };
    wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) close(null); });
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => close(null)));
    $("#mform").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const out = {};
      for (const f of fields) {
        let v = fd.get(f.key);
        if (f.type === "number" || f.type === "money" || f.type === "range") v = Number(v) || 0;
        else if (f.type === "tags") v = String(v || "").split(/[,、]/).map((s) => s.trim()).filter(Boolean);
        else v = String(v ?? "").trim();
        out[f.key] = v;
      }
      close(out);
    });
    const first = wrap.querySelector("input, select, textarea");
    if (first) first.focus();
  });
}

function confirmBox(msg) {
  return new Promise((resolve) => {
    const wrap = $("#modalWrap");
    wrap.innerHTML = `<div class="overlay"><div class="modal" style="width:min(94vw,360px)">
      <p style="margin:4px 0 0;font-size:14.5px">${esc(msg)}</p>
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-n>キャンセル</button>
        <button type="button" class="btn danger" data-y style="border:none;background:var(--red);color:#fff">削除する</button>
      </div></div></div>`;
    const close = (r) => { wrap.innerHTML = ""; resolve(r); };
    wrap.querySelector("[data-y]").addEventListener("click", () => close(true));
    wrap.querySelector("[data-n]").addEventListener("click", () => close(false));
    wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) close(false); });
  });
}

// ===== チャート部品 =====

// 縦棒グラフ
function vbars(values, labels, fmt = (v) => v) {
  const max = Math.max(...values, 1);
  return `<div class="vbars">${values.map((v, i) =>
    `<div class="vbar" title="${esc(labels[i])}: ${esc(String(fmt(v)))}">
      <i style="height:${Math.round((v / max) * 100)}%"></i><span>${esc(labels[i])}</span>
    </div>`).join("")}</div>`;
}

// 横棒（内訳）
function hbars(rows, fmt = (v) => v) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return rows.map((r) => `<div class="hrow">
    <span class="h-label">${esc(r.label)}</span>
    <div class="bar"><i style="width:${Math.round((r.value / max) * 100)}%;${r.color ? `background:${r.color}` : ""}"></i></div>
    <span class="h-val">${esc(String(fmt(r.value)))}</span>
  </div>`).join("") || `<p class="empty">データなし</p>`;
}

// 進捗リング（conic-gradient）
function ring(pct, label = "") {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  return `<div class="ring-wrap">
    <div class="ring-conic" style="background:conic-gradient(var(--accent) ${p}%, rgba(255,255,255,.08) 0)"></div>
    <span class="ring-num">${label || p + "%"}</span>
  </div>`;
}

// 統計カード
function statCard(ic, val, label, sub = "") {
  return `<div class="stat">
    <span class="s-ic">${icon(ic, 17)}</span>
    <span class="s-val">${val}${sub ? `<small>${esc(sub)}</small>` : ""}</span>
    <span class="s-label">${esc(label)}</span>
  </div>`;
}
