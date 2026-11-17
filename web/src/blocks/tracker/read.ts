// tracker (Today only): the personal assistant's Needs you / Handled lists, built by the plugin from what it tracks.
import { actsBeforeTheModel, clean, firstText, https, type Trail } from "../../core/fields";

export const STATES = ["overdue", "today", "soon", "open"] as const;
export type CardState = (typeof STATES)[number];
export type Details = { from?: string; received?: string; about: string[]; trail: string[] };
export type Card = { id: string; title: string; amount?: string; state: CardState; stateText?: string; help?: string;
  link?: { label: string; url: string }; details?: Details };
export type Row = { id: string; title: string; amount?: string; kind: "closed" | "tracking" | "protected";
  verb: string; why?: string; reopen?: boolean; details?: Details };
export type TrackerBlock = { type: "tracker"; need: Card[]; handled: Row[] };

const KINDS = ["closed", "tracking", "protected"];
const texts = (v: unknown, n: number, max: number) =>
  (Array.isArray(v) ? v : []).map((x) => firstText([x], max)).filter((x): x is string => Boolean(x)).slice(0, n);

function details(raw: any): Details | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = clean({ from: firstText([raw.from], 120), received: firstText([raw.received], 40),
    about: texts(raw.about, 4, 60), trail: texts(raw.trail, 8, 80) });
  return d.from || d.about.length || d.trail.length ? d : undefined;
}

/**
 * tracker: need (cards {id, title, amount, state: overdue | today | soon | open, stateText, help, link {label, url
 * https}, details {from, received, about[], trail[]}}, up to 20) and handled (rows {id, title, amount, kind: closed |
 * tracking | protected, verb, why, reopen, details}, up to 6).
 * Dropped: a card or row with no id or title, a row of unknown kind, a help that acts before the model, a link that
 * isn't https. An unknown state reads as open.
 */
export function readTracker(raw: any, here: Trail): TrackerBlock | null {
  const need: Card[] = [];
  (Array.isArray(raw.need) ? raw.need : []).slice(0, 20).forEach((c: any, i: number) => {
    const id = firstText([c?.id], 40);
    const title = firstText([c?.title], 80);
    if (!id || !title) { here.at("need").at(i).drop("card needs an id and a title"); return; }
    const help = firstText([c?.help], 120);
    const url = https(c?.link?.url);
    const label = firstText([c?.link?.label], 40);
    need.push(clean({ id, title, amount: firstText([c?.amount], 20),
      state: (STATES as readonly string[]).includes(c?.state) ? c.state : "open", stateText: firstText([c?.stateText], 60),
      help: help && !actsBeforeTheModel(help) ? help : undefined, link: url && label ? { label, url } : undefined,
      details: details(c?.details) }));
  });
  const handled: Row[] = [];
  (Array.isArray(raw.handled) ? raw.handled : []).slice(0, 6).forEach((r: any, i: number) => {
    const id = firstText([r?.id], 40);
    const title = firstText([r?.title], 80);
    if (!id || !title || !KINDS.includes(r?.kind)) { here.at("handled").at(i).drop("row needs an id, a title, a kind"); return; }
    handled.push(clean({ id, title, amount: firstText([r?.amount], 20), kind: r.kind, verb: firstText([r?.verb], 30) ?? "",
      why: firstText([r?.why], 120), reopen: r?.reopen === true ? true : undefined, details: details(r?.details) }));
  });
  return { type: "tracker", need, handled };
}
