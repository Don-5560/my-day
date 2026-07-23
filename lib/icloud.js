// iCloudカレンダー（CalDAV）から予定を読み取るだけの連携。書き込みはしない。
// Apple IDのアプリ用パスワード（appleid.apple.com で発行）を使う。通常のログインパスワードは使えない。

import { createDAVClient } from "tsdav";
import ical from "node-ical";

async function connect(appleId, appPassword) {
  return createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username: appleId, password: appPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

// 接続テスト＋カレンダー一覧の取得。失敗時は例外を投げる（呼び出し側でメッセージ化）。
export async function listCalendars(appleId, appPassword) {
  const client = await connect(appleId, appPassword);
  const calendars = await client.fetchCalendars();
  return calendars
    .filter((c) => (c.components || []).includes("VEVENT"))
    .map((c) => ({ url: c.url, name: typeof c.displayName === "string" ? c.displayName : "カレンダー" }));
}

// 指定期間の予定を取得する。calendarUrls省略時は全カレンダー対象。繰り返し予定はnode-icalで展開する。
export async function fetchEvents(appleId, appPassword, calendarUrls, fromIso, toIso) {
  const client = await connect(appleId, appPassword);
  const all = await client.fetchCalendars();
  const targets = (calendarUrls?.length ? all.filter((c) => calendarUrls.includes(c.url)) : all)
    .filter((c) => (c.components || []).includes("VEVENT"));
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const events = [];
  for (const cal of targets) {
    const calName = typeof cal.displayName === "string" ? cal.displayName : "カレンダー";
    let objects;
    try {
      objects = await client.fetchCalendarObjects({ calendar: cal, timeRange: { start: fromIso, end: toIso } });
    } catch {
      continue; // 1カレンダーの取得失敗で全体を落とさない
    }
    for (const obj of objects) {
      if (!obj.data) continue;
      let parsed;
      try { parsed = ical.parseICS(obj.data); } catch { continue; }
      for (const key in parsed) {
        const ev = parsed[key];
        if (ev.type !== "VEVENT" || !ev.start) continue;
        let instances;
        try { instances = ical.expandRecurringEvent(ev, { from, to }); } catch { continue; }
        for (const inst of instances.slice(0, 100)) {
          events.push({
            id: (ev.uid || obj.url) + "|" + inst.start.toISOString(),
            title: inst.summary || ev.summary || "(無題)",
            start: inst.start.toISOString(),
            end: inst.end.toISOString(),
            allDay: !!inst.isFullDay,
            calendarName: calName,
          });
        }
      }
    }
  }
  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}
