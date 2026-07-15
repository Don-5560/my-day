// 画面のロジック。サーバーの /api/* とやり取りするだけのシンプルな作り。

const $ = (sel) => document.querySelector(sel);
const api = async (url, opts) => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401) {
    location.href = "/login"; // ログイン切れ → ログイン画面へ
    throw new Error("要ログイン");
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
};

let day = null; // 今日のデータ

// --- 表示ヘルパー ---

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${wd}）`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "おつかれさま";
  if (h < 11) return "おはよう ☀️";
  if (h < 18) return "こんにちは";
  return "こんばんは 🌙";
}

// --- ホーム: 進捗リング ---

const RING_C = 163.4; // 2πr (r=26)
function renderProgress() {
  const total = day.tasks.length;
  const done = day.tasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("#ring").style.strokeDashoffset = String(RING_C * (1 - pct / 100));
  $("#ringPct").textContent = pct + "%";
  $("#progressSub").textContent = total ? `${done} / ${total} 件 完了` : "やること 0 件";
  $("#progressLabel").textContent =
    total === 0 ? "今日はまだこれから" :
    done === total ? "全部やりきった！🎉" :
    done === 0 ? "さあ、はじめよう" : "いい調子！";
}

// --- ホーム: タスク ---

function renderTasks() {
  const list = $("#taskList");
  list.innerHTML = "";
  for (const t of day.tasks) {
    const li = document.createElement("li");
    li.className = t.done ? "is-done" : "";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.checked = t.done;
    check.addEventListener("change", () => toggleTask(t.id, check.checked));

    const title = document.createElement("input");
    title.className = "task-title";
    title.value = t.title;
    title.addEventListener("change", () => renameTask(t.id, title.value));

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.title = "削除";
    del.addEventListener("click", () => deleteTask(t.id));

    li.append(check, title);
    if (t.source && t.source !== "manual") {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t.source === "template" ? "定番" : "AI";
      li.append(tag);
    }
    li.append(del);
    list.append(li);
  }
  $("#taskEmpty").classList.toggle("hidden", day.tasks.length > 0);
  renderProgress();
}

function renderDiary() {
  $("#diary").value = day.diary || "";
  document.querySelectorAll(".mood-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mood === day.mood);
  });
}

// --- 操作 ---

async function load() {
  day = await api("/api/day");
  $("#greeting").textContent = greeting();
  $("#dateLabel").textContent = fmtDate(day.date);
  renderTasks();
  renderDiary();
}

async function addTask(title) {
  day = await api("/api/tasks", { method: "POST", body: JSON.stringify({ title }) });
  renderTasks();
}
async function toggleTask(id, done) {
  day = await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done }) });
  renderTasks();
}
async function renameTask(id, title) {
  if (!title.trim()) return load();
  day = await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
}
async function deleteTask(id) {
  day = await api(`/api/tasks/${id}`, { method: "DELETE" });
  renderTasks();
}

// 日記は自動保存
let diaryTimer = null;
function scheduleDiarySave() {
  const state = $("#saveState");
  state.textContent = "保存中…";
  state.classList.add("saving");
  clearTimeout(diaryTimer);
  diaryTimer = setTimeout(async () => {
    day = await api("/api/diary", {
      method: "PUT",
      body: JSON.stringify({ diary: $("#diary").value, mood: day.mood }),
    });
    state.textContent = "保存済み";
    state.classList.remove("saving");
  }, 600);
}
async function setMood(mood) {
  day.mood = day.mood === mood ? "" : mood;
  renderDiary();
  day = await api("/api/diary", { method: "PUT", body: JSON.stringify({ mood: day.mood }) });
}

// --- きろく（過去のふりかえり） ---

async function loadRecords() {
  const days = await api("/api/history?days=30");
  const past = days.filter((d) => d.date !== (day && day.date)); // 今日は除く
  const list = $("#recordsList");
  list.innerHTML = "";
  $("#recordsEmpty").classList.toggle("hidden", past.length > 0);

  for (const d of past) {
    const done = d.tasks.filter((t) => t.done).length;
    const rec = document.createElement("div");
    rec.className = "rec";

    const head = document.createElement("div");
    head.className = "rec-head";
    head.innerHTML =
      `<span class="rec-date">${fmtDate(d.date)}</span>` +
      `<span class="rec-mood">${d.mood || ""}</span>`;

    const meta = document.createElement("div");
    meta.className = "rec-meta";
    meta.textContent = d.tasks.length ? `やること ${done}/${d.tasks.length} 完了` : "やることなし";

    rec.append(head, meta);

    if (d.tasks.length) {
      const ul = document.createElement("ul");
      for (const t of d.tasks) {
        const li = document.createElement("li");
        li.className = t.done ? "done" : "";
        li.innerHTML = `<span class="box">${t.done ? "☑" : "☐"}</span>${escapeHtml(t.title)}`;
        ul.append(li);
      }
      rec.append(ul);
    }
    if (d.diary) {
      const di = document.createElement("div");
      di.className = "rec-diary";
      di.textContent = d.diary;
      rec.append(di);
    }
    list.append(rec);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// --- 定番タスク ---

function templatesToText(tpl) {
  return (tpl.recurring || [])
    .map((t) => (t.days && t.days !== "daily" ? `${t.title} @${t.days.join(",")}` : t.title))
    .join("\n");
}
function textToTemplates(text) {
  const recurring = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.*?)\s*@([a-z,]+)$/i);
    if (m) recurring.push({ title: m[1].trim(), days: m[2].toLowerCase().split(",").filter(Boolean) });
    else recurring.push({ title: line, days: "daily" });
  }
  return { recurring };
}
async function loadTemplates() {
  const tpl = await api("/api/templates");
  $("#templates").value = templatesToText(tpl);
}
async function saveTemplates() {
  await api("/api/templates", {
    method: "PUT",
    body: JSON.stringify(textToTemplates($("#templates").value)),
  });
  toast("定番タスクを保存しました");
  load();
}

// --- AI用コピー ---

async function copyForAI() {
  const md = await (await fetch("/api/export?days=7")).text();
  await navigator.clipboard.writeText(md);
  toast("直近7日ぶんをコピー。Claude/ChatGPTに貼れます");
}

// --- トースト ---

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2400);
}

// --- 画面切り替え（下タブ） ---

function switchView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  window.scrollTo(0, 0);
  if (name === "records") loadRecords().catch((e) => toast("読み込み失敗: " + e.message));
}

// --- 起動 ---

$("#addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#addInput");
  if (input.value.trim()) {
    addTask(input.value.trim());
    input.value = "";
  }
});
$("#diary").addEventListener("input", scheduleDiarySave);
document.querySelectorAll(".mood-btn").forEach((b) =>
  b.addEventListener("click", () => setMood(b.dataset.mood))
);
$("#saveTemplates").addEventListener("click", saveTemplates);
$("#exportBtn").addEventListener("click", copyForAI);
$("#logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/login";
});
document.querySelectorAll(".nav-btn").forEach((b) =>
  b.addEventListener("click", () => switchView(b.dataset.view))
);

load().catch((e) => toast("読み込み失敗: " + e.message));
loadTemplates().catch(() => {});
