// upnext: what's coming, as a row of illustrated cards after Odie's Today.
import { clean, firstList, firstText, firstTextOrNumber, keepFirst, type Trail } from "../../core/fields";
import { KIND_BG } from "../../lib/EventArt";

export type UpNextState = "overdue" | "today" | "soon";
export type UpNextItem = { date: string; title: string; kind: string; time?: string; amount?: string;
  source?: "mail" | "calendar"; ask?: string; state?: UpNextState; stateText?: string };
export type UpNextBlock = { type: "upnext"; title?: string; items: UpNextItem[]; compact?: boolean };
const STATES: UpNextState[] = ["overdue", "today", "soon"];

// Everyday words for a kind, mapped onto the illustrations (EventArt's kinds).
const ALIASES: Record<string, string> = {
  flight: "travel", trip: "travel", train: "travel", appointment: "medical", dentist: "medical", doctor: "medical",
  order: "delivery", package: "delivery", parcel: "delivery", shopping: "delivery", payment: "bill", invoice: "bill",
  dinner: "meal", lunch: "meal", brunch: "meal", gym: "fitness", workout: "fitness", run: "fitness",
  wedding: "celebration", party: "celebration", concert: "show", event: "show", class: "school",
};

/** An illustration kind for any word: "flight" → "travel"; "bill" → "bill"; "whatever" → "general". */
export function kindOf(v: unknown): string {
  const word = firstText([v], 30)?.toLowerCase() ?? "";
  if (word in KIND_BG) return word;
  return ALIASES[word] ?? "general";
}

/**
 * upnext: items (also `events`) up to 12, each {date (YYYY-MM-DD), title (also `name`), kind, time, amount, source:
 * "mail" | "calendar", ask, state (overdue | today | soon) with stateText}; title for the row; compact: smaller cards
 * that wrap instead of scrolling.
 *   {type: "upnext", events: [{date: "2026-11-24", name: "Flight to Austin", kind: "flight"}]}
 *   → {type: "upnext", items: [{date: "2026-11-24", title: "Flight to Austin", kind: "travel"}]}
 * Dropped: no item with a date and a title.
 */
export function readUpNext(raw: any, here: Trail): UpNextBlock | null {
  const items: UpNextItem[] = [];
  (firstList([raw.items, raw.events]) ?? []).forEach((it: any, i) => {
    const date = firstText([it?.date], 40)?.slice(0, 10);
    const title = firstText([it?.title, it?.name], 80);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) {
      here.at("items").at(i).drop("item needs a date and a title");
      return;
    }
    const source = it?.source === "mail" || it?.source === "calendar" ? it.source : undefined;
    const state = STATES.includes(it?.state) ? (it.state as UpNextState) : undefined;
    items.push(clean({ date, title, kind: kindOf(it?.kind), time: firstText([it?.time], 20),
      amount: firstTextOrNumber([it?.amount], 20), source, ask: firstText([it?.ask], 160), state,
      stateText: state ? firstText([it?.stateText], 40) : undefined }));
  });
  if (!items.length) return here.drop("upnext has no item with a date and a title");
  return clean({ type: "upnext" as const, title: firstText([raw.title], 60), items: keepFirst(items, 12, here, "items"),
    compact: raw.compact === true ? true : undefined });
}
