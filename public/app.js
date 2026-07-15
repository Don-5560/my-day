// 画面のロジック。サーバーの /api/* とやり取りするだけのシンプルな作り。

const $ = (sel) => document.querySelector(sel);
const api = async (url, opts) => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
};

let day = null; // 今日のデータ

// --- 表示まわり ---

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${wd}）`;
}

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

// 日記は自動保存（打ち終わって少し待ってから送る）
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

// --- 定番タスク（テキスト⇔JSON変換） ---

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
  load(); // 今日の分に反映（まだ未保存の今日なら定番が入る）
}

// --- AI用コピー ---

async function copyForAI() {
  const md = await (await fetch("/api/export?days=7")).text();
  await navigator.clipboard.writeText(md);
  toast("直近7日ぶんをコピーしました。Claude/ChatGPTに貼れます");
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

load().catch((e) => toast("読み込み失敗: " + e.message));
loadTemplates().catch(() => {});
