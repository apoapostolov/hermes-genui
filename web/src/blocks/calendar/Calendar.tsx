// A day at a glance, flat and wide: the date on the left (weekday, the day as a big number, month), the next event
// with Ask about it and the day's events as a row in the middle, and the week strip on the right, with the day
// selected and a dot on days that have something on. On a phone the three parts stack.
import { useContext } from "react";
import { BlockActions } from "../../host/actions";
import { Icon } from "../../lib/Icon";
import type { CalendarBlock, CalendarEvent } from "./read";

const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** When a day is, from now: "Today", "Tomorrow", a weekday within the week, else "Sat 21 Nov". */
export function relativeDay(iso: string, now: Date): string {
  const day = parts(iso);
  if (sameDay(day, now)) return "Today";
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(day, tomorrow)) return "Tomorrow";
  const days = (day.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000;
  if (days > 0 && days < 7) return day.toLocaleDateString("en-GB", { weekday: "long" });
  return `${day.toLocaleDateString("en-GB", { weekday: "short" })} ${day.getDate()} `
    + day.toLocaleDateString("en-GB", { month: "short" });
}

/** The event to show first: on today, the first that hasn't ended; on another day, the first. */
export function nextEvent(events: CalendarEvent[], iso: string, now: Date): CalendarEvent | undefined {
  if (!sameDay(parts(iso), now)) return events[0];
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return events.find((e) => (e.end ?? e.start) > hm) ?? events.at(-1);
}

export function Calendar({ date, title, events, week, ask }: CalendarBlock) {
  const { fill } = useContext(BlockActions);
  const now = new Date();
  const day = parts(date);
  const next = nextEvent(events, date, now);
  return (
    <div className="hb-card hb-cal">
      <div className="hb-cal-date">
        <span className="hb-cal-weekday">{day.toLocaleDateString("en-GB", { weekday: "long" })}</span>
        <span className="hb-cal-day">{day.getDate()}</span>
        <span className="hb-cal-month">{day.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
      </div>
      <div className="hb-cal-mid">
        <div className="hb-cal-next-row">
          {title && <span className="hb-cal-title">{title}</span>}
          {next && (
            <span className="hb-cal-next">
              <span className="hb-cal-next-when">{relativeDay(date, now)}</span>
              <span className="hb-cal-next-time">{next.end ? `${next.start}–${next.end}` : next.start}</span>
              <span className="hb-cal-next-title">{next.title}</span>
            </span>
          )}
          {ask && (
            <button type="button" className="hb-cal-ask" onClick={() => fill(ask)}>
              <Icon name="spark" size={14} /> Ask about it
            </button>
          )}
        </div>
        {events.length ? (
          <ul className="hb-cal-events">
            {events.map((e, i) => (
              <li key={i} title={e.place}>
                <span className="hb-cal-event-time">{e.start}</span>
                <span className="hb-cal-event-title">{e.title}</span>
              </li>
            ))}
          </ul>
        ) : <div className="hb-cal-empty">Nothing planned</div>}
      </div>
      {week.length > 0 && (
        <ul className="hb-cal-week" aria-label="This week">
          {week.map((d) => {
            const wd = parts(d.date);
            const cls = [d.date === date ? "is-selected" : "", d.count > 0 ? "has-events" : ""].filter(Boolean).join(" ");
            return (
              <li key={d.date} className={cls}
                aria-label={`${wd.toLocaleDateString("en-GB", { weekday: "long", day: "numeric" })}: ${d.count} events`}>
                <span>{wd.toLocaleDateString("en-GB", { weekday: "narrow" })}</span>
                <b>{wd.getDate()}</b>
                <i aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
