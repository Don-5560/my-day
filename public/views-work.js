// LifeOS 画面: 学習 / ポートフォリオ / 案件 / 営業 / 売上 / 目標 / 実績 / 分析 / カレンダー / 設定
"use strict";

window.VIEWS = window.VIEWS || {};

// ===== 学習管理 =====

VIEWS.learning = {
  title: "学習", icon: "book",
  render(main) {
    const items = DB.learning.items;
    const studyBySubject = DB.study.logs.reduce((m, l) => (m[l.subject] = (m[l.subject] || 0) + l.min, m), {});
    const FIELDS = [
      { key: "name", label: "技術名", type: "text" },
      { key: "progress", label: "進捗率", type: "range" },
      { key: "start", label: "開始日", type: "date" },
      { key: "end", label: "終了予定", type: "date" },
      { key: "link", label: "教材リンク", type: "url", placeholder: "https://…" },
      { key: "memo", label: "メモ", type: "textarea" },
    ];

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Learning</p><h1>学習管理</h1></div>
        <button class="btn" id="add">${icon("plus", 15)} 追加</button>
      </div>
      <div class="stat-grid">
        ${statCard("book", items.filter((i) => i.progress >= 100).length + " / " + items.length, "習得済み")}
        ${statCard("chart", Math.round(items.reduce((s, i) => s + (i.progress || 0), 0) / (items.length || 1)) + "%", "平均進捗")}
        ${statCard("timer", fmtMin(Object.values(studyBySubject).reduce((a, b) => a + b, 0)) || "0分", "総学習時間")}
      </div>
      <div class="grid2">
        ${items.map((i) => `
          <div class="card" style="margin-bottom:0">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <strong style="font-size:15px;flex:1">${esc(i.name)}</strong>
              ${i.progress >= 100 ? `<span class="pill grn">${icon("checkline", 11)} 習得</span>` : `<span class="pill acc">${i.progress || 0}%</span>`}
              ${i.link ? `<a class="icon-btn" href="${esc(i.link)}" target="_blank" rel="noopener">${icon("external", 14)}</a>` : ""}
              <button class="icon-btn" data-edit="${i.id}">${icon("edit", 14)}</button>
            </div>
            <div class="bar ${i.progress >= 100 ? "grn" : ""}"><i style="width:${i.progress || 0}%"></i></div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap" class="small muted">
              ${studyBySubject[i.name] ? `<span class="pill">${fmtMin(studyBySubject[i.name])}</span>` : ""}
              ${i.start ? `<span class="pill">開始 ${fmtShort(i.start)}</span>` : ""}
              ${i.end ? `<span class="pill">目標 ${fmtShort(i.end)}</span>` : ""}
            </div>
            ${i.memo ? `<p class="small muted" style="margin:8px 0 0">${esc(i.memo)}</p>` : ""}
          </div>`).join("")}
      </div>`;

    $("#add").addEventListener("click", async () => {
      const v = await modal("学習項目を追加", FIELDS);
      if (!v || !v.name) return;
      DB.learning.items.push({ id: uid(), ...v });
      await saveDb("learning"); rerender();
    });
    $$("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
      const i = DB.learning.items.find((x) => x.id === b.dataset.edit);
      const v = await modal(i.name + " を編集", FIELDS, i);
      if (!v) return;
      const was = i.progress;
      Object.assign(i, v);
      await saveDb("learning");
      if (was < 100 && v.progress >= 100) { await addXP(100, `${i.name} 習得！`); }
      rerender();
    }));
  },
};

// ===== ポートフォリオ =====

VIEWS.portfolio = {
  title: "作品", icon: "layers",
  render(main) {
    const items = DB.portfolio.items;
    const FIELDS = [
      { key: "title", label: "作品名", type: "text" },
      { key: "progress", label: "完成率", type: "range" },
      { key: "start", label: "制作開始日", type: "date" },
      { key: "due", label: "完成予定", type: "date" },
      { key: "tech", label: "使用技術", type: "tags", placeholder: "例: HTML, CSS, JavaScript" },
      { key: "github", label: "GitHubリンク", type: "url" },
      { key: "demo", label: "デモリンク", type: "url" },
      { key: "memo", label: "メモ", type: "textarea" },
    ];
    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Portfolio</p><h1>ポートフォリオ</h1></div>
        <button class="btn" id="add">${icon("plus", 15)} 作品を追加</button>
      </div>
      <div class="grid2">
        ${items.map((p) => `
          <div class="card" style="margin-bottom:0">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <strong style="font-size:15px;flex:1">${esc(p.title)}</strong>
              ${p.progress >= 100 ? '<span class="pill grn">完成</span>' : `<span class="pill acc">${p.progress || 0}%</span>`}
              <button class="icon-btn" data-edit="${p.id}">${icon("edit", 14)}</button>
              <button class="icon-btn danger" data-del="${p.id}">${icon("trash", 14)}</button>
            </div>
            <div class="bar ${p.progress >= 100 ? "grn" : ""}"><i style="width:${p.progress || 0}%"></i></div>
            <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
              ${(p.tech || []).map((t) => `<span class="pill acc">${esc(t)}</span>`).join("")}
              ${p.start ? `<span class="pill">開始 ${fmtShort(p.start)}</span>` : ""}
              ${p.due ? `<span class="pill">予定 ${fmtShort(p.due)}</span>` : ""}
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              ${p.github ? `<a class="btn ghost sm" href="${esc(p.github)}" target="_blank" rel="noopener">${icon("link", 13)} GitHub</a>` : ""}
              ${p.demo ? `<a class="btn ghost sm" href="${esc(p.demo)}" target="_blank" rel="noopener">${icon("external", 13)} デモ</a>` : ""}
            </div>
            ${p.memo ? `<p class="small muted" style="margin:10px 0 0">${esc(p.memo)}</p>` : ""}
          </div>`).join("") || '<p class="empty">まだ作品がありません。1つ目を作りましょう。</p>'}
      </div>`;

    $("#add").addEventListener("click", async () => {
      const v = await modal("作品を追加", FIELDS);
      if (!v || !v.title) return;
      DB.portfolio.items.push({ id: uid(), ...v });
      await saveDb("portfolio"); rerender();
    });
    $$("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
      const p = DB.portfolio.items.find((x) => x.id === b.dataset.edit);
      const v = await modal("作品を編集", FIELDS, p);
      if (!v) return;
      const was = p.progress;
      Object.assign(p, v); await saveDb("portfolio");
      if (was < 100 && v.progress >= 100) await addXP(150, "作品完成！");
      rerender();
    }));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!(await confirmBox("この作品を削除しますか？"))) return;
      DB.portfolio.items = DB.portfolio.items.filter((x) => x.id !== b.dataset.del);
      await saveDb("portfolio"); rerender();
    }));
  },
};

// ===== 案件管理 =====

VIEWS.projects = {
  title: "案件", icon: "briefcase",
  render(main) {
    const items = DB.projects.items;
    const totalAmt = items.reduce((s, p) => s + (p.amount || 0), 0);
    const unpaid = items.filter((p) => p.paid !== "入金済み").reduce((s, p) => s + (p.amount || 0), 0);
    const FIELDS = [
      { key: "client", label: "クライアント", type: "text" },
      { key: "name", label: "案件名", type: "text" },
      { key: "amount", label: "金額（円）", type: "money", placeholder: "100000" },
      { key: "contract", label: "契約日", type: "date" },
      { key: "deadline", label: "納期", type: "date" },
      { key: "invoice", label: "請求状況", type: "select", options: ["未請求", "請求済み"] },
      { key: "paid", label: "入金状況", type: "select", options: ["未入金", "入金済み"] },
      { key: "progress", label: "進捗率", type: "range" },
      { key: "memo", label: "メモ", type: "textarea" },
    ];
    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Projects</p><h1>案件管理</h1></div>
        <button class="btn" id="add">${icon("plus", 15)} 案件を追加</button>
      </div>
      <div class="stat-grid">
        ${statCard("briefcase", items.length, "案件数", "件")}
        ${statCard("yen", fmtYen(totalAmt), "受注総額")}
        ${statCard("clock", fmtYen(unpaid), "入金待ち")}
      </div>
      ${items.map((p) => {
        const over = p.deadline && p.deadline < todayStr() && (p.progress || 0) < 100;
        return `<div class="card">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            <div style="flex:1;min-width:160px">
              <strong style="font-size:15px">${esc(p.name)}</strong>
              <span class="small muted" style="margin-left:8px">${esc(p.client)}</span>
            </div>
            <strong style="font-size:16px">${fmtYen(p.amount)}</strong>
            <button class="icon-btn" data-edit="${p.id}">${icon("edit", 14)}</button>
            <button class="icon-btn danger" data-del="${p.id}">${icon("trash", 14)}</button>
          </div>
          <div class="bar"><i style="width:${p.progress || 0}%"></i></div>
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            <span class="pill ${p.invoice === "請求済み" ? "grn" : "amb"}">${esc(p.invoice || "未請求")}</span>
            <span class="pill ${p.paid === "入金済み" ? "grn" : "amb"}">${esc(p.paid || "未入金")}</span>
            ${p.deadline ? `<span class="pill ${over ? "red" : ""}">納期 ${fmtShort(p.deadline)}</span>` : ""}
            ${p.contract ? `<span class="pill">契約 ${fmtShort(p.contract)}</span>` : ""}
            <span class="pill acc">${p.progress || 0}%</span>
          </div>
          ${p.memo ? `<p class="small muted" style="margin:8px 0 0">${esc(p.memo)}</p>` : ""}
        </div>`;
      }).join("") || '<p class="empty">案件はまだありません。最初の1件を獲りにいこう。</p>'}`;

    $("#add").addEventListener("click", async () => {
      const v = await modal("案件を追加", FIELDS, { invoice: "未請求", paid: "未入金" });
      if (!v || !v.name) return;
      DB.projects.items.push({ id: uid(), ...v });
      await saveDb("projects");
      await addXP(XP_RULES.project, "案件を獲得！");
      rerender();
    });
    $$("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
      const p = DB.projects.items.find((x) => x.id === b.dataset.edit);
      const v = await modal("案件を編集", FIELDS, p);
      if (!v) return;
      const wasPaid = p.paid;
      Object.assign(p, v); await saveDb("projects");
      if (wasPaid !== "入金済み" && v.paid === "入金済み") await addXP(XP_RULES.paid, "入金確認！");
      rerender();
    }));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!(await confirmBox("この案件を削除しますか？"))) return;
      DB.projects.items = DB.projects.items.filter((x) => x.id !== b.dataset.del);
      await saveDb("projects"); rerender();
    }));
  },
};

// ===== 営業管理 =====

const CHANNELS = ["Instagram", "X", "TikTok", "メール", "DM"];

VIEWS.outreach = {
  title: "営業", icon: "send",
  render(main) {
    const logs = DB.outreach.logs;
    const sum = (k) => logs.reduce((s, l) => s + (l[k] || 0), 0);
    const rate = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
    const byCh = CHANNELS.map((ch) => {
      const ls = logs.filter((l) => l.channel === ch);
      const sent = ls.reduce((s, l) => s + (l.sent || 0), 0);
      return { label: ch, value: sent };
    });

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Outreach</p><h1>営業管理</h1></div>
        <button class="btn" id="add">${icon("plus", 15)} 営業を記録</button>
      </div>
      <div class="stat-grid">
        ${statCard("send", sum("sent"), "営業件数", "件")}
        ${statCard("chart", rate(sum("replies"), sum("sent")), "返信率")}
        ${statCard("trophy", rate(sum("orders"), sum("sent")), "受注率")}
      </div>
      <div class="grid2">
        <div class="card" style="margin-bottom:0"><h2>${icon("chart", 15)} チャネル別 送信数</h2>${hbars(byCh)}</div>
        <div class="card" style="margin-bottom:0">
          <h2>${icon("calendar", 15)} 最近の記録</h2>
          ${logs.slice(-8).reverse().map((l) => `
            <div class="row">
              <span class="pill acc">${esc(l.channel)}</span>
              <span class="row-title small">${fmtShort(l.date)} — 送信${l.sent} / 返信${l.replies} / 受注${l.orders}</span>
              <button class="icon-btn danger row-del" data-del="${l.id}">${icon("trash", 13)}</button>
            </div>`).join("") || '<p class="empty">記録がありません</p>'}
        </div>
      </div>`;

    $("#add").addEventListener("click", async () => {
      const v = await modal("営業を記録", [
        { key: "date", label: "日付", type: "date", default: todayStr() },
        { key: "channel", label: "チャネル", type: "select", options: CHANNELS },
        { key: "sent", label: "送信数", type: "number", placeholder: "10" },
        { key: "replies", label: "返信数", type: "number", placeholder: "2" },
        { key: "orders", label: "受注数", type: "number", placeholder: "0" },
      ]);
      if (!v) return;
      DB.outreach.logs.push({ id: uid(), ...v, date: v.date || todayStr() });
      await saveDb("outreach");
      if (v.sent) await addXP(Math.min(v.sent * 2, 60), "営業した");
      rerender();
    });
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      DB.outreach.logs = DB.outreach.logs.filter((x) => x.id !== b.dataset.del);
      await saveDb("outreach"); rerender();
    }));
  },
};

// ===== 売上管理 =====

const SALE_SOURCES = ["Web制作", "Uber", "その他"];

VIEWS.sales = {
  title: "売上", icon: "yen",
  async render(main) {
    await refreshSales(); // 収入トランザクションのミラーを反映
    const logs = DB.sales.logs;
    const mk = monthKey(todayStr());
    const monthSum = (key) => logs.filter((l) => monthKey(l.date) === key).reduce((s, l) => s + l.amount, 0);
    const monthCost = (key) => logs.filter((l) => monthKey(l.date) === key).reduce((s, l) => s + (l.cost || 0), 0);
    const monthProfit = (key) => monthSum(key) - monthCost(key);
    const total = logs.reduce((s, l) => s + l.amount, 0);
    const goal = DB.settings.salesGoal || 0;
    const diff = monthSum(mk) - goal;

    // 直近6ヶ月
    const months = [...Array(6)].map((_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const bySource = SALE_SOURCES.map((s) => ({ label: s, value: logs.filter((l) => l.source === s).reduce((a, l) => a + l.amount, 0) }));

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Revenue</p><h1>売上管理</h1></div>
        <button class="btn" id="add">${icon("plus", 15)} 売上を記録</button>
      </div>
      <div class="stat-grid">
        ${statCard("yen", fmtYen(monthSum(mk)), "今月の売上")}
        ${statCard("wallet", fmtYen(monthCost(mk)), "今月の経費")}
        ${statCard(monthProfit(mk) >= 0 ? "trophy" : "clock", fmtYen(monthProfit(mk)).replace("¥-", "-¥"), "今月の利益")}
        ${statCard("target", (diff >= 0 ? "+" : "") + fmtYen(diff).replace("¥-", "-¥"), "目標との差")}
      </div>
      <div class="grid2">
        <div class="card" style="margin-bottom:0">
          <h2>${icon("chart", 15)} 月別売上（6ヶ月）</h2>
          ${vbars(months.map(monthSum), months.map((m) => +m.slice(5) + "月"), fmtYen)}
        </div>
        <div class="card" style="margin-bottom:0"><h2>${icon("layers", 15)} 収入源別</h2>${hbars(bySource, fmtYen)}</div>
      </div>
      <div class="card" style="margin-top:18px">
        <h2>${icon("calendar", 15)} 最近の記録</h2>
        ${logs.slice(-10).reverse().map((l) => `
          <div class="row">
            <span class="pill acc">${esc(l.source)}</span>
            <span class="row-title small">${fmtShort(l.date)}${l.memo ? " — " + esc(l.memo) : ""}${l.cost ? ` <span style="color:var(--muted)">（経費 ${fmtYen(l.cost)}・利益 ${fmtYen(l.amount - l.cost)}）</span>` : ""}</span>
            <strong>${fmtYen(l.amount)}</strong>
            <button class="icon-btn danger row-del" data-del="${l.id}">${icon("trash", 13)}</button>
          </div>`).join("") || '<p class="empty">売上記録がありません</p>'}
      </div>`;

    $("#add").addEventListener("click", async () => {
      const v = await modal("売上を記録", [
        { key: "date", label: "日付", type: "date", default: todayStr() },
        { key: "amount", label: "売上金額（円）", type: "money", placeholder: "50000" },
        { key: "cost", label: "経費（任意・円）", type: "money", placeholder: "0" },
        { key: "source", label: "収入源", type: "select", options: SALE_SOURCES },
        { key: "memo", label: "メモ", type: "text", placeholder: "例: ◯◯様 LP制作" },
      ]);
      if (!v || !v.amount) return;
      // 売上(収入)＋任意の経費(支出)を記録。残高に反映＆売上明細にミラー、利益も計算できる。
      try {
        await api("/api/sales", { method: "POST", body: JSON.stringify({ amount: Math.round(v.amount), cost: Math.round(v.cost || 0), source: v.source, date: v.date || todayStr(), memo: v.memo }) });
      } catch (e) { toast(e.message, "x"); return; }
      await refreshSales();
      await addXP(Math.min(Math.round(v.amount / 1000), 300), "売上を記録！");
      rerender();
    });
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      const entry = DB.sales.logs.find((x) => x.id === b.dataset.del);
      try {
        if (entry?.txId) await api("/api/transactions/" + entry.txId, { method: "DELETE" }); // 取引ごと消す（残高も戻る）
        else { DB.sales.logs = DB.sales.logs.filter((x) => x.id !== b.dataset.del); await saveDb("sales"); }
      } catch (e) { toast(e.message, "x"); return; }
      await refreshSales(); rerender();
    }));
  },
};

// ===== お金（残高・収入・支出） =====
// 取引はサーバーのSQLテーブル。docではないので描画時にAPIから取得する。

const TX_INCOME_CATS = [{ name: "Web制作", icon: "layers", color: "#3B82F6" }, { name: "Uber", icon: "send", color: "#10B981" }, { name: "その他", icon: "grid", color: "#9AA3B2" }];
const TX_EXPENSE_CATS = [{ name: "生活費", icon: "home", color: "#3B82F6" }, { name: "事業経費", icon: "briefcase", color: "#8B5CF6" }, { name: "ツール代", icon: "settings", color: "#6B7280" }, { name: "その他", icon: "grid", color: "#9AA3B2" }];
// 初回に用意する一般的なカテゴリー（Zaim風）。既存のカテゴリーと統合される（重複は名前で除外）
const CAT_SEED_EXPENSE = [
  { name: "食費", icon: "utensils", color: "#F97316" },
  { name: "日用品", icon: "milk", color: "#10B981" },
  { name: "衣服", icon: "shirt", color: "#3B82F6" },
  { name: "美容", icon: "lipstick", color: "#EC4899" },
  { name: "交際費", icon: "wine", color: "#EAB308" },
  { name: "医療費", icon: "pill", color: "#10B981" },
  { name: "教育費", icon: "book", color: "#EF4444" },
  { name: "光熱費", icon: "droplet", color: "#06B6D4" },
  { name: "交通費", icon: "train", color: "#B45309" },
  { name: "通信費", icon: "phone", color: "#6B7280" },
  { name: "住居費", icon: "home", color: "#F59E0B" },
];
const CAT_SEED_INCOME = [
  { name: "給料", icon: "wallet", color: "#10B981" },
  { name: "おこづかい", icon: "piggy", color: "#F97316" },
  { name: "賞与", icon: "gift", color: "#F97316" },
  { name: "副業", icon: "moneybag", color: "#06B6D4" },
  { name: "投資", icon: "coins", color: "#14B8A6" },
  { name: "臨時収入", icon: "handcoins", color: "#EC4899" },
];
// カテゴリーに付けられるアイコンの候補（自分で追加するときに選べる）
const CAT_ICON_CHOICES = ["home", "briefcase", "send", "yen", "wallet", "card", "dollar", "trending", "coins", "moneybag", "handcoins", "piggy", "layers", "book", "graduation", "target", "trophy", "chart", "calendar", "settings", "grid", "zap", "plug", "wifi", "droplet", "flame", "timer", "file", "receipt", "download", "link", "external", "coffee", "utensils", "milk", "wine", "cart", "bag", "gift", "lipstick", "car", "train", "plane", "fuel", "heart", "pill", "music", "film", "gamepad", "shirt", "dumbbell", "scissors", "phone", "star"];
// カテゴリーに付けられる色の候補（プリセット。hex直接入力も可）
const CAT_COLOR_CHOICES = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#14B8A6", "#06B6D4", "#6366F1", "#84CC16", "#F97316", "#6B7280"];
const DEFAULT_CAT_COLOR = "#9AA3B2";
// 保存済みのカテゴリーは {name, icon, color} のはずだが、古い形式（文字列だけ、colorなし）が残っていても動くようにする
const normCat = (c) => (typeof c === "string" ? { name: c, icon: "grid", color: DEFAULT_CAT_COLOR } : { color: DEFAULT_CAT_COLOR, ...c });
// 移行後はカテゴリーをすべて DB.categories[kind] に持つ（追加/編集/削除/並べ替え可能）。
// 移行前は旧デフォルト（定数）＋ユーザー追加分を合成して返す。
const moneyCatList = (kind) => DB.categories?.migrated
  ? (DB.categories[kind] || []).map(normCat)
  : [...(kind === "income" ? TX_INCOME_CATS : TX_EXPENSE_CATS), ...((DB.categories?.[kind]) || []).map(normCat)];
// 一般セット＋旧デフォルト＋既存カスタムを、名前で重複除去しつつ1つの配列に統合して保存する（初回だけ）
async function ensureCategoriesMigrated() {
  if (DB.categories.migrated) return;
  const merge = (...lists) => {
    const seen = new Set(), out = [];
    for (const list of lists) for (const raw of list) {
      const c = normCat(raw);
      if (seen.has(c.name)) continue;
      seen.add(c.name);
      out.push({ name: c.name, icon: c.icon, color: c.color, ...(c.employerId ? { employerId: c.employerId } : {}) });
    }
    return out;
  };
  DB.categories.income = merge(CAT_SEED_INCOME, TX_INCOME_CATS, DB.categories.income || []);
  DB.categories.expense = merge(CAT_SEED_EXPENSE, TX_EXPENSE_CATS, DB.categories.expense || []);
  DB.categories.migrated = true;
  await saveDb("categories");
}
// 取引の category（文字列）からアイコン・色を引く。見つからない/未分類の取引は既定アイコン＋グレーでフォールバック
const catMeta = (name, kind) => moneyCatList(kind).find((c) => c.name === name) || { name, icon: "grid", color: DEFAULT_CAT_COLOR };
const signedYen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Number(n) || 0).toLocaleString();
// 勤務先マスタ（給与体系・支払いサイクル）
const employerById = (id) => (DB.employers?.items || []).find((e) => e.id === id);
// 収入カテゴリーが勤務先に紐づいている場合、その勤務先を返す（支出カテゴリーは常にnull）。
// 新しいカテゴリーはcategoryModalで選んだemployerIdを直接持つが、既存カテゴリー「Uber」は
// 名前ベースのlinkedCategoryで紐づける（後から自動生成する勤務先のため、カテゴリー側を書き換えずに済む）
const linkedEmployer = (catName, kind) => {
  if (kind !== "income") return null;
  const meta = catMeta(catName, kind);
  if (meta.employerId) return employerById(meta.employerId);
  return (DB.employers?.items || []).find((e) => e.linkedCategory === catName) || null;
};
// クレジットカードマスタ（締め日・引き落とし日サイクル）
const creditCardById = (id) => (DB.creditCards?.items || []).find((c) => c.id === id);
// 勤務先に紐づく収入は「稼いだ日」、クレジットカードに紐づく支出は「使った日」ではなく、
// それぞれ「給料日/引き落とし日（支払い日）」に計上する。カレンダー/一覧はこの日付でグループ化・表示する
const txDisplayDate = (t) => {
  if (t.type === "income" && t.employerId && t.payoutDate) return t.payoutDate;
  if (t.type === "expense" && t.creditCardId && t.payoutDate) return t.payoutDate;
  return t.date;
};
// 初回だけ: 既存の「Uber」収入カテゴリーに勤務先「Uber Eats」（歩合制・週払い）を自動生成して紐づける。
// 過去の取引はすでに残高に反映済みのままにし、遡ってpending化はしない
async function ensureUberEmployerMigrated() {
  if (DB.employers.migratedUber) return;
  DB.employers.migratedUber = true;
  if (!DB.employers.items.some((e) => e.linkedCategory === "Uber")) {
    DB.employers.items.push({
      id: uid(), name: "Uber Eats", location: "", wageType: "commission", hourlyWage: null,
      payCycle: "weekly", weeklyPayDay: "mon", closingDay: null, paymentDay: null,
      linkedCategory: "Uber",
    });
  }
  await saveDb("employers");
}
let MONEY_TAB = "actual"; // "actual"=収支（実績） / "plan"=予想収支
let MONEY_MONTH = null; // "YYYY-MM"。nullなら当月
let MONEY_CAL_DAY = null; // カレンダーで選択中の日（nullなら月全体を表示）
const EXPANDED_TX_BUNDLES = new Set(); // 展開中の「給料まとめ」行のキー（employerId|payoutDate）
// カレンダーの枠に収めるための短い金額表記（1万円未満はそのまま、以上は「15万」のように丸める）
const fmtYenShort = (n) => {
  n = Math.round(Number(n) || 0);
  if (Math.abs(n) < 10000) return n.toLocaleString();
  const v = Math.round(n / 1000) / 10;
  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "万";
};
const shiftMonth = (mk, n) => { const [y, m] = mk.split("-").map(Number); return monthKey(isoOf(new Date(y, m - 1 + n, 1))); };

// 期間（開始日・終了日、どちらも任意）を「7/1〜9/30」のような短い表記にする
const planPeriodLabel = (it) => (it.from || it.to ? `${it.from ? fmtShort(it.from) : "?"}〜${it.to ? fmtShort(it.to) : "?"}` : "");
// 内訳の1行（一覧では表示のみ。追加・編集は項目モーダルの中で行う）
const planBdRowHTML = (bd) => `<div class="plan-bd-row">
    <span class="bd-name">${esc(bd.name)}</span>
    <span class="bd-note">${esc(bd.note || "")}</span>
    <span class="bd-amount">${fmtYen(bd.amount)}</span>
  </div>`;
const planItemsHTML = (items, blockId, type) => (items.length ? items.map((it) => {
  const period = planPeriodLabel(it);
  return `<div class="plan-item" data-plan-open="${it.id}" data-block="${blockId}" role="button" tabindex="0">
    <div class="plan-item-head">
      <span class="row-title">${esc(it.label)}</span>
      <strong style="color:${type === "income" ? "var(--green)" : "var(--red)"}">${type === "income" ? "+" : "-"}${fmtYen(it.amount)}</strong>
    </div>
    ${(it.breakdown && it.breakdown.length) ? `<div class="plan-bd-list">${it.breakdown.map(planBdRowHTML).join("")}</div>` : ""}
    ${period ? `<div class="plan-detail-line" style="margin-top:6px"><span>期間</span><span>${esc(period)}</span></div>` : ""}
  </div>`;
}).join("") : '<p class="empty">まだ項目がありません</p>');
// ブロック（収入/支出/残高チェックポイント）の名前を追加・編集・削除するモーダル
async function planBlockModal(type, initial) {
  const isEdit = !!initial.id;
  const title = isEdit ? "ブロック名を編集" : (type === "income" ? "予想収入ブロックを追加" : type === "expense" ? "予想出費ブロックを追加" : "残高チェックポイントを追加");
  const defaultTitle = type === "income" ? "予想収入" : type === "expense" ? "予想出費" : "予想残高";
  return modal(title, [
    { key: "title", label: "ブロック名（任意）", type: "text", placeholder: defaultTitle },
  ], { title: initial.title || "" }, isEdit ? { onDelete: "このブロックを削除しますか？（中の項目もすべて削除されます）" } : {});
}
const PLAN_BD_FIELDS = () => [
  { key: "name", label: "項目名", type: "text", placeholder: "例）飛行機" },
  { key: "amount", label: "金額（円）", type: "money", placeholder: "10000" },
  { key: "note", label: "詳細（任意・小さく表示）", type: "text", placeholder: "例）往復LCC" },
];
// 予想収支の項目を追加・編集するモーダル。内訳の追加/編集/削除もこの中だけで完結させる
async function planItemModal(kind, initial) {
  const isEdit = !!initial.id;
  const draft = { label: initial.label || "", amount: initial.amount ?? "", from: initial.from || "", to: initial.to || "", breakdown: [...(initial.breakdown || [])] };
  for (;;) {
    const wrap = $("#modalWrap");
    wrap.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head"><h3>${esc(isEdit ? (kind === "income" ? "予想収入の項目を編集" : "予想出費の項目を編集") : (kind === "income" ? "予想収入の項目を追加" : "予想出費の項目を追加"))}</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <form id="pform">
        <label class="f-label">項目名</label>
        <input type="text" name="label" value="${esc(draft.label)}" placeholder="${kind === "income" ? "例）タックス" : "例）上海ディズニー"}">
        <label class="f-label">金額（円）</label>
        <input type="number" name="amount" value="${esc(draft.amount)}" placeholder="10000" inputmode="numeric">
        <label class="f-label">期間（任意）</label>
        <div class="f-row2">
          <input type="date" name="from" value="${esc(draft.from)}" aria-label="開始日">
          <span class="f-sep">→</span>
          <input type="date" name="to" value="${esc(draft.to)}" aria-label="終了日">
        </div>
        <label class="f-label">内訳（任意）</label>
        <div id="pbdList">${draft.breakdown.map((bd, i) => `<div class="plan-bd-row" data-bd-i="${i}" role="button" tabindex="0">
          <span class="bd-name">${esc(bd.name)}</span><span class="bd-note">${esc(bd.note || "")}</span><span class="bd-amount">${fmtYen(bd.amount)}</span>
        </div>`).join("") || '<p class="empty small">まだ内訳はありません</p>'}</div>
        <button type="button" class="btn ghost sm" id="pbdAdd" style="margin-top:8px">${icon("plus", 13)} 内訳を追加</button>
        <div class="modal-foot">
          ${isEdit ? `<button type="button" class="btn ghost" data-del style="margin-right:auto;color:var(--red);border-color:var(--red)">${icon("trash", 14)} 削除</button>` : ""}
          <button type="button" class="btn ghost" data-x>キャンセル</button>
          <button type="submit" class="btn">${icon("checkline", 15)} 保存</button>
        </div>
      </form>
    </div></div>`;
    document.body.classList.add("modal-open");
    const captureDraft = () => {
      draft.label = wrap.querySelector('input[name=label]').value;
      draft.amount = wrap.querySelector('input[name=amount]').value;
      draft.from = wrap.querySelector('input[name=from]').value;
      draft.to = wrap.querySelector('input[name=to]').value;
    };
    const result = await new Promise((resolve) => {
      wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) resolve({ __cancel: true }); });
      $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => resolve({ __cancel: true })));
      if (isEdit) wrap.querySelector("[data-del]").addEventListener("click", async () => {
        if (await confirmBox("この項目を削除しますか？")) resolve({ __delete: true });
      });
      wrap.querySelector("#pbdAdd").addEventListener("click", () => { captureDraft(); resolve({ __addBd: true }); });
      $$("[data-bd-i]", wrap).forEach((el) => el.addEventListener("click", () => { captureDraft(); resolve({ __editBd: Number(el.dataset.bdI) }); }));
      wrap.querySelector("#pform").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        resolve({ label: String(fd.get("label") || "").trim(), amount: Number(fd.get("amount")) || 0, from: String(fd.get("from") || "").trim(), to: String(fd.get("to") || "").trim() });
      });
    });
    document.body.classList.remove("modal-open");
    if (result.__cancel) { wrap.innerHTML = ""; return null; }
    if (result.__delete) { wrap.innerHTML = ""; return { __delete: true }; }
    if (result.__addBd) {
      const nv = await modal("内訳を追加", PLAN_BD_FIELDS());
      if (nv && nv.name && nv.amount) draft.breakdown.push({ id: uid(), name: nv.name, amount: Math.round(nv.amount), note: nv.note });
      continue;
    }
    if (result.__editBd !== undefined) {
      const bd = draft.breakdown[result.__editBd];
      const nv = await modal("内訳を編集", PLAN_BD_FIELDS(), bd, { onDelete: "この内訳を削除しますか？" });
      if (nv) {
        if (nv.__delete) draft.breakdown.splice(result.__editBd, 1);
        else if (nv.name && nv.amount) Object.assign(bd, { name: nv.name, amount: Math.round(nv.amount), note: nv.note });
      }
      continue;
    }
    if (!result.label || !result.amount) { toast("項目名と金額を入力してください", "x"); draft.label = result.label; draft.amount = result.amount; draft.from = result.from; draft.to = result.to; continue; }
    wrap.innerHTML = "";
    return { label: result.label, amount: Math.round(result.amount), from: result.from, to: result.to, breakdown: draft.breakdown };
  }
}

// 収支カレンダー: 月の日付グリッドに、その日の収入/支出を小さく表示する
function moneyCalGridHTML(mk, txs) {
  const [y, m] = mk.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const gs = new Date(first); gs.setDate(1 - first.getDay());
  const from = isoOf(gs);
  const daysInMonth = new Date(y, m, 0).getDate();
  // 月の最終日を含む週までで止める（翌月の日付だけになる行は出さない。5行の月も6行の月もそのまま）
  const totalCells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const byDate = {};
  for (const t of txs) { (byDate[txDisplayDate(t)] ||= { income: 0, expense: 0 })[t.type] += t.amount; }
  const today = todayStr();
  let cells = "";
  for (let i = 0; i < totalCells; i++) {
    const iso = calAdd(from, i);
    const d = new Date(iso + "T00:00:00");
    const other = d.getMonth() !== m - 1;
    const day = byDate[iso];
    const cls = ["cal-cell", "money-cell", other ? "other" : "", iso === today ? "today" : "", MONEY_CAL_DAY === iso ? "selected" : ""].join(" ");
    cells += `<button class="${cls}" ${other ? "" : `data-mday="${iso}"`}>
      <span class="cc-num">${d.getDate()}</span>
      ${day?.income ? `<span class="mc-inc">+${fmtYenShort(day.income)}</span>` : ""}
      ${day?.expense ? `<span class="mc-exp">-${fmtYenShort(day.expense)}</span>` : ""}
    </button>`;
  }
  return `<div class="cal-wd">${WD_JP.map((w) => `<span>${w}</span>`).join("")}</div><div class="cal-grid" id="moneyCalGrid">${cells}</div>`;
}
// 取引一覧。日付ごとにグループ化し、タップで編集モーダルを開く。
// 勤務先に紐づく収入は「支払い日ごとに1件」へまとめる（＝給料。個別の記録はタップで内訳表示）。
function moneyTxListHTML(txs, filterDay) {
  const list = filterDay ? txs.filter((t) => txDisplayDate(t) === filterDay) : txs;
  if (!list.length) return '<p class="empty">この期間の取引はありません</p>';
  const bundleMap = {};
  const entries = [];
  for (const t of list) {
    const refId = t.type === "income" ? t.employerId : t.creditCardId;
    if (refId && t.payoutDate) {
      const key = t.type + "|" + refId + "|" + t.payoutDate;
      let b = bundleMap[key];
      if (!b) { b = bundleMap[key] = { bundle: true, key, type: t.type, date: t.payoutDate, refId, category: t.category, amount: 0, items: [], pending: false }; entries.push(b); }
      b.amount += t.amount; b.items.push(t);
      if (t.payoutStatus === "pending") b.pending = true;
    } else {
      entries.push(t);
    }
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 日付降順（まとめは支払い日/引き落とし日で並ぶ）
  const groups = [];
  for (const e of entries) {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e); else groups.push({ date: e.date, items: [e] });
  }
  const singleRow = (t) => {
    const inc = t.type === "income";
    const meta = catMeta(t.category, t.type);
    return `<div class="row" data-tx-open="${t.id}" role="button" tabindex="0" style="cursor:pointer">
      <span class="cat-badge" style="color:${meta.color}" aria-label="${esc(meta.name)}">${icon(meta.icon, 22)}</span>
      <span class="row-title">${esc(meta.name)}${t.memo ? `<span class="tx-memo">（${esc(t.memo)}）</span>` : ""}</span>
      ${t.payoutStatus === "pending" ? `<span class="pill ${inc ? "amb" : "vio"}">${inc ? "未収" : "引き落とし予定"}</span>` : ""}
      <strong style="color:${inc ? "var(--green)" : "var(--red)"}">${inc ? "+" : "-"}${fmtYen(t.amount)}</strong>
    </div>`;
  };
  const bundleRow = (b) => {
    const inc = b.type === "income";
    const meta = catMeta(b.category, b.type);
    const ref = inc ? employerById(b.refId) : creditCardById(b.refId);
    const label = ref ? ref.name : meta.name;
    const open = EXPANDED_TX_BUNDLES.has(b.key);
    return `<div class="row" data-bundle="${b.key}" role="button" tabindex="0" style="cursor:pointer">
      <span class="cat-badge" style="color:${meta.color}" aria-label="${esc(label)}">${icon(meta.icon, 22)}</span>
      <span class="row-title">${esc(label)}<span class="tx-memo">（${b.items.length}件）</span></span>
      ${b.pending ? `<span class="pill ${inc ? "amb" : "vio"}">${inc ? "未収" : "引き落とし予定"}</span>` : ""}
      <strong style="color:${inc ? "var(--green)" : "var(--red)"}">${inc ? "+" : "-"}${fmtYen(b.amount)}</strong>
      <span class="cat-chev" style="margin-left:2px">${icon("chevR", 14, open ? "rot90" : "")}</span>
    </div>
    ${open ? `<div class="tx-sub-list">${b.items.map((t) => `<div class="row tx-sub" data-tx-open="${t.id}" role="button" tabindex="0" style="cursor:pointer">
      <span class="tx-sub-date">${fmtShort(t.date)}</span>
      <span class="row-title small">${t.memo ? esc(t.memo) : ""}</span>
      <strong style="color:${inc ? "var(--green)" : "var(--red)"}">${inc ? "+" : "-"}${fmtYen(t.amount)}</strong>
    </div>`).join("")}</div>` : ""}`;
  };
  return groups.map((g) => {
    const net = g.items.reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0);
    return `<div class="tx-date-group">
      <div class="tx-date-head"><span>${fmtDateFull(g.date)}</span><strong style="color:${net < 0 ? "var(--red)" : "var(--ink)"}">${signedYen(net)}</strong></div>
      ${g.items.map((e) => e.bundle ? bundleRow(e) : singleRow(e)).join("")}
    </div>`;
  }).join("");
}
// 新しいカテゴリーを名前+アイコン付きで追加するモーダル。{name, icon} を返す（キャンセルはnull）
// アイコンをタップしてもモーダルを作り直さず、選択枠の付け替えだけ行う（チカチカ防止）
// txFormModal（取引を追加）の中から呼ばれることを前提に、#modalWrapを上書きせず
// 独立したオーバーレイをbodyに重ねて表示する（#modalWrapを上書きすると呼び出し元の
// モーダルのDOM/イベントリスナーごと消えてしまい、保存後に取引モーダルが閉じてしまうため）
function categoryModal(kind, initial = {}) {
  const isEdit = !!initial.name;
  const draft = { icon: initial.icon || CAT_ICON_CHOICES[0], color: initial.color || CAT_COLOR_CHOICES[0] };
  const showEmpField = kind === "income" && (DB.employers?.items || []).length > 0;
  return new Promise((resolve) => {
    const box = document.createElement("div");
    const finish = (result) => { box.remove(); resolve(result); };
    box.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head"><h3>${esc(isEdit ? "カテゴリーを編集" : "カテゴリーを追加")}</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <form id="cform">
        <label class="f-label">名前</label>
        <input type="text" name="name" value="${esc(initial.name || "")}" placeholder="例）交際費">
        <label class="f-label">アイコン</label>
        <div class="cat-grid">${CAT_ICON_CHOICES.map((ic) => `<button type="button" class="cat-tile ${draft.icon === ic ? "active" : ""}" data-icon="${ic}"><span class="cat-tile-ic" style="color:${draft.color}">${icon(ic, 20)}</span></button>`).join("")}</div>
        <label class="f-label">色</label>
        <div class="color-grid">${CAT_COLOR_CHOICES.map((c) => `<button type="button" class="color-swatch ${draft.color === c ? "active" : ""}" data-color="${c}" style="background:${c}"></button>`).join("")}</div>
        <input type="text" name="colorHex" value="${esc(draft.color)}" placeholder="#RRGGBB" style="margin-top:8px" maxlength="7">
        ${showEmpField ? `<label class="f-label">勤務先に紐づける（任意）</label>
        <select name="employerId">
          <option value="">紐づけない</option>
          ${DB.employers.items.map((e) => `<option value="${e.id}" ${initial.employerId === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}
        </select>` : ""}
        <div class="modal-foot">
          ${isEdit ? `<button type="button" class="btn ghost" data-del style="margin-right:auto;color:var(--red);border-color:var(--red)">${icon("trash", 14)} 削除</button>` : ""}
          <button type="button" class="btn ghost" data-x>キャンセル</button>
          <button type="submit" class="btn">${icon("checkline", 15)} ${isEdit ? "保存" : "追加"}</button>
        </div>
      </form>
    </div></div>`;
    document.body.appendChild(box);
    // アイコンの色プレビューを今の選択色に合わせて更新する
    const paintIcons = () => $$(".cat-tile-ic", box).forEach((s) => (s.style.color = draft.color));
    box.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) finish(null); });
    $$("[data-x]", box).forEach((b) => b.addEventListener("click", () => finish(null)));
    if (isEdit) box.querySelector("[data-del]").addEventListener("click", async () => {
      if (await confirmBox(`「${initial.name}」を削除しますか？`)) finish({ __delete: true });
    });
    $$("[data-icon]", box).forEach((b) => b.addEventListener("click", () => {
      $$("[data-icon]", box).forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      draft.icon = b.dataset.icon;
    }));
    $$("[data-color]", box).forEach((b) => b.addEventListener("click", () => {
      $$("[data-color]", box).forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      draft.color = b.dataset.color;
      box.querySelector('input[name=colorHex]').value = draft.color;
      paintIcons();
    }));
    box.querySelector('input[name=colorHex]').addEventListener("input", (e) => {
      const hex = e.target.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) { draft.color = hex; paintIcons(); }
    });
    box.querySelector("#cform").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get("name") || "").trim();
      if (!name) { toast("名前を入力してください", "x"); return; }
      const hex = String(fd.get("colorHex") || "").trim();
      const color = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : draft.color;
      const employerId = showEmpField ? (String(fd.get("employerId") || "").trim() || null) : null;
      finish({ name, icon: draft.icon, color, employerId });
    });
  });
}
// カテゴリーグリッドのHTML（追加タイル込み）。アイコンは設定した色（線の色）で表示する
const txCatGridHTML = (cats, selected) => cats.map((c) => `<button type="button" class="cat-tile ${selected === c.name ? "active" : ""}" data-cat="${esc(c.name)}"><span class="cat-tile-ic" style="color:${(normCat(c).color)}">${icon(c.icon, 20)}</span><span>${esc(c.name)}</span></button>`).join("")
  + `<button type="button" class="cat-tile cat-tile-add" id="txCatAdd">${icon("plus", 20)}<span>追加・編集</span></button>`;

// 収入/支出を追加・編集する統一モーダル。
// タブ切替・日付ナビ・カテゴリー選択は、その場でDOMを直接書き換えるだけにして、
// モーダル全体を毎回作り直さないようにする（作り直すと入場アニメーションが再生されて画面がチカチカする）
function txFormModal(initial = {}) {
  const isEdit = !!initial.id;
  const draft = {
    kind: initial.type || "expense",
    date: initial.date || todayStr(),
    amount: initial.amount ?? "",
    cost: initial.cost ?? "",
    memo: initial.memo || "",
    category: initial.category || "",
    employerId: initial.employerId || null,
    hours: initial.hours ?? "",
    creditCardId: initial.creditCardId || null,
  };
  const cats0 = moneyCatList(draft.kind);
  if (!draft.category) draft.category = cats0[0]?.name || "";

  return new Promise((resolve) => {
    const wrap = $("#modalWrap");
    const finish = (result) => { wrap.innerHTML = ""; document.body.classList.remove("modal-open"); resolve(result); };
    const isIncome = () => draft.kind === "income";

    wrap.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head"><h3>${esc(isEdit ? "取引を編集" : "取引を追加")}</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <form id="txform">
        <div class="tabs">
          <button type="button" class="tab ${!isIncome() ? "active" : ""}" data-kind="expense" ${isEdit ? "disabled" : ""}>支出</button>
          <button type="button" class="tab ${isIncome() ? "active" : ""}" data-kind="income" ${isEdit ? "disabled" : ""}>収入</button>
        </div>
        <label class="f-label">日付</label>
        <div class="f-row2">
          <button type="button" class="icon-btn" id="txDatePrev">${icon("chevR", 16, "flip")}</button>
          <input type="date" name="date" value="${esc(draft.date)}" style="flex:1">
          <button type="button" class="icon-btn" id="txDateNext">${icon("chevR", 16)}</button>
        </div>
        <label class="f-label">金額（円）</label>
        <input type="number" name="amount" value="${esc(draft.amount)}" placeholder="10000" inputmode="numeric">
        <div id="txCostRow" style="${isIncome() ? "" : "display:none"}">
          <label class="f-label">経費（任意・円）</label>
          <input type="number" name="cost" value="${esc(draft.cost)}" placeholder="0" inputmode="numeric">
        </div>
        <label class="f-label">メモ（任意）</label>
        <input type="text" name="memo" value="${esc(draft.memo)}" placeholder="任意">
        <label class="f-label">カテゴリー</label>
        <div class="cat-grid" id="txCatGrid">${txCatGridHTML(cats0, draft.category)}</div>
        <div id="txCardRow" style="display:none">
          <label class="f-label">支払い方法</label>
          <div class="tabs" id="txCardTabs"></div>
        </div>
        <div id="txHoursRow" style="display:none">
          <label class="f-label">勤務時間（時間）</label>
          <input type="number" name="hours" value="${esc(draft.hours)}" placeholder="8" step="0.25" inputmode="decimal">
        </div>
        <div class="modal-foot">
          ${isEdit ? `<button type="button" class="btn ghost" data-del style="margin-right:auto;color:var(--red);border-color:var(--red)">${icon("trash", 14)} 削除</button>` : ""}
          <button type="button" class="btn ghost" data-x>キャンセル</button>
          <button type="submit" class="btn" id="txSubmit" style="${!isIncome() ? "background:var(--red);border:none" : ""}">${isIncome() ? "収入" : "支出"}を記録</button>
        </div>
      </form>
    </div></div>`;
    document.body.classList.add("modal-open");

    // 選択中カテゴリーが勤務先に紐づいていれば、勤務時間欄を出す。時給制ならその場で金額も自動計算する
    const updateLinkedFields = () => {
      const emp = linkedEmployer(draft.category, draft.kind);
      const row = $("#txHoursRow", wrap);
      draft.employerId = emp ? emp.id : null;
      if (!emp) { row.style.display = "none"; } else {
        row.style.display = "";
        row.querySelector(".f-label").textContent = emp.wageType === "hourly" ? "勤務時間（時間・自動計算に使用）" : "勤務時間（任意・記録用）";
      }
    };
    $("#txHoursRow input[name=hours]", wrap).addEventListener("input", (e) => {
      const emp = draft.employerId && employerById(draft.employerId);
      if (emp && emp.wageType === "hourly") {
        const h = Number(e.target.value) || 0;
        $("input[name=amount]", wrap).value = Math.round(h * (Number(emp.hourlyWage) || 0));
      }
    });
    // 支出のとき、取引ごとに任意で支払い方法（現金 or 登録済みカード）を選べるようにする。
    // カテゴリーには依存せず、この取引だけの選択（同じカテゴリーでも現金/カード払いを都度選べる）
    const bindCardTabs = () => {
      $$("#txCardTabs [data-card]", wrap).forEach((b) => b.addEventListener("click", () => {
        if (b.classList.contains("active")) return;
        $$("#txCardTabs [data-card]", wrap).forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        draft.creditCardId = b.dataset.card || null;
      }));
    };
    const updateCardRow = () => {
      const row = $("#txCardRow", wrap);
      const cards = DB.creditCards?.items || [];
      if (isIncome() || !cards.length) { row.style.display = "none"; return; }
      row.style.display = "";
      $("#txCardTabs", wrap).innerHTML = `<button type="button" class="tab ${!draft.creditCardId ? "active" : ""}" data-card="">現金</button>`
        + cards.map((c) => `<button type="button" class="tab ${draft.creditCardId === c.id ? "active" : ""}" data-card="${c.id}">${esc(c.name)}</button>`).join("");
      bindCardTabs();
    };
    const bindCatGrid = () => {
      $$("[data-cat]", wrap).forEach((b) => b.addEventListener("click", () => {
        $$("[data-cat]", wrap).forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        draft.category = b.dataset.cat;
        updateLinkedFields();
      }));
      $("#txCatAdd", wrap).addEventListener("click", async () => {
        await categoryManageModal(draft.kind);
        // 管理画面で追加/編集/削除/並べ替えがあったかもしれないので、カテゴリー欄を作り直す
        const cats = moneyCatList(draft.kind);
        if (!cats.some((c) => c.name === draft.category)) draft.category = cats[0]?.name || "";
        $("#txCatGrid", wrap).innerHTML = txCatGridHTML(cats, draft.category);
        bindCatGrid();
        updateLinkedFields();
      });
    };
    bindCatGrid();
    updateLinkedFields();
    updateCardRow();

    wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) finish(null); });
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => finish(null)));
    if (isEdit) wrap.querySelector("[data-del]").addEventListener("click", async () => {
      if (await confirmBox("この取引を削除しますか？")) finish({ __delete: true });
    });
    $$("[data-kind]", wrap).forEach((b) => b.addEventListener("click", () => {
      if (b.disabled || b.classList.contains("active")) return;
      $$("[data-kind]", wrap).forEach((x) => x.classList.toggle("active", x === b));
      draft.kind = b.dataset.kind;
      const cats = moneyCatList(draft.kind);
      draft.category = cats[0]?.name || "";
      $("#txCostRow", wrap).style.display = isIncome() ? "" : "none";
      $("#txCatGrid", wrap).innerHTML = txCatGridHTML(cats, draft.category);
      bindCatGrid();
      updateLinkedFields();
      updateCardRow();
      const submit = $("#txSubmit", wrap);
      submit.textContent = isIncome() ? "収入を記録" : "支出を記録";
      submit.style.background = isIncome() ? "" : "var(--red)";
      submit.style.border = isIncome() ? "" : "none";
    }));
    $("#txDatePrev", wrap).addEventListener("click", () => { $("input[name=date]", wrap).value = calAdd($("input[name=date]", wrap).value, -1); });
    $("#txDateNext", wrap).addEventListener("click", () => { $("input[name=date]", wrap).value = calAdd($("input[name=date]", wrap).value, 1); });
    wrap.querySelector("#txform").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const amount = Number(fd.get("amount")) || 0;
      if (!amount) { toast("金額を入力してください", "x"); return; }
      finish({
        type: draft.kind,
        date: String(fd.get("date") || "").trim() || todayStr(),
        amount,
        cost: Number(fd.get("cost")) || 0,
        memo: String(fd.get("memo") || "").trim(),
        category: draft.category,
        employerId: draft.employerId || null,
        hours: draft.employerId ? (Number(fd.get("hours")) || null) : null,
        creditCardId: draft.kind === "expense" ? (draft.creditCardId || null) : null,
      });
    });
  });
}

// 勤務先一覧。各カードに未収合計・次回入金日（渡されていれば）を表示し、タップで編集
function employerListHTML(items, pendingMap) {
  if (!items.length) return '<p class="empty">まだ勤務先が登録されていません</p>';
  return items.map((e) => {
    const p = pendingMap[e.id];
    const wage = e.wageType === "hourly" ? `時給¥${Number(e.hourlyWage || 0).toLocaleString()}` : "歩合制";
    const cycle = e.payCycle === "weekly" ? `週払い（${WD_SHORT[WD_KEYS.indexOf(e.weeklyPayDay)] || ""}曜日）` : `月払い（${e.closingDay || 31}日締め翌${e.paymentDay || 25}日払い）`;
    return `<div class="card" data-emp-open="${e.id}" role="button" tabindex="0" style="cursor:pointer;margin-bottom:12px">
      <h2>${icon("briefcase", 15)} ${esc(e.name)}</h2>
      <p class="small" style="color:var(--muted);margin:2px 0 0">${esc(wage)}・${esc(cycle)}</p>
      ${e.linkedCategory ? `<p class="small" style="color:var(--muted);margin:4px 0 0">${icon("link", 12)} 収入カテゴリー「${esc(e.linkedCategory)}」と連動</p>` : ""}
      ${p ? `<div class="f-row2" style="margin-top:10px;gap:16px">
        <div><p class="small" style="color:var(--muted);margin:0 0 2px">未収合計</p><p style="margin:0;font-weight:800">${fmtYen(p.total)}</p></div>
        <div><p class="small" style="color:var(--muted);margin:0 0 2px">次回入金日</p><p style="margin:0;font-weight:800">${fmtDateFull(p.nextPayoutDate)}</p></div>
      </div>` : ""}
    </div>`;
  }).join("");
}
// 勤務先を追加・編集するモーダル。給与形態・支払いサイクルの切替はDOM直接書き換え（チカチカ防止）
function employerModal(initial = {}) {
  const isEdit = !!initial.id;
  const draft = {
    wageType: initial.wageType || "hourly",
    payCycle: initial.payCycle || "weekly",
    weeklyPayDay: initial.weeklyPayDay || "fri",
  };
  const incomeCats = moneyCatList("income");
  return new Promise((resolve) => {
    const wrap = $("#modalWrap");
    const finish = (result) => { wrap.innerHTML = ""; document.body.classList.remove("modal-open"); resolve(result); };
    const isHourly = () => draft.wageType === "hourly";
    const isWeekly = () => draft.payCycle === "weekly";
    const wageFieldsHTML = () => isHourly() ? `
      <label class="f-label">時給（円）</label>
      <input type="number" name="hourlyWage" value="${esc(initial.hourlyWage ?? "")}" placeholder="1200" inputmode="numeric">` : "";
    const cycleFieldsHTML = () => isWeekly() ? `
      <label class="f-label">支払い曜日</label>
      <div class="wd-picker">${WD_SHORT.map((label, i) => `<button type="button" class="wd-chip ${draft.weeklyPayDay === WD_KEYS[i] ? "active" : ""}" data-wd="${WD_KEYS[i]}">${label}</button>`).join("")}</div>` : `
      <label class="f-label">締め日・支払日</label>
      <div class="f-row2">
        <input type="number" name="closingDay" value="${esc(initial.closingDay ?? 31)}" min="1" max="31" placeholder="末日締め=31">
        <span class="f-sep">→ 翌</span>
        <input type="number" name="paymentDay" value="${esc(initial.paymentDay ?? 25)}" min="1" max="31" placeholder="25日払い">
      </div>`;

    wrap.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head"><h3>${esc(isEdit ? "勤務先を編集" : "勤務先を追加")}</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <form id="empform">
        <label class="f-label">名前</label>
        <input type="text" name="name" value="${esc(initial.name || "")}" placeholder="例）Uber Eats">
        <label class="f-label">勤務地（任意）</label>
        <input type="text" name="location" value="${esc(initial.location || "")}" placeholder="例）渋谷区">
        <label class="f-label">給与形態</label>
        <div class="tabs">
          <button type="button" class="tab ${isHourly() ? "active" : ""}" data-wage="hourly">時給制</button>
          <button type="button" class="tab ${!isHourly() ? "active" : ""}" data-wage="commission">歩合制</button>
        </div>
        <div id="empWageFields">${wageFieldsHTML()}</div>
        <label class="f-label">支払いサイクル</label>
        <div class="tabs">
          <button type="button" class="tab ${isWeekly() ? "active" : ""}" data-cycle="weekly">週払い</button>
          <button type="button" class="tab ${!isWeekly() ? "active" : ""}" data-cycle="monthly">月払い</button>
        </div>
        <div id="empCycleFields">${cycleFieldsHTML()}</div>
        <label class="f-label">連動する収入カテゴリー（任意）</label>
        <select name="linkedCategory">
          <option value="">連動しない</option>
          ${incomeCats.map((c) => `<option value="${esc(c.name)}" ${initial.linkedCategory === c.name ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select>
        <p class="hint" style="margin-top:8px">ここで選んだ収入カテゴリーで記録した収入は、給料日まで「未収」になり、給料日が来たら自動で残高に追加されます。</p>
        <div class="modal-foot">
          ${isEdit ? `<button type="button" class="btn ghost" data-del style="margin-right:auto;color:var(--red);border-color:var(--red)">${icon("trash", 14)} 削除</button>` : ""}
          <button type="button" class="btn ghost" data-x>キャンセル</button>
          <button type="submit" class="btn">${icon("checkline", 15)} 保存</button>
        </div>
      </form>
    </div></div>`;
    document.body.classList.add("modal-open");

    const bindWdChips = () => {
      $$("[data-wd]", wrap).forEach((b) => b.addEventListener("click", () => {
        $$("[data-wd]", wrap).forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        draft.weeklyPayDay = b.dataset.wd;
      }));
    };
    bindWdChips();

    wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) finish(null); });
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => finish(null)));
    if (isEdit) wrap.querySelector("[data-del]").addEventListener("click", async () => {
      if (await confirmBox("この勤務先を削除しますか？（紐づく取引は残ります）")) finish({ __delete: true });
    });
    $$("[data-wage]", wrap).forEach((b) => b.addEventListener("click", () => {
      if (b.classList.contains("active")) return;
      $$("[data-wage]", wrap).forEach((x) => x.classList.toggle("active", x === b));
      draft.wageType = b.dataset.wage;
      $("#empWageFields", wrap).innerHTML = wageFieldsHTML();
    }));
    $$("[data-cycle]", wrap).forEach((b) => b.addEventListener("click", () => {
      if (b.classList.contains("active")) return;
      $$("[data-cycle]", wrap).forEach((x) => x.classList.toggle("active", x === b));
      draft.payCycle = b.dataset.cycle;
      $("#empCycleFields", wrap).innerHTML = cycleFieldsHTML();
      bindWdChips();
    }));
    wrap.querySelector("#empform").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get("name") || "").trim();
      if (!name) { toast("名前を入力してください", "x"); return; }
      finish({
        name,
        location: String(fd.get("location") || "").trim(),
        wageType: draft.wageType,
        hourlyWage: draft.wageType === "hourly" ? (Number(fd.get("hourlyWage")) || 0) : null,
        payCycle: draft.payCycle,
        weeklyPayDay: draft.payCycle === "weekly" ? draft.weeklyPayDay : null,
        closingDay: draft.payCycle === "monthly" ? (Number(fd.get("closingDay")) || 31) : null,
        paymentDay: draft.payCycle === "monthly" ? (Number(fd.get("paymentDay")) || 25) : null,
        linkedCategory: String(fd.get("linkedCategory") || "").trim() || null,
      });
    });
  });
}

// クレジットカード一覧。各カードに未確定合計・次回引き落とし日（渡されていれば）を表示し、タップで編集
function creditCardListHTML(items, pendingMap) {
  if (!items.length) return '<p class="empty">まだクレジットカードが登録されていません</p>';
  return items.map((c) => {
    const p = pendingMap[c.id];
    const cycle = `${c.closingDay || 31}日締め翌${c.paymentDay || 27}日引き落とし`;
    return `<div class="card" data-card-open="${c.id}" role="button" tabindex="0" style="cursor:pointer;margin-bottom:12px">
      <h2>${icon("card", 15)} ${esc(c.name)}</h2>
      <p class="small" style="color:var(--muted);margin:2px 0 0">${esc(cycle)}</p>
      ${p ? `<div class="f-row2" style="margin-top:10px;gap:16px">
        <div><p class="small" style="color:var(--muted);margin:0 0 2px">未確定合計</p><p style="margin:0;font-weight:800">${fmtYen(p.total)}</p></div>
        <div><p class="small" style="color:var(--muted);margin:0 0 2px">次回引き落とし日</p><p style="margin:0;font-weight:800">${fmtDateFull(p.nextChargeDate)}</p></div>
      </div>` : ""}
    </div>`;
  }).join("");
}
// クレジットカードを追加・編集するモーダル（締め日・引き落とし日は常に月次サイクル）
function creditCardModal(initial = {}) {
  const isEdit = !!initial.id;
  return new Promise((resolve) => {
    const wrap = $("#modalWrap");
    const finish = (result) => { wrap.innerHTML = ""; document.body.classList.remove("modal-open"); resolve(result); };
    wrap.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head"><h3>${esc(isEdit ? "クレジットカードを編集" : "クレジットカードを追加")}</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <form id="ccform">
        <label class="f-label">名前</label>
        <input type="text" name="name" value="${esc(initial.name || "")}" placeholder="例）楽天カード">
        <label class="f-label">締め日・引き落とし日</label>
        <div class="f-row2">
          <input type="number" name="closingDay" value="${esc(initial.closingDay ?? 31)}" min="1" max="31" placeholder="末日締め=31">
          <span class="f-sep">→ 翌</span>
          <input type="number" name="paymentDay" value="${esc(initial.paymentDay ?? 27)}" min="1" max="31" placeholder="27日引き落とし">
        </div>
        <p class="hint" style="margin-top:8px">取引を記録するときに、この中から支払い方法として選べます。選んだ支出は口座残高には反映されず「引き落とし予定」になり、引き落とし日が来たら自動で残高から引かれます。</p>
        <div class="modal-foot">
          ${isEdit ? `<button type="button" class="btn ghost" data-del style="margin-right:auto;color:var(--red);border-color:var(--red)">${icon("trash", 14)} 削除</button>` : ""}
          <button type="button" class="btn ghost" data-x>キャンセル</button>
          <button type="submit" class="btn">${icon("checkline", 15)} 保存</button>
        </div>
      </form>
    </div></div>`;
    document.body.classList.add("modal-open");

    wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) finish(null); });
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => finish(null)));
    if (isEdit) wrap.querySelector("[data-del]").addEventListener("click", async () => {
      if (await confirmBox("このクレジットカードを削除しますか？（紐づく取引は残ります）")) finish({ __delete: true });
    });
    wrap.querySelector("#ccform").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get("name") || "").trim();
      if (!name) { toast("名前を入力してください", "x"); return; }
      finish({
        name,
        closingDay: Number(fd.get("closingDay")) || 31,
        paymentDay: Number(fd.get("paymentDay")) || 27,
      });
    });
  });
}

VIEWS.money = {
  title: "収支", icon: "wallet",
  async render(main) {
    if (!MONEY_MONTH) MONEY_MONTH = monthKey(todayStr());
    const mk = MONEY_MONTH;
    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">収支管理</p><h1>収支</h1></div></div>
      <p class="empty">読み込み中…</p>`;

    let fin, txs;
    try {
      [fin, txs] = await Promise.all([api("/api/finance?month=" + mk), api("/api/transactions?month=" + mk)]);
    } catch (e) {
      main.innerHTML = `<p class="empty">読み込みに失敗しました: ${esc(e.message)}</p>`;
      return;
    }
    DB.finance = fin;
    if (CURRENT !== "money") return; // 取得中に他画面へ移動していたら描画しない

    // 旧形式（income/expenseの固定2リスト）から新形式（ブロックの並び）へ一度だけ移行する
    if (!DB.budgetplan.blocks) {
      const blocks = [];
      if (DB.budgetplan.income?.filter((i) => i.label !== "現在の残高").length) {
        blocks.push({ id: uid(), type: "income", title: "", items: DB.budgetplan.income.filter((i) => i.label !== "現在の残高") });
      }
      if (DB.budgetplan.expense?.length) blocks.push({ id: uid(), type: "expense", title: "", items: DB.budgetplan.expense });
      DB.budgetplan = { blocks };
      await saveDb("budgetplan");
    }

    await ensureCategoriesMigrated();
    await ensureUberEmployerMigrated();

    const groupByCat = (list) => {
      const m = {};
      for (const t of list) m[t.category] = (m[t.category] || 0) + t.amount;
      return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    // 内訳は確定分（未収の収入/引き落とし待ちの支出を除く）だけを集計する。残高・収支サマリーと基準を揃える
    const confirmedTxs = txs.filter((t) => t.payoutStatus !== "pending");
    const incomeRows = groupByCat(confirmedTxs.filter((t) => t.type === "income"));
    const expenseRows = groupByCat(confirmedTxs.filter((t) => t.type === "expense"));

    // ブロックを上から順に計算。残高チェックポイントはその時点までの累計をそのまま表示する（＝一個上の内容を引き継ぐ）
    let running = fin.currentBalance;
    const blocksHtml = DB.budgetplan.blocks.map((b) => {
      if (b.type === "balance") {
        return `<div class="card plan-balance-card" data-block-open="${b.id}" role="button" tabindex="0" style="margin-top:14px;cursor:pointer">
          <h2>${icon("chart", 15)} ${esc(b.title || "予想残高")}</h2>
          <p style="margin:4px 0 0;font-size:26px;font-weight:800;color:${running < 0 ? "var(--red)" : "var(--ink)"}">${signedYen(running)}</p>
        </div>`;
      }
      const total = b.items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      running += b.type === "income" ? total : -total;
      return `<div class="card" style="margin-top:14px">
        <h2 data-block-open="${b.id}" role="button" tabindex="0" style="cursor:pointer">${icon("layers", 15)} ${esc(b.title || (b.type === "income" ? "予想収入" : "予想出費"))}</h2>
        ${planItemsHTML(b.items, b.id, b.type)}
        <button class="btn ghost sm" data-item-add="${b.id}" data-kind="${b.type}" style="margin-top:10px">${icon("plus", 13)} 項目を追加</button>
        <p class="small" style="margin-top:10px;color:var(--muted)">合計：<strong>${fmtYen(total)}</strong></p>
      </div>`;
    }).join("");

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">収支管理</p><h1>収支</h1></div>
        ${MONEY_TAB === "actual" ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" id="setInit">${icon("wallet", 15)} 初期残高</button>
          <button class="btn" id="addTx">${icon("plus", 15)} 記録</button>
        </div>` : ""}
      </div>
      <div class="tabs" style="margin-bottom:16px">
        <button class="tab ${MONEY_TAB === "actual" ? "active" : ""}" data-mtab="actual">収支</button>
        <button class="tab ${MONEY_TAB === "breakdown" ? "active" : ""}" data-mtab="breakdown">内訳</button>
        <button class="tab ${MONEY_TAB === "plan" ? "active" : ""}" data-mtab="plan">予想収支</button>
      </div>
      ${MONEY_TAB === "breakdown" ? `
      <p class="small" style="color:var(--muted);margin:-8px 0 16px">${Number(mk.slice(0, 4))}年${Number(mk.slice(5))}月の内訳です。月を変えたい場合は「収支」タブで移動してください。</p>
      <div class="grid2">
        <div class="card" style="margin-bottom:0"><h2>${icon("layers", 15)} 収入（内訳）</h2>${hbars(incomeRows, fmtYen)}</div>
        <div class="card" style="margin-bottom:0"><h2>${icon("layers", 15)} 支出（内訳）</h2>${hbars(expenseRows, fmtYen)}</div>
      </div>` : MONEY_TAB === "actual" ? `
      <div class="card" style="margin-bottom:18px">
        <h2>${icon("wallet", 15)} 残高</h2>
        <p style="margin:4px 0 0;font-size:28px;font-weight:800">${signedYen(fin.currentBalance)}</p>
      </div>
      <div class="card" style="margin-bottom:18px">
        <div class="cal-nav" style="margin-bottom:10px">
          <button class="icon-btn" id="mcalPrev">${icon("chevR", 16, "flip")}</button>
          <button class="btn ghost sm" id="mcalToday">今月</button>
          <button class="icon-btn" id="mcalNext">${icon("chevR", 16)}</button>
          <span class="cal-title">${Number(mk.slice(0, 4))}年${Number(mk.slice(5))}月</span>
        </div>
        ${moneyCalGridHTML(mk, txs)}
      </div>
      <div class="card" style="margin-bottom:18px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center">
          <div><p class="small" style="color:var(--muted);margin:0 0 4px">収入</p><p style="margin:0;font-size:16.5px;font-weight:800;color:var(--green)">${fmtYen(fin.incomeThisMonth)}</p></div>
          <div><p class="small" style="color:var(--muted);margin:0 0 4px">支出</p><p style="margin:0;font-size:16.5px;font-weight:800;color:var(--red)">${fmtYen(fin.expenseThisMonth)}</p></div>
          <div><p class="small" style="color:var(--muted);margin:0 0 4px">合計</p><p style="margin:0;font-size:16.5px;font-weight:800;color:${fin.netThisMonth >= 0 ? "var(--ink)" : "var(--red)"}">${signedYen(fin.netThisMonth)}</p></div>
        </div>
      </div>
      <div class="card" style="margin-top:18px">
        <h2>${icon("calendar", 15)} 取引${MONEY_CAL_DAY ? `（${fmtDateFull(MONEY_CAL_DAY)}）` : ""}</h2>
        <div id="txListWrap">${moneyTxListHTML(txs, MONEY_CAL_DAY)}</div>
      </div>` : `
      <p class="small" style="color:var(--muted);margin:-8px 0 16px">ブロックを自由に追加して、時系列で予想の収支を組み立てられます。内容は保存され、あとから見返せます。</p>
      <div class="card" style="margin-bottom:0">
        <h2>${icon("wallet", 15)} 現在の残高</h2>
        <p style="margin:4px 0 0;font-size:26px;font-weight:800">${signedYen(fin.currentBalance)}</p>
      </div>
      ${blocksHtml}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
        <button class="btn ghost sm" data-block-add="income">${icon("plus", 13)} 収入ブロック</button>
        <button class="btn ghost sm" data-block-add="expense">${icon("plus", 13)} 支出ブロック</button>
        <button class="btn ghost sm" data-block-add="balance">${icon("plus", 13)} 残高チェックポイント</button>
      </div>`}`;

    $$("[data-mtab]", main).forEach((b) => b.addEventListener("click", () => { MONEY_TAB = b.dataset.mtab; rerender(); }));
    // ブロックを追加
    $$("[data-block-add]", main).forEach((b) => b.addEventListener("click", async () => {
      const type = b.dataset.blockAdd;
      const v = await planBlockModal(type, {});
      if (!v) return;
      DB.budgetplan.blocks.push({ id: uid(), type, title: v.title, ...(type === "balance" ? {} : { items: [] }) });
      await saveDb("budgetplan");
      rerender();
    }));
    // ブロック名をタップ→編集・削除
    $$("[data-block-open]", main).forEach((el) => {
      const open = async () => {
        const b = DB.budgetplan.blocks.find((x) => x.id === el.dataset.blockOpen);
        if (!b) return;
        const v = await planBlockModal(b.type, b);
        if (!v) return;
        if (v.__delete) {
          DB.budgetplan.blocks = DB.budgetplan.blocks.filter((x) => x.id !== b.id);
        } else {
          b.title = v.title;
        }
        await saveDb("budgetplan");
        rerender();
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    // ブロック内に項目を追加
    $$("[data-item-add]", main).forEach((b) => b.addEventListener("click", async () => {
      const block = DB.budgetplan.blocks.find((x) => x.id === b.dataset.itemAdd);
      if (!block) return;
      const v = await planItemModal(b.dataset.kind, {});
      if (!v || v.__delete) return;
      block.items.push({ id: uid(), ...v });
      await saveDb("budgetplan");
      rerender();
    }));
    // 項目をタップ→編集（内訳の追加/編集/削除もこのモーダルの中で完結する）
    $$("[data-plan-open]", main).forEach((el) => {
      const open = async () => {
        const block = DB.budgetplan.blocks.find((x) => x.id === el.dataset.block);
        const it = block?.items.find((i) => i.id === el.dataset.planOpen);
        if (!it) return;
        const v = await planItemModal(block.type, it);
        if (!v) return;
        if (v.__delete) {
          block.items = block.items.filter((i) => i.id !== it.id);
        } else {
          Object.assign(it, v);
        }
        await saveDb("budgetplan");
        rerender();
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    if (MONEY_TAB !== "actual") return;

    // 収支カレンダー: 月の移動（ボタン・スワイプ）と日タップでの絞り込み
    $("#mcalPrev").addEventListener("click", () => { MONEY_MONTH = shiftMonth(mk, -1); MONEY_CAL_DAY = null; rerender(); });
    $("#mcalNext").addEventListener("click", () => { MONEY_MONTH = shiftMonth(mk, 1); MONEY_CAL_DAY = null; rerender(); });
    $("#mcalToday").addEventListener("click", () => { MONEY_MONTH = monthKey(todayStr()); MONEY_CAL_DAY = null; rerender(); });
    attachSwipe($("#moneyCalGrid", main), (dir) => { MONEY_MONTH = shiftMonth(mk, dir === "right" ? -1 : 1); MONEY_CAL_DAY = null; rerender(); });
    $$("[data-mday]", main).forEach((b) => b.addEventListener("click", () => {
      MONEY_CAL_DAY = MONEY_CAL_DAY === b.dataset.mday ? null : b.dataset.mday;
      rerender();
    }));
    // 取引一覧の中の「給料まとめ行の開閉」「取引タップ→編集」をまとめてバインドする。
    // 開閉はページ全体を作り直さず、一覧部分だけ差し替える（毎回サーバーから再取得してページが
    // 更新されたように見えるのを防ぐ。編集/削除は金額や残高が変わるので従来通り全体を再描画する）
    const bindTxListHandlers = () => {
      const listWrap = $("#txListWrap", main);
      if (!listWrap) return;
      $$("[data-bundle]", listWrap).forEach((el) => el.addEventListener("click", () => {
        const k = el.dataset.bundle;
        if (EXPANDED_TX_BUNDLES.has(k)) EXPANDED_TX_BUNDLES.delete(k); else EXPANDED_TX_BUNDLES.add(k);
        listWrap.innerHTML = moneyTxListHTML(txs, MONEY_CAL_DAY);
        bindTxListHandlers();
      }));
      $$("[data-tx-open]", listWrap).forEach((el) => {
        const open = async () => {
          const t = txs.find((x) => x.id === el.dataset.txOpen);
          if (!t) return;
          const v = await txFormModal(t);
          if (!v) return;
          try {
            if (v.__delete) {
              await api("/api/transactions/" + t.id, { method: "DELETE" });
            } else {
              await api("/api/transactions/" + t.id, {
                method: "PATCH",
                body: JSON.stringify({ date: v.date, category: v.category, amount: Math.round(v.amount), memo: v.memo }),
              });
            }
          } catch (e) { toast(e.message, "x"); return; }
          if (t.type === "income") await refreshSales(); // 売上明細のミラーにも反映
          rerender();
        };
        el.addEventListener("click", open);
        el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      });
    };
    bindTxListHandlers();

    $("#addTx").addEventListener("click", async () => {
      const v = await txFormModal({});
      if (!v) return;
      try {
        if (v.type === "income") {
          // 収入(売上)＋任意の経費を記録。残高に反映＆売上明細にミラー、利益も計算できる。
          await api("/api/sales", {
            method: "POST",
            body: JSON.stringify({ amount: Math.round(v.amount), cost: Math.round(v.cost || 0), source: v.category, date: v.date, memo: v.memo, employerId: v.employerId, hours: v.hours }),
          });
          await refreshSales(); // 売上明細にもミラーされるので反映
        } else {
          await api("/api/transactions", {
            method: "POST",
            body: JSON.stringify({ type: v.type, amount: Math.round(v.amount), category: v.category, date: v.date, memo: v.memo, creditCardId: v.creditCardId }),
          });
        }
      } catch (e) { toast(e.message, "x"); return; }
      toast(v.type === "income" ? "収入を記録しました" : "支出を記録しました");
      rerender();
    });
    $("#setInit").addEventListener("click", async () => {
      const v = await modal("初期残高を設定", [
        { key: "amount", label: "初期残高（円）", type: "money", default: fin.initialBalance, placeholder: "100000" },
      ]);
      if (!v) return;
      try {
        await api("/api/finance/initial", { method: "PUT", body: JSON.stringify({ amount: Math.round(v.amount) }) });
      } catch (e) { toast(e.message, "x"); return; }
      toast("初期残高を設定しました");
      rerender();
    });
  },
};

// ===== 人生目標 =====

let GOAL_TAB = "y1";
const GOAL_TABS = { y1: "今年", y3: "3年", y5: "5年", y10: "10年" };

VIEWS.goals = {
  title: "目標", icon: "target",
  render(main) {
    const list = DB.goals[GOAL_TAB];
    const avg = list.length ? Math.round(list.reduce((s, g) => s + (g.progress || 0), 0) / list.length) : 0;

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Life Goals</p><h1>人生目標</h1></div>
        <button class="btn" id="add">${icon("plus", 15)} 目標を追加</button>
      </div>
      <div class="tabs">${Object.entries(GOAL_TABS).map(([k, l]) =>
        `<button class="tab ${GOAL_TAB === k ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
          ${ring(avg)}
          <div><strong style="font-size:16px">${GOAL_TABS[GOAL_TAB]}の目標</strong>
          <p class="small muted" style="margin:2px 0 0">達成率 ${avg}% ・ ${list.length}件</p></div>
        </div>
        ${list.map((g) => `
          <div style="padding:12px 4px;border-top:1px solid var(--line)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span class="row-title" style="font-weight:600">${esc(g.text)}</span>
              <span class="pill ${g.progress >= 100 ? "grn" : "acc"}">${g.progress || 0}%</span>
              <button class="icon-btn danger" data-del="${g.id}">${icon("trash", 13)}</button>
            </div>
            <input type="range" min="0" max="100" step="5" value="${g.progress || 0}" data-slide="${g.id}">
          </div>`).join("") || '<p class="empty">目標を追加して、人生の方向を決めよう</p>'}
      </div>`;

    $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { GOAL_TAB = b.dataset.tab; rerender(); }));
    $("#add").addEventListener("click", async () => {
      const v = await modal(`${GOAL_TABS[GOAL_TAB]}の目標を追加`, [{ key: "text", label: "目標", type: "text", placeholder: "例: 月30万を安定して稼ぐ" }]);
      if (!v || !v.text) return;
      DB.goals[GOAL_TAB].push({ id: uid(), text: v.text, progress: 0 });
      await saveDb("goals"); rerender();
    });
    $$("[data-slide]").forEach((s) => s.addEventListener("change", async () => {
      const g = DB.goals[GOAL_TAB].find((x) => x.id === s.dataset.slide);
      const was = g.progress;
      g.progress = Number(s.value);
      await saveDb("goals");
      if (was < 100 && g.progress >= 100) await addXP(100, "目標達成！");
      rerender();
    }));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!(await confirmBox("この目標を削除しますか？"))) return;
      DB.goals[GOAL_TAB] = DB.goals[GOAL_TAB].filter((x) => x.id !== b.dataset.del);
      await saveDb("goals"); rerender();
    }));
  },
};

// ===== 実績（バッジ） =====

function maxMonthSales() {
  const m = DB.sales.logs.reduce((map, l) => (map[monthKey(l.date)] = (map[monthKey(l.date)] || 0) + l.amount, map), {});
  return Math.max(0, ...Object.values(m));
}

const BADGES = [
  { k: "first_project", n: "初案件", d: "最初の案件を獲得", ic: "briefcase", c: () => DB.projects.items.length >= 1 },
  { k: "m100k", n: "月10万", d: "月間売上10万円を達成", ic: "yen", c: () => maxMonthSales() >= 100000 },
  { k: "m300k", n: "月30万", d: "月間売上30万円を達成", ic: "yen", c: () => maxMonthSales() >= 300000 },
  { k: "m500k", n: "月50万", d: "月間売上50万円を達成", ic: "yen", c: () => maxMonthSales() >= 500000 },
  { k: "m1m", n: "月100万", d: "月間売上100万円を達成", ic: "trophy", c: () => maxMonthSales() >= 1000000 },
  { k: "react", n: "React習得", d: "Reactの進捗100%", ic: "book", c: () => DB.learning.items.some((i) => i.name === "React" && i.progress >= 100) },
  { k: "pf", n: "ポートフォリオ完成", d: "作品を1つ完成させた", ic: "layers", c: () => DB.portfolio.items.some((p) => (p.progress || 0) >= 100) },
  { k: "gh100", n: "GitHub 100コミット", d: "自己申告でチェック", ic: "link", manual: true },
  { k: "streak7", n: "7日連続", d: "7日連続で活動", ic: "flame", c: () => streak() >= 7 },
  { k: "streak30", n: "30日連続", d: "30日連続で活動", ic: "flame", c: () => streak() >= 30 },
  { k: "lv10", n: "Lv 10", d: "レベル10に到達", ic: "zap", c: () => levelInfo().lvl >= 10 },
  { k: "study100", n: "勉強100時間", d: "累計100時間勉強した", ic: "timer", c: () => DB.study.logs.reduce((s, l) => s + l.min, 0) >= 6000 },
];

VIEWS.badges = {
  title: "実績", icon: "trophy",
  async render(main) {
    // 自動判定 → 新規解除があれば保存
    let newUnlock = false;
    for (const b of BADGES) {
      if (!b.manual && !DB.badges.unlocked[b.k] && b.c()) {
        DB.badges.unlocked[b.k] = todayStr(); newUnlock = true;
        toast(`実績解除: ${b.n}`, "trophy");
        await addXP(XP_RULES.badge, `実績「${b.n}」`);
      }
    }
    if (newUnlock) await saveDb("badges");

    const got = Object.keys(DB.badges.unlocked).length;
    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Achievements</p><h1>実績</h1></div>
        <span class="pill acc">${got} / ${BADGES.length} 解除</span>
      </div>
      <div class="badge-grid">
        ${BADGES.map((b) => {
          const on = !!DB.badges.unlocked[b.k];
          return `<div class="badge ${on ? "on" : "locked"}" ${b.manual && !on ? `data-manual="${b.k}" style="cursor:pointer"` : ""}>
            <span class="b-ic">${icon(b.ic, 21)}</span>
            <strong>${esc(b.n)}</strong>
            <span>${esc(b.d)}</span>
            ${on ? `<span style="color:var(--accent);font-weight:700;margin-top:6px">${fmtShort(DB.badges.unlocked[b.k])} 解除</span>` : b.manual ? '<span style="margin-top:6px">タップで解除</span>' : ""}
          </div>`;
        }).join("")}
      </div>`;

    $$("[data-manual]").forEach((el) => el.addEventListener("click", async () => {
      DB.badges.unlocked[el.dataset.manual] = todayStr();
      await saveDb("badges");
      await addXP(XP_RULES.badge, "実績解除");
      rerender();
    }));
  },
};

// ===== 分析 =====

VIEWS.analytics = {
  title: "分析", icon: "chart",
  render(main) {
    const logs = DB.study.logs;
    // 曜日別 平均勉強時間（直近8週）
    const from = todayStr(-55);
    const recent = logs.filter((l) => l.date >= from);
    const byWd = [...Array(7)].map(() => ({ sum: 0, days: new Set() }));
    for (const l of recent) {
      const wd = new Date(l.date + "T00:00:00").getDay();
      byWd[wd].sum += l.min; byWd[wd].days.add(l.date);
    }
    const wdAvg = byWd.map((x) => (x.days.size ? Math.round(x.sum / x.days.size) : 0));
    const bestWd = wdAvg.indexOf(Math.max(...wdAvg));

    // 直近14日 勉強
    const days14 = [...Array(14)].map((_, i) => todayStr(i - 13));
    const mins14 = days14.map((d) => logs.filter((l) => l.date === d).reduce((s, l) => s + l.min, 0));

    // 月別売上
    const months = [...Array(6)].map((_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const salesByMonth = months.map((m) => DB.sales.logs.filter((l) => monthKey(l.date) === m).reduce((s, l) => s + l.amount, 0));

    // カテゴリ別 完了Todo
    const doneByCat = CATS.map((c) => ({ label: c, value: DB.todos.items.filter((t) => t.done && t.cat === c).length, color: CAT_COLORS[c] }));

    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Analytics</p><h1>分析</h1></div></div>
      <div class="stat-grid">
        ${statCard("calendar", Math.max(...wdAvg) ? WD[bestWd] + "曜日" : "—", "一番集中できる曜日")}
        ${statCard("timer", fmtMin(mins14.reduce((a, b) => a + b, 0)) || "0分", "直近14日の勉強")}
        ${statCard("check", DB.todos.items.filter((t) => t.done).length, "完了したTodo", "件")}
        ${statCard("zap", levelInfo().total, "総獲得XP")}
      </div>
      <div class="grid2">
        <div class="card" style="margin-bottom:0"><h2>${icon("calendar", 15)} 曜日別 平均勉強時間</h2>${vbars(wdAvg, WD, fmtMin)}</div>
        <div class="card" style="margin-bottom:0"><h2>${icon("timer", 15)} 勉強時間の推移（14日）</h2>${vbars(mins14, days14.map(fmtShort), fmtMin)}</div>
        <div class="card" style="margin-bottom:0"><h2>${icon("yen", 15)} 売上の推移（6ヶ月）</h2>${vbars(salesByMonth, months.map((m) => +m.slice(5) + "月"), fmtYen)}</div>
        <div class="card" style="margin-bottom:0"><h2>${icon("check", 15)} 何に時間を使ったか（完了Todo）</h2>${hbars(doneByCat, (v) => v + "件")}</div>
      </div>`;
  },
};

// ===== カレンダー（日 / 3日 / 週 / 月 切替） =====

let CAL = { view: "month", anchor: null };
const CAL_LABELS = { day: "日", "3day": "3日", week: "週", month: "月" };
const WD_JP = ["日", "月", "火", "水", "木", "金", "土"];
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const calAdd = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoOf(d); };
const calXp = (iso) => activityMap()[iso] || 0;
const calLevel = (xp) => (xp >= 100 ? 4 : xp >= 50 ? 3 : xp >= 25 ? 2 : xp > 0 ? 1 : 0);
const calStudy = (iso) => DB.study.logs.filter((l) => l.date === iso).reduce((s, l) => s + l.min, 0);
const isTimed = (t) => /^\d{1,2}:\d{2}$/.test(t.time || "");

function calRange() {
  const a = CAL.anchor, d = new Date(a + "T00:00:00");
  if (CAL.view === "day") return [a, a];
  if (CAL.view === "3day") return [a, calAdd(a, 2)];
  if (CAL.view === "week") { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); return [isoOf(s), calAdd(isoOf(s), 6)]; }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const gs = new Date(first); gs.setDate(1 - first.getDay());
  return [isoOf(gs), calAdd(isoOf(gs), 41)];
}
function calTitle() {
  const [from, to] = calRange();
  const d = new Date(CAL.anchor + "T00:00:00");
  if (CAL.view === "month") return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  if (CAL.view === "day") return fmtJP(CAL.anchor);
  return `${fmtShort(from)} – ${fmtShort(to)}`;
}
function calShift(dir) {
  if (CAL.view === "month") { const d = new Date(CAL.anchor + "T00:00:00"); d.setMonth(d.getMonth() + dir); CAL.anchor = isoOf(d); }
  else CAL.anchor = calAdd(CAL.anchor, dir * (CAL.view === "week" ? 7 : CAL.view === "3day" ? 3 : 1));
}
async function calLoadDays(from, to) {
  const days = await api(`/api/days?from=${from}&to=${to}`);
  const map = {};
  for (const d of days) map[d.date] = d;
  if (DB.day && DB.day.date >= from && DB.day.date <= to) map[DB.day.date] = DB.day; // 今日はライブ
  return map;
}

VIEWS.calendar = {
  title: "カレンダー", icon: "calendar",
  async render(main) {
    if (!CAL.anchor) CAL.anchor = todayStr();
    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Calendar</p><h1>カレンダー</h1></div>
        <span class="pill acc">${icon("flame", 12)} 連続 ${streak()}日</span></div>
      <div class="cal-toolbar">
        <div class="cal-nav">
          <button class="icon-btn" id="calPrev">${icon("chevR", 16, "flip")}</button>
          <button class="btn ghost sm" id="calToday">今日</button>
          <button class="icon-btn" id="calNext">${icon("chevR", 16)}</button>
          <span class="cal-title">${esc(calTitle())}</span>
        </div>
        <div class="seg cal-seg">${Object.entries(CAL_LABELS).map(([v, l]) => `<button class="${CAL.view === v ? "active" : ""}" data-cv="${v}">${l}</button>`).join("")}</div>
      </div>
      <div class="card" id="calBody"><p class="empty">読み込み中…</p></div>
      <div class="card" id="calDetail" style="display:none"></div>`;

    $("#calPrev").addEventListener("click", () => { calShift(-1); rerender(); });
    $("#calNext").addEventListener("click", () => { calShift(1); rerender(); });
    $("#calToday").addEventListener("click", () => { CAL.anchor = todayStr(); rerender(); });
    $$("[data-cv]", main).forEach((b) => b.addEventListener("click", () => { CAL.view = b.dataset.cv; rerender(); }));

    const [from, to] = calRange();
    // 先にグリッドの枠を即描画（日付・XPヒートはローカルデータだけで出せる）。
    // タスク件数・予定は days の取得後に埋めるので、空白の「読み込み中…」が出ない。
    CAL._from = from; CAL._to = to; CAL._map = {};
    calRefreshBody();

    let map;
    try { map = await calLoadDays(from, to); }
    catch (e) { $("#calBody").innerHTML = `<p class="empty">読み込み失敗: ${esc(e.message)}</p>`; return; }
    if (CURRENT !== "calendar") return;

    CAL._map = map;
    calRefreshBody(); // タスク件数・予定を反映
    if (CAL._openIso && CAL._openIso >= from && CAL._openIso <= to) calShowDetail(CAL._openIso);
  },
};

function calRefreshBody() {
  const el = $("#calBody");
  if (!el) return;
  el.style.padding = CAL.view === "month" ? "" : "10px";
  if (CAL.view === "month") calRenderMonth(el);
  else calRenderTime(el, CAL._from, CAL._to);
}

function calRenderMonth(el) {
  const map = CAL._map;
  const [from] = calRange();
  const anchorMonth = new Date(CAL.anchor + "T00:00:00").getMonth();
  const today = todayStr();
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const iso = calAdd(from, i), d = new Date(iso + "T00:00:00"), day = map[iso];
    const done = day ? day.tasks.filter((t) => t.done).length : 0;
    const total = day ? day.tasks.length : 0;
    const hasMit = day ? day.tasks.some((t) => t.important) : false;
    const lv = calLevel(calXp(iso));
    const cls = ["cal-cell", d.getMonth() !== anchorMonth ? "other" : "", iso === today ? "today" : ""].join(" ");
    cells += `<button class="${cls}" data-day="${iso}">
      <span class="cc-num">${d.getDate()}</span>
      ${hasMit ? `<span class="cc-star">${icon("star", 11, "filled")}</span>` : ""}
      ${lv ? `<span class="cc-dot hm-${lv}"></span>` : ""}
      ${total ? `<span class="cc-count">${done}/${total}</span>` : ""}
    </button>`;
  }
  el.innerHTML = `<div class="cal-wd">${WD_JP.map((w) => `<span>${w}</span>`).join("")}</div>
    <div class="cal-grid">${cells}</div>`;
  $$(".cal-cell", el).forEach((b) => b.addEventListener("click", () => calShowDetail(b.dataset.day)));
}

function calRenderTime(el, from, to) {
  const map = CAL._map;
  const days = [];
  for (let iso = from; iso <= to; iso = calAdd(iso, 1)) days.push(iso);
  const H0 = 6, H1 = 24, rowH = 44, today = todayStr();
  const hours = [];
  for (let h = H0; h < H1; h++) hours.push(h);
  const bodyH = (H1 - H0) * rowH;

  const axis = `<div class="cal-axis">
    <div class="cal-colhead"></div><div class="cal-allday"></div>
    <div class="cal-colbody" style="height:${bodyH}px">
      ${hours.map((h, i) => `<div class="cal-hlabel" style="top:${i * rowH - 6}px">${h}:00</div>`).join("")}
    </div></div>`;

  const cols = days.map((iso) => {
    const d = new Date(iso + "T00:00:00"), day = map[iso], tasks = day ? day.tasks : [];
    const timed = tasks.filter(isTimed), allday = tasks.filter((t) => !isTimed(t));
    const blocks = timed.map((t) => {
      const [hh, mm] = t.time.split(":").map(Number);
      const top = Math.max(0, (hh - H0 + mm / 60) * rowH);
      const col = t.cat ? (CAT_COLORS[t.cat] || "var(--accent)") : "var(--accent)";
      return `<button class="cal-ev ${t.done ? "done" : ""}" data-ev="${iso}" style="top:${top}px;border-left-color:${col}"><b>${esc(t.time)}</b>${esc(t.title)}</button>`;
    }).join("");
    return `<div class="cal-col">
      <div class="cal-colhead ${iso === today ? "today" : ""}">${WD_JP[d.getDay()]}<b>${d.getDate()}</b></div>
      <div class="cal-allday">${allday.map((t) => `<button class="cal-chip ${t.done ? "done" : ""}" data-ev="${iso}">${esc(t.title)}</button>`).join("")}</div>
      <div class="cal-colbody" style="height:${bodyH}px">
        ${hours.map((h, i) => `<div class="cal-hline" style="top:${i * rowH}px"></div>`).join("")}
        ${blocks}
      </div></div>`;
  }).join("");

  el.innerHTML = `<div class="cal-time cols-${days.length}">${axis}<div class="cal-cols">${cols}</div></div>`;
  $$("[data-ev]", el).forEach((b) => b.addEventListener("click", () => calShowDetail(b.dataset.ev)));
}

function calShowDetail(iso) {
  CAL._openIso = iso;
  const day = CAL._map[iso], xp = calXp(iso), study = calStudy(iso);
  const sales = DB.sales.logs.filter((l) => l.date === iso).reduce((s, l) => s + l.amount, 0);
  const tasks = day ? [...day.tasks].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")) : [];
  const el = $("#calDetail");
  el.style.display = "";
  el.innerHTML = `
    <div class="card-head"><h2>${icon("calendar", 15)} ${fmtJP(iso)}</h2>
      <button class="btn ghost sm" id="calAddTask">${icon("plus", 14)} 追加</button></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span class="pill acc">${icon("zap", 11)} ${xp} XP</span>
      <span class="pill">${icon("timer", 11)} ${fmtMin(study) || "0分"}</span>
      <span class="pill">${icon("check", 11)} ${tasks.filter((t) => t.done).length}/${tasks.length} タスク</span>
      ${sales ? `<span class="pill grn">${fmtYen(sales)}</span>` : ""}
    </div>
    <div id="calDetailTasks">${tasks.map((t) => `<div class="list-item ${t.done ? "done" : ""}">
      <input type="checkbox" class="checkbox" data-cdchk="${t.id}" ${t.done ? "checked" : ""}>
      ${t.time ? `<span class="li-time">${esc(t.time)}</span>` : ""}
      <div class="li-body" data-cdopen="${t.id}" role="button" tabindex="0" style="cursor:pointer">
        <div class="li-title">${t.important ? `<span style="color:var(--amber)">${icon("star", 13, "filled")}</span> ` : ""}${esc(t.title)}</div>${t.memo ? `<div class="li-memo">${esc(t.memo)}</div>` : ""}
      </div>
      ${t.spentMin ? `<span class="pill grn">${icon("timer", 10)} ${fmtHM(t.spentMin)}</span>` : ""}
    </div>`).join("") || '<p class="empty">この日のタスクはありません</p>'}</div>
    ${day?.diary ? `<p class="small" style="white-space:pre-wrap;margin:12px 0 0;color:var(--muted)">${esc(day.diary)}</p>` : ""}`;

  const refresh = (updatedDay) => { CAL._map[iso] = updatedDay; if (iso === todayStr()) DB.day = updatedDay; calRefreshBody(); calShowDetail(iso); };

  $("#calAddTask").addEventListener("click", async () => {
    const v = await modalWithCatAdd(`${fmtJP(iso)} に追加`, [
      { key: "title", label: "やること", type: "text", placeholder: "何をやった？" },
      { key: "time", label: "時刻（任意）", type: "time" },
      { key: "cat", label: "カテゴリー（任意）", type: "select", options: ["", ...CATS, ...(DB.categories.task || [])] },
      { key: "tags", label: "タグ（任意）", type: "tags" },
    ]);
    if (!v || !v.title) return;
    const d = await api("/api/tasks", { method: "POST", body: JSON.stringify({ date: iso, title: v.title, time: v.time, cat: v.cat, tags: v.tags }) });
    refresh(d);
  });
  // タップ→詳細。そこから編集（右上）・削除・完了トグル。
  const editCalTask = async (t) => {
    const v = await modalWithCatAdd(`${fmtJP(iso)} の予定を編集`, [
      { key: "title", label: "やること", type: "text" },
      { key: "date", label: "日付", type: "date", default: iso },
      { type: "timerange", label: "時間（開始 → 終了・任意）", startKey: "time", endKey: "endTime" },
      { key: "cat", label: "カテゴリー（任意）", type: "select", options: ["", ...CATS, ...(DB.categories.task || [])] },
      { key: "tags", label: "タグ（任意）", type: "tags" },
      { key: "memo", label: "メモ（やった内容など・任意）", type: "textarea" },
    ], { ...t, date: iso });
    if (!v || !v.title) return;
    const newDate = v.date || iso;
    const body = { title: v.title, time: v.time, endTime: v.endTime, cat: v.cat, tags: v.tags, memo: v.memo };
    try {
      if (newDate !== iso) {
        await api("/api/tasks/" + t.id, { method: "PATCH", body: JSON.stringify({ ...body, date: iso, moveTo: newDate }) });
        toast(fmtShort(newDate) + " に移動しました");
        rerender(); // 元の日・移動先の両方を反映（詳細は自動で開き直される）
      } else {
        const d = await api("/api/tasks/" + t.id, { method: "PATCH", body: JSON.stringify(body) });
        refresh(d);
      }
    } catch (err) { toast(err.message, "x"); }
  };
  const deleteCalTask = async (t) => {
    if (!(await confirmBox(`「${t.title}」を削除しますか？`))) return;
    try { const d = await api("/api/tasks/" + t.id + "?date=" + iso, { method: "DELETE" }); refresh(d); }
    catch (err) { toast(err.message, "x"); }
  };
  const toggleCalTask = async (t) => {
    try {
      const d = await api("/api/tasks/" + t.id, { method: "PATCH", body: JSON.stringify({ date: iso, done: !t.done }) });
      if (!t.done) {
        await addXP(XP_RULES.task, "タスク完了");
        if (t.important) await addXP(XP_RULES.mitBonus, "最重要タスク達成！");
      }
      refresh(d);
    } catch (err) { toast(err.message, "x"); }
  };
  $$("#calDetailTasks [data-cdchk]").forEach((cb) => cb.addEventListener("change", async () => {
    try {
      const d = await api("/api/tasks/" + cb.dataset.cdchk, { method: "PATCH", body: JSON.stringify({ date: iso, done: cb.checked }) });
      if (cb.checked) {
        await addXP(XP_RULES.task, "タスク完了");
        const t = (CAL._map[iso]?.tasks || []).find((x) => x.id === cb.dataset.cdchk);
        if (t?.important) await addXP(XP_RULES.mitBonus, "最重要タスク達成！");
      }
      refresh(d);
    } catch (err) { cb.checked = !cb.checked; toast(err.message, "x"); }
  }));
  $$("#calDetailTasks [data-cdopen]").forEach((el2) => {
    const openIt = async () => {
      const t = (CAL._map[iso]?.tasks || []).find((x) => x.id === el2.dataset.cdopen);
      if (!t) return;
      const act = await taskDetailModal(t, { canToggle: true });
      if (act === "edit") await editCalTask(t);
      else if (act === "delete") await deleteCalTask(t);
      else if (act === "toggle") await toggleCalTask(t);
      else if (act === "mit") {
        try { const d = await api("/api/tasks/" + t.id, { method: "PATCH", body: JSON.stringify({ date: iso, important: !t.important }) }); refresh(d); }
        catch (err) { toast(err.message, "x"); }
      }
    };
    el2.addEventListener("click", openIt);
    el2.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIt(); } });
  });

  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ===== 設定 =====

const WD_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WD_SHORT = ["日", "月", "火", "水", "木", "金", "土"];
const tplDaysLabel = (days) => (!days || days === "daily" ? "毎日" : days.map((d) => WD_SHORT[WD_KEYS.indexOf(d)]).join("・"));
const templateListHTML = (recurring) => (recurring.length ? recurring.map((t, i) => `<div class="row" data-tpl-open="${i}" role="button" tabindex="0" style="cursor:pointer">
    <span class="row-title">${esc(t.title)}</span>
    <span class="small" style="color:var(--muted)">${t.time ? esc(t.time) + " ・ " : ""}${tplDaysLabel(t.days)}</span>
  </div>`).join("") : '<p class="empty">まだ定番タスクがありません</p>');
// 定番タスクの追加・編集モーダル。曜日はチップのトグル、時刻は任意
async function templateModal(initial = {}) {
  const isEdit = initial.title !== undefined;
  const draft = { title: initial.title || "", time: initial.time || "", days: (!initial.days || initial.days === "daily") ? "daily" : [...initial.days] };
  for (;;) {
    const wrap = $("#modalWrap");
    const isDaily = draft.days === "daily";
    wrap.innerHTML = `<div class="overlay"><div class="modal">
      <div class="modal-head"><h3>${esc(isEdit ? "定番タスクを編集" : "定番タスクを追加")}</h3><button type="button" class="icon-btn" data-x>${icon("x", 17)}</button></div>
      <form id="tform">
        <label class="f-label">タスク名</label>
        <input type="text" name="title" value="${esc(draft.title)}" placeholder="例）水を2L飲む">
        <label class="f-label">時刻（任意）</label>
        <input type="time" name="time" value="${esc(draft.time)}">
        <label class="f-label">曜日</label>
        <div class="wd-picker">
          <button type="button" class="wd-chip ${isDaily ? "active" : ""}" data-wd="daily">毎日</button>
          ${WD_SHORT.map((label, i) => `<button type="button" class="wd-chip ${!isDaily && draft.days.includes(WD_KEYS[i]) ? "active" : ""}" data-wd="${WD_KEYS[i]}">${label}</button>`).join("")}
        </div>
        <div class="modal-foot">
          ${isEdit ? `<button type="button" class="btn ghost" data-del style="margin-right:auto;color:var(--red);border-color:var(--red)">${icon("trash", 14)} 削除</button>` : ""}
          <button type="button" class="btn ghost" data-x>キャンセル</button>
          <button type="submit" class="btn">${icon("checkline", 15)} 保存</button>
        </div>
      </form>
    </div></div>`;
    document.body.classList.add("modal-open");
    const captureDraft = () => {
      draft.title = wrap.querySelector('input[name=title]').value;
      draft.time = wrap.querySelector('input[name=time]').value;
    };
    const result = await new Promise((resolve) => {
      wrap.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) resolve({ __cancel: true }); });
      $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", () => resolve({ __cancel: true })));
      if (isEdit) wrap.querySelector("[data-del]").addEventListener("click", async () => {
        if (await confirmBox("この定番タスクを削除しますか？")) resolve({ __delete: true });
      });
      $$("[data-wd]", wrap).forEach((b) => b.addEventListener("click", () => {
        captureDraft();
        const wd = b.dataset.wd;
        if (wd === "daily") { draft.days = "daily"; } else {
          if (draft.days === "daily") draft.days = [];
          const idx = draft.days.indexOf(wd);
          if (idx >= 0) draft.days.splice(idx, 1); else draft.days.push(wd);
          if (!draft.days.length) draft.days = "daily";
        }
        resolve({ __toggleWd: true });
      }));
      wrap.querySelector("#tform").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        resolve({ title: String(fd.get("title") || "").trim(), time: String(fd.get("time") || "").trim() });
      });
    });
    document.body.classList.remove("modal-open");
    if (result.__cancel) { wrap.innerHTML = ""; return null; }
    if (result.__delete) { wrap.innerHTML = ""; return { __delete: true }; }
    if (result.__toggleWd) continue;
    if (!result.title) { toast("タスク名を入力してください", "x"); draft.title = result.title; draft.time = result.time; continue; }
    wrap.innerHTML = "";
    return { title: result.title, time: result.time, days: draft.days };
  }
}

// ===== カテゴリー管理（支出/収入の追加・編集・削除・並べ替え） =====
let CAT_TAB = "expense"; // "expense" | "income"
let CAT_EDIT = false;    // 編集モード（削除ボタン＋並べ替えハンドルを表示）
// 設定ページのセクション開閉状態（アコーディオン）。初期は全部開いた状態にする
const SETTINGS_OPEN = new Set(["profile", "goals", "tasks", "employers", "creditCards", "data", "account"]);

// リストの並べ替え（タッチ/マウス両対応）。ハンドルをドラッグして順序を入れ替える。
function makeSortable(listEl, handleSel, itemSel, onReorder) {
  listEl.querySelectorAll(handleSel).forEach((handle) => {
    handle.style.touchAction = "none";
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const dragEl = handle.closest(itemSel);
      if (!dragEl) return;
      const items = [...listEl.querySelectorAll(itemSel)];
      const oldIdx = items.indexOf(dragEl);
      dragEl.classList.add("dragging");
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const y = ev.clientY;
        const after = items.filter((el) => el !== dragEl).find((el) => {
          const r = el.getBoundingClientRect();
          return y < r.top + r.height / 2;
        });
        if (after) listEl.insertBefore(dragEl, after);
        else listEl.appendChild(dragEl);
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        dragEl.classList.remove("dragging");
        const newIdx = [...listEl.querySelectorAll(itemSel)].indexOf(dragEl);
        if (newIdx >= 0 && newIdx !== oldIdx) onReorder(oldIdx, newIdx);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  });
}

const catRowsHTML = (cats, editMode) => cats.length
  ? cats.map((c, i) => `<div class="cat-row" data-idx="${i}" data-name="${esc(c.name)}">
      ${editMode ? `<button type="button" class="cat-del" data-del="${i}" aria-label="削除">${icon("minus", 15)}</button>` : ""}
      <span class="cat-tile-ic" style="color:${normCat(c).color}">${icon(c.icon, 22)}</span>
      <span class="cat-row-name">${esc(c.name)}</span>
      ${editMode ? `<span class="cat-handle" data-handle="${i}">${icon("menu", 18)}</span>` : `<span class="cat-chev">${icon("chevR", 16)}</span>`}
    </div>`).join("")
  : '<p class="empty">カテゴリーがありません</p>';
// カテゴリー管理を取引追加モーダルの中からも開けるようにした版（独立オーバーレイ。呼び出し元のモーダルは壊さない）
function categoryManageModal(initialKind) {
  let kind = initialKind;
  let editMode = false;
  return new Promise((resolve) => {
    const box = document.createElement("div");
    const close = () => { box.remove(); resolve(); };
    const render = () => {
      const cats = (DB.categories[kind] || []).map(normCat);
      box.innerHTML = `<div class="overlay"><div class="modal">
        <div class="modal-head">
          <div style="display:flex;align-items:center;gap:8px">
            <button type="button" class="icon-btn" data-back aria-label="戻る">${icon("chevR", 17, "flip")}</button>
            <h3>カテゴリー</h3>
          </div>
          <button type="button" class="btn ghost sm" data-edit-toggle>${editMode ? "完了" : "編集"}</button>
        </div>
        <div class="tabs" style="margin-bottom:14px">
          <button type="button" class="tab ${kind === "expense" ? "active" : ""}" data-cmtab="expense">支出</button>
          <button type="button" class="tab ${kind === "income" ? "active" : ""}" data-cmtab="income">収入</button>
        </div>
        <button type="button" class="btn ghost" data-cat-add style="width:100%;justify-content:flex-start;margin-bottom:14px">${icon("plus", 16)} 新規カテゴリーの追加</button>
        <div id="cmCatList">${catRowsHTML(cats, editMode)}</div>
      </div></div>`;
      box.querySelector(".overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) close(); });
      box.querySelector("[data-back]").addEventListener("click", close);
      box.querySelector("[data-edit-toggle]").addEventListener("click", () => { editMode = !editMode; render(); });
      $$("[data-cmtab]", box).forEach((b) => b.addEventListener("click", () => { kind = b.dataset.cmtab; render(); }));
      box.querySelector("[data-cat-add]").addEventListener("click", async () => {
        const v = await categoryModal(kind);
        if (!v || v.__delete) return;
        DB.categories[kind] = [...(DB.categories[kind] || []), { name: v.name, icon: v.icon, color: v.color, ...(v.employerId ? { employerId: v.employerId } : {}) }];
        try { await saveDb("categories"); } catch (e) { toast(e.message, "x"); return; }
        render();
      });
      if (!editMode) {
        $$(".cat-row", box).forEach((row) => row.addEventListener("click", async () => {
          const i = Number(row.dataset.idx);
          const cur = normCat(DB.categories[kind][i]);
          const v = await categoryModal(kind, cur);
          if (!v) return;
          if (v.__delete) DB.categories[kind].splice(i, 1);
          else DB.categories[kind][i] = { name: v.name, icon: v.icon, color: v.color, ...(v.employerId ? { employerId: v.employerId } : {}) };
          try { await saveDb("categories"); } catch (e) { toast(e.message, "x"); return; }
          render();
        }));
      } else {
        $$("[data-del]", box).forEach((b) => b.addEventListener("click", async (e) => {
          e.stopPropagation();
          const i = Number(b.dataset.del);
          const name = DB.categories[kind][i]?.name;
          if (!(await confirmBox(`「${name}」を削除しますか？`))) return;
          DB.categories[kind].splice(i, 1);
          try { await saveDb("categories"); } catch (err) { toast(err.message, "x"); return; }
          render();
        }));
        makeSortable(box.querySelector("#cmCatList"), "[data-handle]", ".cat-row", async (from, to) => {
          const arr = DB.categories[kind];
          const [moved] = arr.splice(from, 1);
          arr.splice(to, 0, moved);
          try { await saveDb("categories"); } catch (e) { toast(e.message, "x"); }
          render();
        });
      }
    };
    document.body.appendChild(box);
    render();
  });
}

VIEWS.categories = {
  title: "カテゴリー", icon: "grid",
  async render(main) {
    await ensureCategoriesMigrated();
    const kind = CAT_TAB;
    const cats = (DB.categories[kind] || []).map(normCat);
    main.innerHTML = `
      <div class="page-head">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="icon-btn" id="catBack" aria-label="戻る">${icon("chevR", 18, "flip")}</button>
          <div><p class="eyebrow">Categories</p><h1>カテゴリー</h1></div>
        </div>
        <button class="btn ghost" id="catEditToggle">${CAT_EDIT ? "完了" : "編集"}</button>
      </div>
      <div class="tabs" style="margin-bottom:16px">
        <button class="tab ${kind === "expense" ? "active" : ""}" data-ctab="expense">支出</button>
        <button class="tab ${kind === "income" ? "active" : ""}" data-ctab="income">収入</button>
      </div>
      <button class="btn ghost" id="catAdd" style="width:100%;justify-content:flex-start;margin-bottom:14px">${icon("plus", 16)} 新規カテゴリーの追加</button>
      <div class="card" style="padding:6px 14px"><div id="catList">${catRowsHTML(cats, CAT_EDIT)}</div></div>`;

    $("#catBack").addEventListener("click", () => go("settings"));
    $("#catEditToggle").addEventListener("click", () => { CAT_EDIT = !CAT_EDIT; rerender(); });
    $$("[data-ctab]", main).forEach((b) => b.addEventListener("click", () => { CAT_TAB = b.dataset.ctab; rerender(); }));

    $("#catAdd").addEventListener("click", async () => {
      const v = await categoryModal(kind);
      if (!v || v.__delete) return;
      DB.categories[kind] = [...(DB.categories[kind] || []), { name: v.name, icon: v.icon, color: v.color, ...(v.employerId ? { employerId: v.employerId } : {}) }];
      try { await saveDb("categories"); } catch (e) { toast(e.message, "x"); return; }
      rerender();
    });

    if (!CAT_EDIT) {
      // 通常モード: 行タップで編集
      $$(".cat-row", main).forEach((row) => row.addEventListener("click", async () => {
        const i = Number(row.dataset.idx);
        const cur = normCat(DB.categories[kind][i]);
        const v = await categoryModal(kind, cur);
        if (!v) return;
        if (v.__delete) DB.categories[kind].splice(i, 1);
        else DB.categories[kind][i] = { name: v.name, icon: v.icon, color: v.color, ...(v.employerId ? { employerId: v.employerId } : {}) };
        try { await saveDb("categories"); } catch (e) { toast(e.message, "x"); return; }
        rerender();
      }));
    } else {
      // 編集モード: 赤い−で削除、ハンドルで並べ替え
      $$("[data-del]", main).forEach((b) => b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const i = Number(b.dataset.del);
        const name = DB.categories[kind][i]?.name;
        if (!(await confirmBox(`「${name}」を削除しますか？`))) return;
        DB.categories[kind].splice(i, 1);
        try { await saveDb("categories"); } catch (err) { toast(err.message, "x"); return; }
        rerender();
      }));
      makeSortable($("#catList", main), "[data-handle]", ".cat-row", async (from, to) => {
        const arr = DB.categories[kind];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        try { await saveDb("categories"); } catch (e) { toast(e.message, "x"); }
        rerender();
      });
    }
  },
};

VIEWS.settings = {
  title: "設定", icon: "settings",
  async render(main) {
    let tplDoc, empPending, cardPending;
    try { tplDoc = await api("/api/templates"); } catch (e) { tplDoc = { recurring: [] }; }
    try { empPending = await api("/api/employer-pending"); } catch (e) { empPending = []; }
    try { cardPending = await api("/api/creditcard-pending"); } catch (e) { cardPending = []; }
    const recurring = tplDoc.recurring || [];
    await ensureCategoriesMigrated();
    await ensureUberEmployerMigrated();
    const empPendingMap = Object.fromEntries(empPending.map((p) => [p.employerId, p]));
    const cardPendingMap = Object.fromEntries(cardPending.map((p) => [p.creditCardId, p]));
    const sec = (key, title, ic, bodyHtml, sub) => {
      const open = SETTINGS_OPEN.has(key);
      return `<div class="section ${open ? "open" : ""}">
        <button type="button" class="section-head" data-sec-toggle="${key}">
          <h2>${icon(ic, 15)} ${esc(title)}</h2>
          <span class="section-chevron">${icon("chevR", 14)}</span>
        </button>
        ${sub ? `<p class="section-sub">${sub}</p>` : ""}
        <div class="section-body" id="sec-${key}" style="${open ? "" : "display:none"}">${bodyHtml}</div>
      </div>`;
    };
    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Settings</p><h1>設定</h1></div></div>

      <div class="section-list">
      ${sec("profile", "プロフィール & 外観", "home", `
        <label class="f-label">お名前（ホームの挨拶に使われます）</label>
        <input type="text" id="sName" value="${esc(DB.settings.name || "")}" placeholder="しどう">
        <label class="f-label">テーマ</label>
        <div class="theme-toggle" id="themeToggle">
          <button type="button" data-theme-val="light" class="${currentTheme() === "light" ? "active" : ""}">${icon("sun", 15)} ライト</button>
          <button type="button" data-theme-val="dark" class="${currentTheme() === "dark" ? "active" : ""}">${icon("moon", 15)} ダーク</button>
        </div>
        <div style="margin-top:14px"><button class="btn" id="saveName">${icon("checkline", 14)} 保存</button></div>
      `)}
      ${sec("goals", "目標設定", "target", `
        <label class="f-label">今日の目標</label>
        <input type="text" id="sToday" value="${esc(DB.settings.todayGoal)}" placeholder="例: LP制作を2時間">
        <label class="f-label">今月の目標</label>
        <input type="text" id="sMonth" value="${esc(DB.settings.monthGoal)}" placeholder="例: 初案件を獲得">
        <label class="f-label">月間売上目標（円）</label>
        <input type="number" id="sSales" value="${DB.settings.salesGoal || 0}">
        <div style="margin-top:14px"><button class="btn" id="saveS">${icon("checkline", 14)} 保存</button></div>
      `)}
      ${sec("tasks", "毎日の定番タスク", "check", `
        <div id="tplList">${templateListHTML(recurring)}</div>
        <button class="btn ghost sm" id="tplAdd" style="margin-top:10px">${icon("plus", 13)} 定番タスクを追加</button>
      `)}
      <div class="section">
        <button type="button" class="section-head" id="catManageCard">
          <h2>${icon("grid", 15)} カテゴリー</h2>
          <span class="section-chevron">${icon("chevR", 14)}</span>
        </button>
        <p class="section-sub" style="margin-bottom:14px">収入・支出のカテゴリーを追加・編集・並べ替えできます</p>
      </div>
      ${sec("employers", "勤務先", "briefcase", `
        <p class="small" style="color:var(--muted);margin:0 0 12px">給与体系や支払いサイクルを登録すると、収支ページで収入を記録するときに自動で計算・入金管理ができます。給料日を過ぎると自動で入金確定（未収→残高に反映）されます。</p>
        <div id="empList">${employerListHTML(DB.employers.items, empPendingMap)}</div>
        <button class="btn ghost sm" id="addEmp" style="margin-top:10px">${icon("plus", 13)} 勤務先を追加</button>
      `)}
      ${sec("creditCards", "クレジットカード", "card", `
        <p class="small" style="color:var(--muted);margin:0 0 12px">締め日・引き落とし日を登録すると、支出を記録するときに支払い方法として選べるようになります。カードで払った支出は口座残高にはすぐ反映されず「引き落とし予定」になり、引き落とし日を過ぎると自動で確定（残高から反映）されます。</p>
        <div id="cardList">${creditCardListHTML(DB.creditCards.items, cardPendingMap)}</div>
        <button class="btn ghost sm" id="addCard" style="margin-top:10px">${icon("plus", 13)} クレジットカードを追加</button>
      `)}
      ${sec("data", "データ", "download", `
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn ghost" id="exportJson">${icon("download", 14)} 全データをエクスポート</button>
          <button class="btn ghost" id="copyAI">${icon("copy", 14)} 直近7日をAI用にコピー</button>
        </div>
        <p class="hint" style="margin-top:10px">エクスポートはバックアップとしても使えます。テーマ/カラー変更・通知は今後追加予定。</p>
      `)}
      ${sec("account", "アカウント", "logout", `
        <button class="btn danger" id="logout">${icon("logout", 14)} ログアウト</button>
      `)}
      </div>`;

    // セクションの開閉（アコーディオン）。作り直さずその場でクラス/表示だけ切り替える
    $$("[data-sec-toggle]", main).forEach((head) => {
      head.addEventListener("click", () => {
        const key = head.dataset.secToggle;
        const body = $("#sec-" + key, main);
        const section = head.closest(".section");
        if (SETTINGS_OPEN.has(key)) SETTINGS_OPEN.delete(key); else SETTINGS_OPEN.add(key);
        const open = SETTINGS_OPEN.has(key);
        section.classList.toggle("open", open);
        body.style.display = open ? "" : "none";
      });
    });

    // テーマ切替（即時反映＋端末に記憶）
    $("#themeToggle").addEventListener("click", (e) => {
      const b = e.target.closest("[data-theme-val]");
      if (!b) return;
      applyTheme(b.dataset.themeVal);
      $$("#themeToggle button").forEach((x) => x.classList.toggle("active", x === b));
    });
    $("#saveName").addEventListener("click", async () => {
      DB.settings.name = $("#sName").value.trim() || "しどう";
      await saveDb("settings");
      toast("保存しました");
    });

    $("#saveS").addEventListener("click", async () => {
      DB.settings.todayGoal = $("#sToday").value.trim();
      DB.settings.monthGoal = $("#sMonth").value.trim();
      DB.settings.salesGoal = Number($("#sSales").value) || 0;
      await saveDb("settings");
      toast("設定を保存しました");
    });

    $("#tplAdd").addEventListener("click", async () => {
      const v = await templateModal();
      if (!v) return;
      recurring.push({ title: v.title, time: v.time, days: v.days });
      await api("/api/templates", { method: "PUT", body: JSON.stringify({ recurring }) });
      toast("定番タスクを追加しました");
      rerender();
    });
    $$("[data-tpl-open]", main).forEach((el) => {
      const open = async () => {
        const t = recurring[Number(el.dataset.tplOpen)];
        if (!t) return;
        const v = await templateModal(t);
        if (!v) return;
        if (v.__delete) recurring.splice(Number(el.dataset.tplOpen), 1);
        else Object.assign(t, { title: v.title, time: v.time, days: v.days });
        await api("/api/templates", { method: "PUT", body: JSON.stringify({ recurring }) });
        toast(v.__delete ? "定番タスクを削除しました" : "定番タスクを保存しました");
        rerender();
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });

    // カテゴリー管理ページへ
    $("#catManageCard").addEventListener("click", () => go("categories"));

    // 勤務先の追加・編集
    // 同じ収入カテゴリーは1つの勤務先にだけ連動させる（他の勤務先から外す）
    const dedupLinkedCategory = (catName, keepId) => {
      if (!catName) return;
      DB.employers.items.forEach((x) => { if (x.id !== keepId && x.linkedCategory === catName) x.linkedCategory = null; });
    };
    $("#addEmp").addEventListener("click", async () => {
      const v = await employerModal({});
      if (!v) return;
      const nu = { id: uid(), ...v };
      dedupLinkedCategory(nu.linkedCategory, nu.id);
      DB.employers.items.push(nu);
      await saveDb("employers");
      rerender();
    });
    $$("[data-emp-open]", main).forEach((el) => {
      const open = async () => {
        const e = DB.employers.items.find((x) => x.id === el.dataset.empOpen);
        if (!e) return;
        const v = await employerModal(e);
        if (!v) return;
        if (v.__delete) {
          DB.employers.items = DB.employers.items.filter((x) => x.id !== e.id);
        } else {
          Object.assign(e, v);
          dedupLinkedCategory(e.linkedCategory, e.id);
        }
        await saveDb("employers");
        rerender();
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); } });
    });

    $("#exportJson").addEventListener("click", async () => {
      const hist = await api("/api/history?days=365");
      const data = { exportedAt: new Date().toISOString(), days: hist };
      for (const k of Object.keys(DOC_DEFAULTS)) data[k] = DB[k];
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lifeos-backup-${todayStr()}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      toast("エクスポートしました", "download");
    });

    $("#copyAI").addEventListener("click", async () => {
      const md = await (await fetch("/api/export?days=7")).text();
      await navigator.clipboard.writeText(md);
      toast("コピーしました。Claude/ChatGPTに貼れます", "copy");
    });

    $("#logout").addEventListener("click", async () => {
      await fetch("/api/logout", { method: "POST" });
      location.href = "/login";
    });

    // クレジットカードの追加・編集
    $("#addCard").addEventListener("click", async () => {
      const v = await creditCardModal({});
      if (!v) return;
      DB.creditCards.items.push({ id: uid(), ...v });
      await saveDb("creditCards");
      rerender();
    });
    $$("[data-card-open]", main).forEach((el) => {
      const open = async () => {
        const c = DB.creditCards.items.find((x) => x.id === el.dataset.cardOpen);
        if (!c) return;
        const v = await creditCardModal(c);
        if (!v) return;
        if (v.__delete) {
          DB.creditCards.items = DB.creditCards.items.filter((x) => x.id !== c.id);
        } else {
          Object.assign(c, v);
        }
        await saveDb("creditCards");
        rerender();
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); } });
    });
  },
};
