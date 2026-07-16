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
  render(main) {
    const logs = DB.sales.logs;
    const mk = monthKey(todayStr());
    const monthSum = (key) => logs.filter((l) => monthKey(l.date) === key).reduce((s, l) => s + l.amount, 0);
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
        ${statCard("yen", fmtYen(monthSum(mk)), "今月")}
        ${statCard("chart", fmtYen(total), "累計")}
        ${statCard("target", fmtYen(goal), "月間目標")}
        ${statCard(diff >= 0 ? "trophy" : "clock", (diff >= 0 ? "+" : "") + fmtYen(diff).replace("¥-", "-¥"), "目標との差")}
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
            <span class="row-title small">${fmtShort(l.date)}${l.memo ? " — " + esc(l.memo) : ""}</span>
            <strong>${fmtYen(l.amount)}</strong>
            <button class="icon-btn danger row-del" data-del="${l.id}">${icon("trash", 13)}</button>
          </div>`).join("") || '<p class="empty">売上記録がありません</p>'}
      </div>`;

    $("#add").addEventListener("click", async () => {
      const v = await modal("売上を記録", [
        { key: "date", label: "日付", type: "date", default: todayStr() },
        { key: "amount", label: "金額（円）", type: "money", placeholder: "50000" },
        { key: "source", label: "収入源", type: "select", options: SALE_SOURCES },
        { key: "memo", label: "メモ", type: "text", placeholder: "例: ◯◯様 LP制作" },
      ]);
      if (!v || !v.amount) return;
      DB.sales.logs.push({ id: uid(), ...v, date: v.date || todayStr() });
      await saveDb("sales");
      await addXP(Math.min(Math.round(v.amount / 1000), 300), "売上を記録！");
      rerender();
    });
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      DB.sales.logs = DB.sales.logs.filter((x) => x.id !== b.dataset.del);
      await saveDb("sales"); rerender();
    }));
  },
};

// ===== お金（残高・収入・支出） =====
// 取引はサーバーのSQLテーブル。docではないので描画時にAPIから取得する。

const TX_INCOME_CATS = ["Web制作", "Uber", "その他"];
const TX_EXPENSE_CATS = ["生活費", "事業経費", "ツール代", "その他"];
const signedYen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Number(n) || 0).toLocaleString();

VIEWS.money = {
  title: "お金", icon: "wallet",
  async render(main) {
    const mk = monthKey(todayStr());
    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Money</p><h1>お金</h1></div></div>
      <p class="empty">読み込み中…</p>`;

    let fin, txs;
    try {
      [fin, txs] = await Promise.all([api("/api/finance"), api("/api/transactions?month=" + mk)]);
    } catch (e) {
      main.innerHTML = `<p class="empty">読み込みに失敗しました: ${esc(e.message)}</p>`;
      return;
    }
    DB.finance = fin;
    if (CURRENT !== "money") return; // 取得中に他画面へ移動していたら描画しない

    const groupByCat = (list) => {
      const m = {};
      for (const t of list) m[t.category] = (m[t.category] || 0) + t.amount;
      return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    const incomeRows = groupByCat(txs.filter((t) => t.type === "income"));
    const expenseRows = groupByCat(txs.filter((t) => t.type === "expense"));

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Money</p><h1>お金</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" id="setInit">${icon("wallet", 15)} 初期残高</button>
          <button class="btn" id="addIncome">${icon("plus", 15)} 収入</button>
          <button class="btn" id="addExpense" style="background:var(--red);border:none">${icon("plus", 15)} 支出</button>
        </div>
      </div>
      <div class="stat-grid">
        ${statCard("wallet", signedYen(fin.currentBalance), "現在の残高")}
        ${statCard("chart", fmtYen(fin.incomeThisMonth), "今月の収入")}
        ${statCard("chart", fmtYen(fin.expenseThisMonth), "今月の支出")}
        ${statCard(fin.netThisMonth >= 0 ? "trophy" : "clock", signedYen(fin.netThisMonth), "今月の収支")}
      </div>
      <div class="grid2">
        <div class="card" style="margin-bottom:0"><h2>${icon("layers", 15)} 今月の収入（内訳）</h2>${hbars(incomeRows, fmtYen)}</div>
        <div class="card" style="margin-bottom:0"><h2>${icon("layers", 15)} 今月の支出（内訳）</h2>${hbars(expenseRows, fmtYen)}</div>
      </div>
      <div class="card" style="margin-top:18px">
        <h2>${icon("calendar", 15)} 今月の取引</h2>
        ${txs.map((t) => {
          const inc = t.type === "income";
          return `<div class="row">
            <span class="pill" style="background:${inc ? "rgba(52,211,153,.15)" : "rgba(248,113,113,.15)"};color:${inc ? "var(--green)" : "var(--red)"}">${esc(t.category)}</span>
            <span class="row-title small">${fmtShort(t.date)}${t.memo ? " — " + esc(t.memo) : ""}</span>
            <strong style="color:${inc ? "var(--green)" : "var(--red)"}">${inc ? "+" : "-"}${fmtYen(t.amount)}</strong>
            <button class="icon-btn danger row-del" data-del="${t.id}">${icon("trash", 13)}</button>
          </div>`;
        }).join("") || '<p class="empty">今月の取引はまだありません</p>'}
      </div>`;

    const addTx = async (type, cats) => {
      const v = await modal(type === "income" ? "収入を追加" : "支出を追加", [
        { key: "date", label: "日付", type: "date", default: todayStr() },
        { key: "amount", label: "金額（円）", type: "money", placeholder: "10000" },
        { key: "category", label: "カテゴリ", type: "select", options: cats },
        { key: "memo", label: "メモ", type: "text", placeholder: "任意" },
      ]);
      if (!v || !v.amount) return;
      try {
        await api("/api/transactions", {
          method: "POST",
          body: JSON.stringify({ type, amount: Math.round(v.amount), category: v.category, date: v.date || todayStr(), memo: v.memo }),
        });
      } catch (e) { toast(e.message, "x"); return; }
      toast(type === "income" ? "収入を記録しました" : "支出を記録しました");
      rerender();
    };
    $("#addIncome").addEventListener("click", () => addTx("income", TX_INCOME_CATS));
    $("#addExpense").addEventListener("click", () => addTx("expense", TX_EXPENSE_CATS));
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
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      try { await api("/api/transactions/" + b.dataset.del, { method: "DELETE" }); }
      catch (e) { toast(e.message, "x"); return; }
      rerender();
    }));
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

// ===== カレンダー（GitHub風ヒートマップ） =====

VIEWS.calendar = {
  title: "カレンダー", icon: "calendar",
  async render(main) {
    const map = activityMap();
    const N = 119; // 17週
    const start = new Date(); start.setDate(start.getDate() - N);
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1); // 日曜はじまり
    const cells = [];
    const cur = new Date(start);
    const today = todayStr();
    while (true) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (iso > today) break;
      const xp = map[iso] || 0;
      const lv = xp >= 100 ? 4 : xp >= 50 ? 3 : xp >= 25 ? 2 : xp > 0 ? 1 : 0;
      cells.push({ iso, xp, lv });
      cur.setDate(cur.getDate() + 1);
    }
    const active = cells.filter((c) => c.xp > 0).length;

    main.innerHTML = `
      <div class="page-head">
        <div><p class="eyebrow">Activity</p><h1>カレンダー</h1></div>
        <span class="pill acc">${icon("flame", 12)} 連続 ${streak()}日</span>
      </div>
      <div class="card">
        <h2>${icon("calendar", 15)} 毎日の活動量（獲得XP）— 直近${cells.length}日 / 活動${active}日</h2>
        <div class="heatmap">${cells.map((c) =>
          `<span class="hm-cell ${c.lv ? "hm-" + c.lv : ""}" data-day="${c.iso}" title="${c.iso}: ${c.xp} XP"></span>`).join("")}</div>
        <div style="display:flex;gap:5px;align-items:center;justify-content:flex-end;margin-top:10px" class="small muted">
          少ない <span class="hm-cell"></span><span class="hm-cell hm-1"></span><span class="hm-cell hm-2"></span><span class="hm-cell hm-3"></span><span class="hm-cell hm-4"></span> 多い
        </div>
      </div>
      <div class="card" id="dayDetail"><p class="empty">マスをクリックすると、その日の記録が見られます</p></div>`;

    let hist = null;
    $$(".heatmap .hm-cell").forEach((cell) => cell.addEventListener("click", async () => {
      const iso = cell.dataset.day;
      if (!hist) hist = await api("/api/history?days=130");
      const d = hist.find((x) => x.date === iso);
      const xp = map[iso] || 0;
      const study = DB.study.logs.filter((l) => l.date === iso).reduce((s, l) => s + l.min, 0);
      $("#dayDetail").innerHTML = `
        <h2>${icon("calendar", 15)} ${fmtJP(iso)}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <span class="pill acc">${icon("zap", 11)} ${xp} XP</span>
          <span class="pill">${icon("timer", 11)} ${fmtMin(study) || "0分"}</span>
          ${d ? `<span class="pill">${icon("check", 11)} ${d.tasks.filter((t) => t.done).length}/${d.tasks.length} タスク</span>` : ""}
        </div>
        ${d?.diary ? `<p class="small" style="white-space:pre-wrap;margin:0">${esc(d.diary)}</p>` : '<p class="empty">この日の日報はありません</p>'}`;
      $("#dayDetail").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
  },
};

// ===== 設定 =====

VIEWS.settings = {
  title: "設定", icon: "settings",
  render(main) {
    main.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Settings</p><h1>設定</h1></div></div>

      <div class="card">
        <h2>${icon("home", 15)} プロフィール & 外観</h2>
        <label class="f-label">お名前（ホームの挨拶に使われます）</label>
        <input type="text" id="sName" value="${esc(DB.settings.name || "")}" placeholder="しどう">
        <label class="f-label">テーマ</label>
        <div class="theme-toggle" id="themeToggle">
          <button type="button" data-theme-val="light" class="${currentTheme() === "light" ? "active" : ""}">${icon("sun", 15)} ライト</button>
          <button type="button" data-theme-val="dark" class="${currentTheme() === "dark" ? "active" : ""}">${icon("moon", 15)} ダーク</button>
        </div>
        <div style="margin-top:14px"><button class="btn" id="saveName">${icon("checkline", 14)} 保存</button></div>
      </div>

      <div class="card">
        <h2>${icon("target", 15)} 目標設定</h2>
        <label class="f-label">今日の目標</label>
        <input type="text" id="sToday" value="${esc(DB.settings.todayGoal)}" placeholder="例: LP制作を2時間">
        <label class="f-label">今月の目標</label>
        <input type="text" id="sMonth" value="${esc(DB.settings.monthGoal)}" placeholder="例: 初案件を獲得">
        <label class="f-label">月間売上目標（円）</label>
        <input type="number" id="sSales" value="${DB.settings.salesGoal || 0}">
        <div style="margin-top:14px"><button class="btn" id="saveS">${icon("checkline", 14)} 保存</button></div>
      </div>

      <div class="card">
        <h2>${icon("check", 15)} 毎日の定番タスク</h2>
        <p class="hint">1行に1つ。<code>タスク名</code> だけなら毎日。曜日指定は <code>タスク名 @mon,wed,fri</code></p>
        <textarea id="sTpl"></textarea>
        <div style="margin-top:12px"><button class="btn ghost" id="saveTpl">${icon("checkline", 14)} 定番タスクを保存</button></div>
      </div>

      <div class="card">
        <h2>${icon("download", 15)} データ</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn ghost" id="exportJson">${icon("download", 14)} 全データをエクスポート</button>
          <button class="btn ghost" id="copyAI">${icon("copy", 14)} 直近7日をAI用にコピー</button>
        </div>
        <p class="hint" style="margin-top:10px">エクスポートはバックアップとしても使えます。テーマ/カラー変更・通知は今後追加予定。</p>
      </div>

      <div class="card">
        <h2>${icon("logout", 15)} アカウント</h2>
        <button class="btn danger" id="logout">${icon("logout", 14)} ログアウト</button>
      </div>`;

    // 定番タスク読み込み
    api("/api/templates").then((tpl) => {
      $("#sTpl").value = (tpl.recurring || [])
        .map((t) => (t.days && t.days !== "daily" ? `${t.title} @${t.days.join(",")}` : t.title)).join("\n");
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

    $("#saveTpl").addEventListener("click", async () => {
      const recurring = [];
      for (const raw of $("#sTpl").value.split("\n")) {
        const line = raw.trim(); if (!line) continue;
        const m = line.match(/^(.*?)\s*@([a-z,]+)$/i);
        if (m) recurring.push({ title: m[1].trim(), days: m[2].toLowerCase().split(",").filter(Boolean) });
        else recurring.push({ title: line, days: "daily" });
      }
      await api("/api/templates", { method: "PUT", body: JSON.stringify({ recurring }) });
      toast("定番タスクを保存しました");
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
  },
};
