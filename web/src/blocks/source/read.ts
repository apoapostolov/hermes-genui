import { type Trail } from "../../core/fields";

export type SourceKind = "web" | "file" | "tool" | "derived";
export type SourceItem = {
  label: string;
  url?: string;
  kind?: SourceKind;
  accessed?: string;
  note?: string;
};
export type SourceBlock = { type: "source"; text?: string; url?: string; title?: string; items?: SourceItem[] };

const KINDS: SourceKind[] = ["web", "file", "tool", "derived"];
const MAX_ITEMS = 32;

function short(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
}

function safeUrl(v: unknown): string | undefined {
  const s = short(v, 500);
  return s && /^https?:\/\/[^\s<>]+$/i.test(s) ? s : undefined;
}

function readItem(raw: any, here: Trail): SourceItem | null {
  const label = short(raw?.label ?? raw?.name ?? raw?.title, 80);
  if (!label) {
    here.drop("source item needs a label");
    return null;
  }
  const kind = KINDS.find((k) => k === raw?.kind);
  const accessed = short(raw?.accessed ?? raw?.accessed_at, 32)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const item: SourceItem = { label };
  const url = safeUrl(raw?.url ?? raw?.src ?? raw?.href);
  const note = short(raw?.note, 160);
  if (url) item.url = url;
  if (kind) item.kind = kind;
  if (accessed) item.accessed = accessed;
  if (note) item.note = note;
  return item;
}

/**
 * source: one small line saying where the data came from, or a structured list of sources.
 *   {type: "source", text: "screener.in", url: "https://screener.in/x"}
 *   {type: "source", title: "Sources", items: [{label: "Screener", url: "https://screener.in/x",
 *     kind: "web", accessed: "2026-11-17", note: "Quarterly results"}]}
 * `sources: [{name, url}]` still joins to one line for older boards. An item URL is kept only when it is
 * http(s); a javascript: or other scheme is dropped while its label stays. At most 32 items are drawn.
 */
export function readSource(raw: any, here: Trail): SourceBlock | null {
  const title = short(raw.title, 80);
  if (Array.isArray(raw.items)) {
    const items = raw.items.map((item: any, i: number) => readItem(item, here.at("items").at(i)));
    const kept = items.filter((item: SourceItem | null): item is SourceItem => item !== null).slice(0, MAX_ITEMS);
    if (raw.items.length > MAX_ITEMS) here.drop("source keeps 32 items");
    if (!kept.length) return here.drop("source needs a named item");
    return { type: "source", ...(title ? { title } : {}), items: kept };
  }

  const named: any[] = [];
  if (Array.isArray(raw.sources)) {
    for (const s of raw.sources) if (s && short(s.name ?? s.title ?? s.label, 80)) named.push(s);
  }
  let text = short(raw.text, 500) ?? "";
  if (!text) text = named.map((s) => short(s.name ?? s.title ?? s.label, 80)).join(" · ");
  if (!text) return here.drop("source needs text");

  const candidates = [raw.url, ...named.map((s) => s.url)];
  const url = candidates.find((u) => typeof u === "string" && /^https?:\/\/[^\s<>]+$/i.test(u.trim()));
  return { type: "source", text, ...(url ? { url: String(url).trim().slice(0, 500) } : {}), ...(title ? { title } : {}) };
}
