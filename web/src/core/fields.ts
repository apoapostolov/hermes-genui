// Small readers every block reader shares: each takes one field as the model wrote it and returns something safe to
// draw, or undefined/null when the field is missing or unusable. Plus Trail, which records what was dropped and why.
import { ICON_NAMES, type IconName } from "../lib/icons";

/** A finite number, or null. 42 → 42; "42" → null; NaN → null. */
export function num(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  return null;
}

/** Trimmed text cut to `max`; undefined when empty or not text. "  Lisbon " → "Lisbon" */
export function str(v: unknown, max = 120): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/** The first of several fields that holds usable text. Models name the same thing differently, so a reader asks
 *  for the main field first and its aliases after: firstText([item.title, item.name], 80). */
export function firstText(values: unknown[], max = 120): string | undefined {
  for (const v of values) {
    const found = str(v, max);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Text cut to at most `max` characters between words, ending in "…" when cut, with any comma or dash left at the cut
 * dropped. One long word that fills most of the room (a link) is cut inside it.
 *   ("Why do transformers need positional encoding if attention already sees everything?", 60)
 *     → "Why do transformers need positional encoding if attention…"
 *   ("Rome, Paris, London", 14) → "Rome, Paris…";  ("Host city?", 20) → "Host city?"
 */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);   // one character left for the "…"
  const lastSpace = room.search(/\s\S*$/);
  const cut = lastSpace > max / 2 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** firstText for sentences a reader would notice were cut (a flash card's question): a long one is cut between words
 *  and ends in "…" (cutAtWord). firstWords([card.front, card.question], 140) */
export function firstWords(values: unknown[], max = 120): string | undefined {
  const found = firstText(values, Infinity);
  return found === undefined ? undefined : cutAtWord(found, max);
}

/** The first of several fields that is a list: firstList([raw.items, raw.events]). */
export function firstList(values: unknown[]): unknown[] | undefined {
  return values.find((v) => Array.isArray(v)) as unknown[] | undefined;
}

/** One of the icon names, or undefined. "plane" → "plane"; "aeroplane" → undefined. */
export function icon(v: unknown): IconName | undefined {
  if ((ICON_NAMES as readonly string[]).includes(v as string)) return v as IconName;
  return undefined;
}

/** A board address: the eight lowercase hex characters of its stored id, the same bytes its tag carries
 *  ("7f3a09bc"). Anything else names no board. */
export function boardId(v: unknown): string | undefined {
  return typeof v === "string" && /^[0-9a-f]{8}$/.test(v) ? v : undefined;
}

/** Which version of a live board this is (Living Boards): a whole number 1 and up, else nothing said.
 *  Text, bools and fractions are not version numbers, leniently ignored like every model word. */
export function version(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 9999) return undefined;
  return v;
}

/** A short lowercase name one block uses to point at another (a flow's id, its nodes' ids, a steps block's `for`),
 *  or undefined. The same rule as the Python side's SLUG. "tf" → "tf";  "next-word" → "next-word";  "Big Flow" → undefined */
export function slug(v: unknown): string | undefined {
  if (typeof v === "string" && /^[a-z][a-z0-9_-]{0,23}$/.test(v)) return v;
  return undefined;
}

/** An https link, or undefined (http, javascript: and the rest are refused). */
export function https(v: unknown): string | undefined {
  if (typeof v === "string" && /^https:\/\//.test(v)) return v;
  return undefined;
}

/** The object without its undefined fields, so a read block holds only what the model gave. */
export function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** A thing a reader dropped: where it was and why. {path: "1.groups.2", why: "group has no items list"} */
export type Diagnostic = { path: string; why: string };

/** Where the reader is in the JSON ("1.groups.2") and the shared list of what it dropped. A reader that gives up
 *  writes `return here.drop("why")`, which notes the reason and returns null. */
export class Trail {
  readonly path: string;
  readonly dropped: Diagnostic[];

  constructor(path = "", dropped: Diagnostic[] = []) {
    this.path = path;
    this.dropped = dropped;
  }

  /** One step deeper: new Trail("1").at("groups").at(2).path → "1.groups.2" */
  at(step: string | number): Trail {
    const path = this.path ? `${this.path}.${step}` : String(step);
    return new Trail(path, this.dropped);
  }

  drop(why: string): null {
    this.dropped.push({ path: this.path, why });
    return null;
  }
}

/** The first `max` items of a list; when there are more, a note says how many were left out. */
export function keepFirst<T>(items: T[], max: number, here: Trail, what: string): T[] {
  if (items.length > max) here.drop(`kept the first ${max} ${what} of ${items.length}`);
  return items.slice(0, max);
}

/** Like str, but a number counts too (table cells): 4.6 → "4.6". */
export function textOrNumber(v: unknown, max = 120): string | undefined {
  if (num(v) !== null) return String(v);
  return str(v, max);
}

/** firstText, but a number counts too: firstTextOrNumber([item.value, item.rating]) with rating 4.6 → "4.6". */
export function firstTextOrNumber(values: unknown[], max = 120): string | undefined {
  for (const v of values) {
    const found = textOrNumber(v, max);
    if (found !== undefined) return found;
  }
  return undefined;
}

// A button's message is sent as the user's own, and Hermes acts on some messages before the model reads them: "/reset"
// runs a command, "!…" a shell line, and "@file:path", "@url:…" (any "@word:"), "@diff" or "@staged" pull a file, a
// page or the working tree into the message. Readers drop a button, tile or row that would send one (the Python
// checker refuses them too: blocks/common.py).
const AT_REFERENCE = /@\w[\w-]*:|@(?:diff|staged)\b/;
export const NO_SEND = "a button's message can't start with / @ or ! or carry @-references";

/**
 * Whether Hermes would act on a message itself (a command, a shell line or an @-reference) if a button sent it.
 *   "/reset" → true;  "  @file:notes.txt" → true;  "!ls" → true;  "Summarise @url:https://x.org" → true
 *   "Email name@example.com" → false;  "Meet @ 5pm" → false;  "Plan day 2" → false;  undefined → false
 */
export function actsBeforeTheModel(message: string | undefined): boolean {
  if (typeof message !== "string") return false;
  const text = message.trim();
  return /^[/@!]/.test(text) || AT_REFERENCE.test(text);
}
