// calendar: a day at a glance (after Odie's Today): a big date card with the next event and Ask about it, the day's
// events, and a week strip with a dot on days that have something on.
import { clean, firstList, firstText, keepFirst, num, type Trail } from "../../core/fields";

export type CalendarEvent = { title: string; start: string; end?: string; place?: string };
export type CalendarDay = { date: string; count: number };
export type CalendarBlock = { type: "calendar"; date: string; title?: string; events: CalendarEvent[];
  week: CalendarDay[]; ask?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A start or end as HH:MM: "9:30" → "09:30"; "2026-11-14T07:30:00" → "07:30"; anything else → undefined. */
export function hhmm(v: unknown): string | undefined {
  const text = firstText([v], 40);
  if (!text) return undefined;
  const m = /(?:T|^)(\d{1,2}):(\d{2})/.exec(text);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined;
}

const dayOf = (v: unknown) => {
  const text = firstText([v], 40)?.slice(0, 10);
  return text && DAY.test(text) ? text : undefined;
};

/**
 * calendar: date (also `day`) as YYYY-MM-DD; events (also `items`) up to 12, each {title (also `name`), start, end,
 * place (also `location`)} with start as "HH:MM" or an ISO time; week up to 7 {date, count}; ask.
 *   {type: "calendar", day: "2026-11-14", items: [{name: "Run", start: "2026-11-14T07:30:00"}]}
 *   → {type: "calendar", date: "2026-11-14", events: [{title: "Run", start: "07:30"}], week: []}
 * Dropped: no real date. An event without a title or start is left out, with a note.
 */
export function readCalendar(raw: any, here: Trail): CalendarBlock | null {
  const date = dayOf(raw.date ?? raw.day);
  if (!date) return here.drop("calendar needs date as YYYY-MM-DD");
  const events: CalendarEvent[] = [];
  (firstList([raw.events, raw.items]) ?? []).forEach((e: any, i) => {
    const title = firstText([e?.title, e?.name], 80);
    const start = hhmm(e?.start ?? e?.time);
    if (!title || !start) {
      here.at("events").at(i).drop("event needs a title and a start");
      return;
    }
    events.push(clean({ title, start, end: hhmm(e?.end), place: firstText([e?.place, e?.location], 60) }));
  });
  const week: CalendarDay[] = [];
  (firstList([raw.week]) ?? []).forEach((d: any) => {
    const day = dayOf(d?.date);
    if (day) week.push({ date: day, count: Math.max(0, num(d?.count) ?? 0) });
  });
  return clean({
    type: "calendar" as const, date, title: firstText([raw.title], 60),
    events: keepFirst(events.sort((a, b) => a.start.localeCompare(b.start)), 12, here, "events"),
    week: keepFirst(week, 7, here, "week"), ask: firstText([raw.ask], 120),
  });
}
