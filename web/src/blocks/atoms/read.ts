// The small pieces: heading, text, divider, badge, link, image and bar. They stand on their own or sit in a row,
// section or grid. (stat lives with kpis, button with actions.)
import { clean, firstText, firstWords, https, num, str, type Trail } from "../../core/fields";

export type BadgeTone = "good" | "warn";
export type HeadingBlock = { type: "heading"; text: string };
export type TextBlock = { type: "text"; text: string };
export type DividerBlock = { type: "divider" };
export type BadgeBlock = { type: "badge"; text: string; tone?: BadgeTone };
export type LinkBlock = { type: "link"; text: string; url: string };
export type ImageBlock = { type: "image"; url: string; caption?: string };
export type BarBlock = { type: "bar"; label: string; value: number | null; max: number; unit?: string };

/**
 * heading: a short title line between blocks. Text (also `title`), up to 80 characters.
 *   {type: "heading", title: "Day 1"} → {type: "heading", text: "Day 1"}
 */
export function readHeading(raw: any, here: Trail): HeadingBlock | null {
  const text = firstText([raw.text, raw.title], 80);
  if (!text) return here.drop("heading needs text");
  return { type: "heading", text };
}

/**
 * text: a short paragraph; **bold** works. Text (also `content`, `body`), up to 600 characters, cut between words.
 *   {type: "text", content: "Best before 9am"} → {type: "text", text: "Best before 9am"}
 */
export function readText(raw: any, here: Trail): TextBlock | null {
  const text = firstWords([raw.text, raw.content, raw.body], 600);
  if (!text) return here.drop("text needs text");
  return { type: "text", text };
}

export function readDivider(): DividerBlock {
  return { type: "divider" };
}

/** Badge tone words → good, warn, or no tone (a plain grey pill). "success" → "good"; "Warning" → "warn"; "blue" → undefined. */
export function badgeTone(v: unknown): BadgeTone | undefined {
  const word = typeof v === "string" ? v.toLowerCase() : "";
  if (["good", "success", "positive", "ok"].includes(word)) return "good";
  if (["warn", "warning", "bad", "negative", "danger"].includes(word)) return "warn";
  return undefined;
}

/**
 * badge: a small pill. Text (also `label`), tone good | warn (aliases in badgeTone; anything else is a plain pill).
 *   {type: "badge", label: "Sold out", tone: "warning"} → {type: "badge", text: "Sold out", tone: "warn"}
 * Dropped: no text.
 */
export function readBadge(raw: any, here: Trail): BadgeBlock | null {
  const text = firstWords([raw.text, raw.label], 40);
  if (!text) return here.drop("badge needs text");
  return clean({ type: "badge" as const, text, tone: badgeTone(raw.tone) });
}

/**
 * link: a line of linked text. url (also `href`) must be https; text (also `label`, `title`) defaults to the site's name.
 *   {type: "link", url: "https://www.irctc.co.in/nget/train-search"} → {type: "link", text: "irctc.co.in", url: "https://www.irctc.co.in/nget/train-search"}
 * Dropped: no https url.
 */
export function readLink(raw: any, here: Trail): LinkBlock | null {
  const url = https(raw.url) ?? https(raw.href);
  if (!url) return here.drop("link needs an https url");
  const text = firstText([raw.text, raw.label, raw.title], 80) ?? siteName(url);
  return { type: "link", text, url };
}

/** The host without www, as a link's fallback text: "https://www.irctc.co.in/x" → "irctc.co.in"; unparseable → the url. */
function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * image: one photo with an optional caption. url (also `src`, `image`) must be https; caption also `alt`, `title`.
 *   {type: "image", src: "https://x.example/a.jpg", alt: "Ooty lake"} → {type: "image", url: "https://x.example/a.jpg", caption: "Ooty lake"}
 * Dropped: no https url.
 */
export function readImage(raw: any, here: Trail): ImageBlock | null {
  const url = https(raw.url) ?? https(raw.src) ?? https(raw.image);
  if (!url) return here.drop("image needs an https url");
  return clean({ type: "image" as const, url, caption: firstText([raw.caption, raw.alt, raw.title], 80) });
}

/**
 * bar: one progress bar, value out of max (also `goal`, `total`; default 100, and a max that isn't above 0 is 100 too).
 * Label also `title`. A value written as null is a figure nobody knows: kept, drawn as an empty track reading "no data".
 *   {type: "bar", title: "Packed", value: 6, goal: 9} → {type: "bar", label: "Packed", value: 6, max: 9}
 *   {type: "bar", label: "Spent", value: null, max: 500} → {type: "bar", label: "Spent", value: null, max: 500}
 * Dropped: no label, or no value at all (a field left out is not the same as a written null).
 */
export function readBar(raw: any, here: Trail): BarBlock | null {
  const label = firstText([raw.label, raw.title], 40);
  if (!label) return here.drop("bar needs a label");
  const value = num(raw.value);
  if (value === null && raw.value !== null) return here.drop("bar needs a numeric value");
  let max = num(raw.max) ?? num(raw.goal) ?? num(raw.total) ?? 100;
  if (max <= 0) max = 100;
  return clean({ type: "bar" as const, label, value, max, unit: str(raw.unit, 12) });
}
