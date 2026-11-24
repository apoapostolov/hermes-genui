// A board as readable Markdown, host-side: the faithful twin of hooks/text_fallback.py and the text_<type>
// renderers it walks (blocks/*.py), down to every cap, escape, rounding and skipped block. The chat fallback and a
// board FILE must say the same words about the same blocks — so this is not an inspiration, it is a port, and
// tests/hooks/test_export_markdown_corpus.py + markdown.test.ts pin it: a corpus of boards (every type, nested
// containers, flow-referencing steps, quirk and edge fields) is serialized by the REAL Python serializer and by
// this one, and both are held against the same golden bytes.
//
// The one deliberate difference, and it is the export's whole reason: no LIMIT. The chat fits one message and cuts
// between blocks with a note; a file is not a message — an export that silently drops blocks is a different board
// than the one drawn. blocksAsMarkdown is text_fallback.blocks_as_text(blocks, limit=None).
//
// Reads RAW stored blocks (the envelope's own JSON), exactly what store.blocks_of hands the Python serializer —
// never the reader-normalized blocks — so the two sides always look at the same words.
import { evaluate, parseFormula, type Node } from "./formula";

// text_fallback.py's constants.
const MAX_DEPTH = 6;

// common.py: caps and marks.
const MAX_STRING = 300;
const MAX_URL = 500;
const MAX_CELL = 80;

// C0/C1 control characters (but newline and tab), zero-width marks and bidi overrides — the same class Python
// strips. Written as escapes so this file holds no invisible characters.
const CONTROL = new RegExp("[\\x00-\\x08\\x0b-\\x1f\\x7f-\\x9f\\u200b\\u200c\\u200e\\u200f" +
  "\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]", "g");


// blocks/layout.py
const LAYOUT_TYPES = ["row", "section", "grid", "columns", "tabs"];

/** common.is_number: a real number (never a bool — JS booleans are not "number" to begin with). */
export function isNum(v: unknown): v is number {
  return typeof v === "number";
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isList(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/** common.first_list: the first of several fields that is a list, else []. */
function firstList(block: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const k of keys) if (isList(block[k])) return block[k];
  return [];
}

/** common.first_of: the first of several fields that gives safe text. */
function firstOf(block: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const t = safeText(block[k]);
    if (t) return t;
  }
  return "";
}

/** Python's `a or b` on two block fields: the second answers when the first is falsy THE PYTHON WAY — and in
 *  Python that includes {} and []. JS would take a truthy empty object; this is what .get() or .get() means. */
function orField(block: Record<string, unknown>, first: string, second: string): unknown {
  const v = block[first];
  if (isPyFalsy(v)) return block[second];
  return v;
}

function isPyFalsy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === "" || v === 0 || (typeof v === "number" && Number.isNaN(v))) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isDict(v)) return Object.keys(v).length === 0;
  return false;
}

/** Python's `block.get(key, default)`: the default answers only when the KEY IS ABSENT — a stored null is the
 *  block's own word (and null then fails the number check downstream), not a missing one. */
function pick(block: Record<string, unknown>, key: string, dflt: unknown): unknown {
  return key in block ? block[key] : dflt;
}

/**
 * common.fmt_num — a number as people read it, to the digit and the comma:
 * 72275 → "72,275"; 18.6 → "18.6"; 7200.0 → "7,200"; 1234.5678 → "1,234.57"; 0.004567 → "0.00457".
 * Python rounds decimals half-to-even on the exact binary value; roundHalfEven reproduces that, and the corpus
 * pins it (0.125 → "0.12", 2.675 → "2.67", 7.5 → "8"). JS numbers lose integer precision past 2^53 where
 * Python ints do not — a stored board cannot carry bigger JSON numbers than that through the same parse anyway.
 */
export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return groupInt(v);
  if (Math.abs(v) >= 1) return fixed2(v);
  return g3(v);
}

/** f"{v:,.2f}" then the zero/dot strip Python does: 1234.5678 → "1,234.57"; 1000.00… → "1,000"; -0.001 → "-0". */
function fixed2(v: number): string {
  const s = roundHalfEven(v, 2).toFixed(2);
  const [intPart, fracPart] = s.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  let frac = fracPart;
  while (frac.endsWith("0")) frac = frac.slice(0, -1);
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${frac ? `.${frac}` : ""}`;
}

/** f"{v:.3g}" for |v| < 1 — three significant digits, half-to-even, trailing zeros gone, exponent form only
 *  when the decimal exponent leaves [-4, 3) (so 0.0001 stays "0.0001" but 1e-05 is "1e-05"), and the exponent
 *  carries Python's two digits. */
function g3(v: number): string {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  let e = Math.floor(Math.log10(a));
  let m = a / 10 ** e;  // [1, 10), within rounding fuzz
  if (m >= 10) { m /= 10; e += 1; } else if (m < 1) { m *= 10; e -= 1; }
  let rm = roundHalfEven(m, 2);  // three significant digits on the mantissa
  if (rm >= 10) { rm /= 10; e += 1; }
  const digits = String(rm).replace(".", "").replace(/0+$/, "") || "0";
  if (e < -4) {
    const mant = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${mant}e-${String(-e).padStart(2, "0")}`;
  }
  if (e < 0) return `${sign}0.${"0".repeat(-e - 1)}${digits}`;
  return `${sign}${digits}${"0".repeat(e)}`;
}

/** f"{v:,}" for an integer value. */
function groupInt(v: number): string {
  const sign = v < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(v)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Python's round(x, digits): half-to-even on the EXACT decimal value of the double — 2.675 is really
 *  2.67499998… so it rounds to 2.67, while 12.5 (a dyadic exact half) goes to the even 12. Multiplying by a power
 *  of ten would turn non-halves into false halves, so this examines the double's exact rational M·2^E instead:
 *  numerator and denominator (a power of two) as BigInts, remainder against half — every tie is real. */
export function roundHalfEven(x: number, digits: number): number {
  if (!Number.isFinite(x)) return x;
  if (digits < 0) {  // never asked for by the text side; keep it honest anyway
    const shifted = roundHalfEven(x / 10 ** -digits, 0);
    return shifted * 10 ** -digits;
  }
  if (Number.isInteger(x)) return x;  // already whole at 10^0, and a non-integer's scaled form keeps its exactness
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = Math.abs(x);
  const bits = new DataView(buf).getBigUint64(0, true);  // little-endian, as Float64Array wrote it
  let m = Number(bits & (2n ** 52n - 1n));
  let e = ((Number(bits >> 52n) & 0x7ff) - 1075);
  if (bits >> 52n === 0n) e = -50; else m += 2 ** 52;  // |x| = m · 2^e, exactly
  // A non-integer is always e < 0.  |x|·10^digits = m·10^digits / 2^-e, remainder against half of 2^-e.
  const num = BigInt(m) * 10n ** BigInt(digits);
  const den = 1n << BigInt(-e);
  const floor = num / den;
  const rem = num % den;
  const half = den >> 1n;
  const up = rem > half || (rem === half && floor % 2n !== 0n);
  const n = up ? floor + 1n : floor;
  const v = Number(n) / 10 ** digits;
  return x < 0 ? -v : v;
}

const MARKDOWN_MARKS = /([\\\[\]<>])/g;

/** common.md_escape */
export function mdEscape(text: string): string {
  return text.replace(MARKDOWN_MARKS, "\\$1");
}

/** common.safe_text */
export function safeText(value: unknown, limit: number = MAX_STRING, inline: boolean = true): string {
  if (isNum(value)) return fmtNum(value);
  if (!isStr(value)) return "";
  let text = value.replace(CONTROL, "").replaceAll("\t", " ");
  if (inline) text = text.replaceAll("\n", " ");
  text = text.trim();
  return mdEscape(text.length <= limit ? text : `${text.slice(0, limit - 1)}…`);
}

/** common.safe_url */
export function safeUrl(value: unknown, httpsOnly: boolean = false): string {
  if (!isStr(value)) return "";
  let url = value.replace(CONTROL, "").trim();
  if (url.length > MAX_URL) return "";
  const lower = url.toLowerCase();
  if (!(httpsOnly ? lower.startsWith("https://") : lower.startsWith("https://") || lower.startsWith("http://"))) return "";
  for (const [raw, safe] of [[" ", "%20"], ["(", "%28"], [")", "%29"], ["<", "%3C"], [">", "%3E"], ["\n", ""]] as const) {
    url = url.split(raw).join(safe);
  }
  return url;
}

/** common.md_link */
function mdLink(text: string, url: string): string {
  return url ? `[${text}](${url})` : text;
}

/** common.with_unit — a % sits tight. */
function withUnit(value: string, unit: string): string {
  if (!unit) return value;
  return unit === "%" ? `${value}${unit}` : `${value} ${unit}`;
}

/** common.change_chip */
function changeChip(change: unknown, unit: unknown = "%"): string {
  if (!isNum(change)) return "";
  const arrow = change < 0 ? "▼" : "▲";
  return `(${arrow} ${fmtNum(Math.abs(change))}${safeText(unit, 8) || "%"})`;
}

/** common.out_of — an unknown figure (#36) keeps its place and reads "no data"; the other still shows, with
 *  the unit it would have got from the goal, since it is now the only number there. */
function outOf(label: string, value: unknown, goal: unknown, unit: unknown): string {
  if (!label || !(isNum(value) || value === null || value === undefined)
    || !(isNum(goal) || goal === null || goal === undefined)) return "";
  const unitText = safeText(unit, 20);
  let shown = value === null || value === undefined ? "no data" : fmtNum(value as number);
  if (value !== null && value !== undefined && (goal === null || goal === undefined)) {
    shown = withUnit(shown, unitText);  // the goal wrote the unit; with no goal the value keeps it
  }
  const target = goal === null || goal === undefined ? "no data" : withUnit(fmtNum(goal as number), unitText);
  return `${label}: ${shown} / ${target}`;
}

/** common.cell_value — a written null shows a dash, so it is not read as an empty cell or a 0 (#36). */
function cellValue(value: unknown): string {
  return value === null ? "–" : tableCell(value);
}

/** common.table_cell */
function tableCell(value: unknown): string {
  return safeText(value, MAX_CELL).replaceAll("|", "\\|");
}

/** common.md_table — every row padded to the header's width. */
function mdTable(header: string[], rows: string[][]): string[] {
  const width = header.length;
  const lines = ["| " + header.join(" | ") + " |", "| " + Array(width).fill("---").join(" | ") + " |"];
  for (const row of rows) {
    lines.push("| " + [...row, ...Array(Math.max(0, width - row.length)).fill("")].slice(0, width).join(" | ") + " |");
  }
  return lines;
}

// --- the tree walk (text_fallback._flow_labels / _pieces / _fit) ----------------------------------------------

/** check.child_lists, on raw dicts: a container's children, or each tab's children. */
function childLists(block: unknown): unknown[][] {
  if (!isDict(block)) return [];
  if (isList(block.children)) return [block.children];
  if (block.type !== "tabs" || !isList(block.tabs)) return [];
  const out: unknown[][] = [];
  for (const tab of block.tabs) {
    if (isDict(tab) && isList(tab.children)) out.push(tab.children);
  }
  return out;
}

/** text_fallback._flow_labels: each flow's node labels by flow id, from anywhere (containers and tabs too). */
function flowLabels(blocks: unknown[], depth: number = 0): Record<string, Record<string, string>> {
  let found: Record<string, Record<string, string>> = {};
  if (depth > MAX_DEPTH) return found;
  for (const block of blocks) {
    if (!isDict(block)) continue;
    if (block.type === "flow" && isStr(block.id) && isList(block.nodes)) {
      const nodes = block.nodes.filter(isDict);
      const map: Record<string, string> = {};
      for (const n of nodes) if (isStr(n.id) && isStr(n.label)) map[n.id] = n.label;
      found[block.id] = map;
    }
    for (const children of childLists(block)) {
      const deeper = flowLabels(children, depth + 1);
      found = { ...deeper, ...found };  // the same precedence the Python walk gives: what is nearer wins
    }
  }
  return found;
}

// --- one block as text (text_fallback._render and every text_<type>) ------------------------------------------

type Labels = Record<string, Record<string, string>>;

const F = (v: unknown): Record<string, unknown> => (isDict(v) ? v : {});

// atoms.py: heading and text need text; image fields, in the drawing's own order.
const IMAGE_URL_FIELDS = ["url", "src", "image"];

function textHeading(block: Record<string, unknown>): string {
  const text = safeText(block.text);
  return text ? `**${text}**` : "";
}

function textText(block: Record<string, unknown>): string {
  return safeText(block.text, MAX_STRING, false);
}

function textDivider(): string {
  return "---";
}

function textBadge(block: Record<string, unknown>): string {
  const text = firstOf(block, "text", "label");
  return text ? `[${text}]` : "";
}

function textLink(block: Record<string, unknown>): string {
  const text = firstOf(block, "text", "label");
  const url = safeUrl(orField(block, "url", "href"), true);
  return mdLink(text || mdEscape(url), url);
}

function textImage(block: Record<string, unknown>): string {
  let url = "";
  for (const k of IMAGE_URL_FIELDS) {
    url = safeUrl(block[k]);
    if (url) break;
  }
  const caption = firstOf(block, "caption", "alt", "title");
  if (!url) return caption;
  return `![${caption || "image"}](${url})`;
}

function textBar(block: Record<string, unknown>): string {
  return outOf(firstOf(block, "label", "title"), block.value, pick(block, "max", 100), block.unit);
}

// callout.py
function textCallout(block: Record<string, unknown>): string {
  const title = safeText(block.title);
  const text = safeText(block.text, MAX_STRING, false);
  const lines = (title ? [`**${title}**`] : []).concat(text.split("\n").filter((l) => l.trim()));
  return lines.map((l) => `> ${l}`).join("\n");
}

// source.py — one line saying where the data came from, or a LIST of them with kind, date and note (#38).
const SOURCE_KINDS = ["web", "file", "tool", "derived"];

/** source._item_line: [label](url) + [kind] + " · accessed YYYY-MM-DD" + " · note". The accessed match is
 *  a Python re.match — anchored at the START of the safe word, a date and whatever follows it counts. */
function sourceItemLine(item: Record<string, unknown>): string {
  const label = safeText(item.label, 80);
  const url = safeUrl(item.url);
  let line = url ? mdLink(label, url) : label;
  const kind = safeText(item.kind, 12);
  if (SOURCE_KINDS.includes(kind)) line += ` [${kind}]`;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(safeText(item.accessed, 32));
  if (m) line += ` · accessed ${m[1]}`;
  const note = safeText(item.note, 160);
  if (note) line += ` · ${note}`;
  return line;
}

/** source.kept_items: the list entries that carry a label; nothing kept means no list at all. */
function keptSourceItems(block: Record<string, unknown>): Record<string, unknown>[] {
  const items = isList(block.items) ? block.items : [];
  return items.slice(0, 32).filter((it): it is Record<string, unknown> => isDict(it) && safeText(it.label, 80) !== "");
}

function textSource(block: Record<string, unknown>): string {
  const items = keptSourceItems(block);
  if (items.length) {
    const title = safeText(block.title, 80);
    const prefix = title ? `**${title}**\n` : "";
    return `${prefix}_Sources: ${items.map(sourceItemLine).join(" · ")}_`;
  }
  const text = safeText(block.text);
  return text ? `_Source: ${mdLink(text, safeUrl(block.url))}_` : "";
}

// table.py — the legacy grid kept verbatim, #41's structured table read back into the same grid, and the
// aggregate footer lines the board itself wrote.
const MAX_TABLE_ROWS = 12;

/** table.is_structured: a dict column, an explicit filter/page/aggregates word — the reader's own test. */
function isStructuredTable(block: Record<string, unknown>): boolean {
  const columns = block.columns;
  return (isList(columns) && columns.some(isDict)) || block.filterable === true
    || Object.hasOwn(block, "page") || isList(block.aggregates);
}

/** What Python's `for x in (v or [])` iterates over: a list as written, a string character-wise, a dict by its
 *  keys; a number or null raises there, so it raises here too — and the safely-renderer drops the block, as chat does. */
function iterated(v: unknown): unknown[] {
  const w = v === undefined ? [] : v;
  if (!w) return [];
  if (isList(w)) return w;
  if (isStr(w)) return [...w];
  if (isDict(w)) return Object.keys(w);
  throw new Error("iterated");
}

/** table.structured_cell: a number-family cell travels as its stored value in the column's own words; a
 *  sources column is the row's labels, comma-joined; anything else is the word it shows. */
function structuredCell(row: Record<string, unknown>, column: Record<string, unknown>): string {
  const cid = safeText(column.id, 40);
  if (column.kind === "sources") {
    const sources = iterated(row.sources);   // Python walks `row.get("sources") or []` — strings char-wise
    const labels = sources
      .map((s) => (isDict(s) ? safeText(s.label, 40) : isStr(s) ? safeText(s, 40) : ""))
      .filter(Boolean);
    return labels.join(", ");
  }
  const cellsRaw = row.cells || {};
  if (!isDict(cellsRaw)) throw new Error("cells");      // .get on a non-dict raises over there as well
  const cell = cellsRaw[cid];
  if (!isDict(cell)) return "";
  const value = cell.value;
  if (column.kind === "currency" && isNum(value)) return `${safeText(column.unit, 12)}${fmtNum(value)}`.trim();
  if (column.kind === "percent" && isNum(value)) return `${fmtNum(value)}%`;
  if (isNum(value)) return fmtNum(value);
  return tableCell(cell.text);
}

function textStructured(block: Record<string, unknown>): string {
  const columns = (isList(block.columns) ? block.columns : []).filter(isDict) as Record<string, unknown>[];
  const rows = (isList(block.rows) ? block.rows : []).filter(isDict) as Record<string, unknown>[];
  if (!columns.length || !rows.length) return "";
  const names = columns.map((c) => tableCell(c.label || c.id));
  const cells = rows.slice(0, MAX_TABLE_ROWS).map((row) => columns.map((column) => structuredCell(row, column)));
  const caption = safeText(block.caption || block.title);
  const lines = (caption ? [`**${caption}**`] : []).concat(mdTable(names, cells));
  if (rows.length > MAX_TABLE_ROWS) lines.push(`_(${rows.length - MAX_TABLE_ROWS} more rows)_`);
  for (const aggregate of isList(block.aggregates) ? block.aggregates : []) {
    if (!isDict(aggregate)) continue;
    const cid = safeText(aggregate.column, 40);
    const values: number[] = [];
    for (const r of rows) {
      const cellsRaw = r.cells;
      if (cellsRaw && !isDict(cellsRaw)) throw new Error("cells");  // .get on it raises over there too
      const cell = isDict(cellsRaw) ? cellsRaw[cid] : undefined;
      if (isDict(cell) && isNum(cell.value)) values.push(cell.value as number);
    }
    if (!values.length) continue;
    const op = aggregate.op;
    let value: number | undefined;
    if (op === "sum") value = values.reduce((s, v) => s + v, 0);
    else if (op === "avg") value = values.reduce((s, v) => s + v, 0) / values.length;
    else if (op === "min") value = Math.min(...values);
    else if (op === "max") value = Math.max(...values);
    else if (op === "count") value = values.length;
    if (value !== undefined) {
      const label = safeText(aggregate.label, 20) || String(op);
      lines.push(`_${label}: ${fmtNum(value)}_`);
    }
  }
  return lines.join("\n");
}

function textTable(block: Record<string, unknown>): string {
  if (isStructuredTable(block)) return textStructured(block);
  const names = block.columns, rows = block.rows;
  if (!isList(names) || !names.length || !isList(rows) || !rows.length) return "";
  const headerNames = names.slice(0, 8);
  const columns = headerNames.map(tableCell);
  const cells: string[][] = [];
  for (const row of rows.slice(0, MAX_TABLE_ROWS)) {
    if (isDict(row)) {
      cells.push(headerNames.map((name) => (isStr(name) && Object.hasOwn(row, name) ? cellValue((row as Record<string, unknown>)[name]) : "")));
    } else if (isList(row)) {
      cells.push(row.map(cellValue));
    }
  }
  const caption = safeText(block.caption || block.title);
  const lines = (caption ? [`**${caption}**`] : []).concat(mdTable(columns, cells));
  if (rows.length > MAX_TABLE_ROWS) lines.push(`_(${rows.length - MAX_TABLE_ROWS} more rows)_`);
  return lines.join("\n");
}

// list.py — a row's own value is the row's text; the bar only stands in for it when the row has none; a value
// written as null is unknown and reads "–" (#36).
const VALUE_FIELDS = ["value", "price", "rating", "score", "meta", "badge"];

function valueOf(row: Record<string, unknown>): string {
  for (const field of VALUE_FIELDS) {
    if (!Object.hasOwn(row, field)) continue;
    if (row[field] === null) return "–";
    const v = safeText(row[field], 40);
    if (v) return v;
  }
  return "";
}

function textListBlock(block: Record<string, unknown>): string {
  const items = firstList(block, "items", "rows");
  const lines: string[] = [];
  for (const item of items.slice(0, 12)) {
    const row = isStr(item) ? { title: item } : item;
    const name = isDict(row) ? firstOf(row, "title", "name", "label", "text") : "";
    if (!name) continue;
    const r = F(row);
    const subtitle = safeText(r.subtitle);
    let value = valueOf(r);
    const bar = r.bar;
    if (!value && isNum(bar) && (bar as number) >= 0) value = fmtNum(bar as number);
    const mark = block.ranked ? `${lines.length + 1}.` : "-";
    lines.push(`${mark} ${name}${subtitle ? ` — ${subtitle}` : ""}${value ? ` · ${value}` : ""}`);
  }
  const title = safeText(block.title);
  return (title && lines.length ? [`**${title}**`] : []).concat(lines).join("\n");
}

// checklist.py — item states, owners, notes and source ids (#32/#40).
const STATE_ALIASES: Record<string, string> = {
  pending: "pending", todo: "pending", "to do": "pending",
  active: "active", "in progress": "active", doing: "active",
  done: "done", complete: "done", completed: "done",
  blocked: "blocked", skipped: "skipped",
};
const STATE_WORDS: Record<string, string> = { pending: "not started", active: "in progress", blocked: "blocked", skipped: "skipped" };

/** checklist.read_state — the state a model wrote, as one of the five words. */
function readState(v: unknown): string {
  if (!isStr(v)) return "";
  return STATE_ALIASES[v.trim().toLowerCase()] ?? "";
}

function checklistItemLine(item: unknown): string {
  let text: string, state: string, owner: string, note: string, done: boolean, sources: string;
  if (isDict(item)) {
    text = safeText(item.text);
    state = readState(item.state);
    owner = safeText(item.owner).slice(0, 40);   // Python: safe_text(...)[40]
    note = safeText(item.note).slice(0, 120);
    done = item.done === true || item.checked === true || state === "done";
    const rawIds = isList(item.sourceIds) ? item.sourceIds : [];
    const ids = rawIds.slice(0, 4).filter(isStr).map((i) => safeText(i).slice(0, 40)).slice(0, 4);
    sources = ids.length ? `sources ${ids.join(", ")}` : "";
  } else {
    text = safeText(item); state = ""; owner = ""; note = ""; done = false; sources = "";
  }
  if (!text) return "";
  // A tick hides the state on the card, so the plain text hides it too.
  const asideParts = [done ? "" : (STATE_WORDS[state] ?? ""), owner, sources].filter(Boolean);
  let aside = asideParts.join(", ");
  if (note) aside = aside ? `${aside}: ${note}` : note;
  return `- [${done ? "x" : " "}] ${text}` + (aside ? ` (${aside})` : "");
}

function textChecklist(block: Record<string, unknown>): string {
  const items = isList(block.items) ? block.items : [];
  const lines = items.slice(0, 40).map(checklistItemLine).filter(Boolean);
  const title = safeText(block.title);
  return (title && lines.length ? [`**${title}**`] : []).concat(lines).join("\n");
}

// tiles.py
function textTiles(block: Record<string, unknown>): string {
  const items = isList(block.items) ? block.items : [];
  const lines: string[] = [];
  for (const item of items.slice(0, 8)) {
    const t = isDict(item) ? safeText(item.title) : "";
    const subtitle = t ? safeText(F(item).subtitle) : "";
    if (t) lines.push(subtitle ? `- ${t}: ${subtitle}` : `- ${t}`);
  }
  return lines.join("\n");
}

// streak.py
function textStreak(block: Record<string, unknown>): string {
  const count = block.count;
  if (!isNum(count)) return "";
  const label = safeText(block.label) || "Current streak";
  return `${label}: ${fmtNum(count)} ${safeText(block.unit, 20) || "days"}`;
}

// progress.py
// progress.py — shapes, thresholds, segments (#33): the amount, the percent when asked, the tone of the band
// the value falls in, the marks and the parts.
const TONE_ALIASES: Record<string, string> = {
  good: "good", success: "good", positive: "good", ok: "good",
  warn: "warn", warning: "warn", caution: "warn",
  bad: "bad", danger: "bad", negative: "bad", error: "bad",
};
const MAX_THRESHOLDS = 6;
const MAX_SEGMENTS = 5;
const PROGRESS_LABEL = 28;

function toneOf(v: unknown): string {
  return isStr(v) ? (TONE_ALIASES[v.trim().toLowerCase()] ?? "") : "";
}

/** progress.marks: the toned ticks sorted by where they sit, at most six. */
function progressMarks(block: Record<string, unknown>): Record<string, unknown>[] {
  const thresholds = isList(block.thresholds) ? block.thresholds : [];
  const found = thresholds.filter((m) => isDict(m) && isNum(m.at)) as Record<string, unknown>[];
  return found.slice().sort((a, b) => (a.at as number) - (b.at as number)).slice(0, MAX_THRESHOLDS);
}

/** progress.bands: the ranges between toned marks, each held at the goal; block["goal"] is a SUBSCRIPT over
 *  there — a stored progress without a goal key raises and the whole block is skipped, here exactly too. */
function bands(block: Record<string, unknown>): [number, number, string][] {
  if (!Object.hasOwn(block, "goal")) throw new Error("goal");
  const goal = block.goal;
  if (goal === null || goal === undefined) return [];
  const found: [number, number, string][] = [];
  let start = 0.0;
  for (const mark of progressMarks(block)) {
    const tone = toneOf(mark.tone);
    if (!tone) continue;
    const end = Math.max(start, Math.min(mark.at as number, goal as number));
    if (end > start) found.push([start, end, tone]);
    start = end;
  }
  return found;
}

function zoneTone(block: Record<string, unknown>): string {
  const fallback = toneOf(block.tone) || "good";
  const value = block.value;
  if (value === null || value === undefined) return fallback;  // an unknown reading colours no band
  const found = bands(block);
  if (!found.length) return fallback;
  for (const [, to, tone] of found) {
    if (!isNum(value)) throw new Error("value");              // str <= float raises over there too
    if ((value as number) <= to) return tone;
  }
  return found[found.length - 1][2];
}

/** progress.percent_of: the share reached as a whole percent, held between 0 and 100. */
function percentOf(value: number, goal: unknown): number {
  if (!isNum(goal) || (goal as number) <= 0) return 0;
  return Math.trunc(Math.max(0, Math.min(1, value / (goal as number))) * 100 + 0.5);
}

/** progress._label_text: a mark's or a part's label; a number is written in the block's unit. */
function labelText(label: unknown, unit: unknown): string {
  if (isNum(label)) return withUnit(fmtNum(label), safeText(unit, 20));
  return safeText(label, PROGRESS_LABEL);
}

function textProgress(block: Record<string, unknown>): string {
  const base = outOf(firstOf(block, "title", "label"), block.value, block.goal, block.unit);
  if (!base) return "";
  const unit = block.unit;
  let line = base;
  if (block.show_percent === true && block.value !== null && block.value !== undefined && safeText(unit, 20) !== "%") {
    if (!isNum(block.value)) throw new Error("value");        // the division raises over there, and here
    line += ` (${percentOf(block.value as number, block.goal)}%)`;
  }
  const tone = zoneTone(block);
  if (tone !== "good") line += ` (${tone})`;
  const sentences: string[] = [];
  const labelled = progressMarks(block).map((m) => labelText(m.label, unit)).filter(Boolean);
  if (labelled.length) sentences.push("Marks: " + labelled.join(", "));
  const parts: string[] = [];
  for (const segment of (isList(block.segments) ? block.segments : []).slice(0, MAX_SEGMENTS)) {
    if (!isDict(segment) || !isNum(segment.value) || (segment.value as number) < 0) continue;
    const amount = withUnit(fmtNum(segment.value as number), safeText(unit, 20));
    const label = safeText(segment.label, PROGRESS_LABEL);
    parts.push(label ? `${label} ${amount}` : amount);
  }
  if (parts.length) sentences.push(parts.join(", "));
  if (!sentences.length) return line;
  return [line, ...sentences].join(". ") + ".";
}

// kpis.py — the card's chip, ported exactly: written numbers, the previous-derived change (#31), the units
// the card writes, and the tenths the card prints. _figure serves stat and kpis alike.
const CHANGE_UNITS = ["%", "pt"];
const MAX_CHIP = 1e15;

/** kpis._is_finite — a number the drawing side reads as one: not NaN, not infinite, not a bool. */
function isFiniteNumber(v: unknown): boolean {
  return isNum(v) && Math.abs(v as number) <= Number.MAX_VALUE;
}

/** kpis._written_unit — only "%" and "pt" are change units; anything else falls to the kind's default. */
function writtenUnit(item: Record<string, unknown>, fallback: string): string {
  const unit = item.change_unit;
  return isStr(unit) && CHANGE_UNITS.includes(unit) ? unit : fallback;
}

function chipNumber(v: unknown, unit: string): [number, string] | null {
  return isFiniteNumber(v) && Math.abs(v as number) < MAX_CHIP ? [v as number, unit] : null;
}

/** kpis._change — previous wins over a written change; a "%" figure counts POINTS from a previous, everything
 *  else a share of the previous; a written change keeps its own meaning. None when there is no chip. */
function changeOf(item: Record<string, unknown>): [number, string] | null {
  if (Object.hasOwn(item, "previous")) {
    const unit = writtenUnit(item, item.unit === "%" ? "pt" : "%");
    const before = item.previous, value = item.value;
    if (!(isFiniteNumber(before) && isFiniteNumber(value))) return null;
    if (unit === "pt") return chipNumber((value as number) - (before as number), "pt");
    return chipNumber(before === 0 ? null : (((value as number) - (before as number)) / Math.abs(before as number)) * 100, "%");
  }
  return chipNumber(item.change, writtenUnit(item, "%"));
}

/** kpis._tenths — one decimal, rounded half away from zero, exactly as the card's own toFixed prints it. */
function tenths(v: number): string {
  return Math.abs(v).toFixed(1);
}

function chip(item: Record<string, unknown>): string {
  const found = changeOf(item);
  if (found === null) return "";
  const [change, unit] = found;
  const arrow = change < 0 ? "▼ " : change > 0 ? "▲ " : "";
  return `(${arrow}${tenths(change)}${unit === "pt" ? " " : ""}${unit})`;
}

function figure(item: Record<string, unknown>): string {
  const label = firstOf(item, "label", "title");
  if (!label) return "";
  const raw = item.value;
  const shown = raw === null || raw === undefined ? "" : safeText(raw);
  const value = shown ? withUnit(shown, safeText(item.unit, 20)) : "no data";
  const line = `${label}: ${value}`;
  const c = chip(item);
  return c ? `${line} ${c}` : line;
}

function textStat(block: Record<string, unknown>): string {
  return figure(block);
}

function textKpis(block: Record<string, unknown>): string {
  const items = isList(block.items) ? block.items : [];
  return items.filter(isDict).map(figure).filter(Boolean).join("\n");
}

// chart.py — kinds, the series line with its gap words (#36), the scatter's ranges and highest point, the
// waterfall's bridge (#34), the sorted-descending bar read (#29), and the written caveat line.
const CHART_KINDS = ["line", "bar", "area", "stacked", "hbar", "combo", "pie", "donut", "scatter", "waterfall"];
const KIND_ALIASES: Record<string, string> = {
  doughnut: "donut", stackedbar: "stacked", horizontalbar: "hbar", barh: "hbar",
};
const MAX_LABEL = 40;   // a point's name, as the web reader keeps it

/** chart.chart_kind — the same lenient word the drawing side reads. */
export function chartKind(name: unknown): string {
  if (!isStr(name)) return "line";
  const plain = name.toLowerCase().replace(/[ _-]/g, "");
  return CHART_KINDS.includes(plain) ? plain : (Object.hasOwn(KIND_ALIASES, plain) ? KIND_ALIASES[plain] : "line");
}

/** chart._series_line: first value to last, then how many slots hold no value and up to three of their labels. */
function seriesLine(series: Record<string, unknown>, labels: unknown[]): string {
  const raw = dataOf(series);
  const data = raw.filter(isNum);
  if (!data.length) return "";
  const name = safeText(series.name);
  const first = data[0] as number, last = data[data.length - 1] as number;
  let line = `${name} ${fmtNum(first)} → ${fmtNum(last)}`.trim();
  if (first) line += " " + changeChip(roundHalfEven(((last - first) / Math.abs(first)) * 100, 1));
  const n = Math.min(labels.length, raw.length);   // zip(strict=False): pairs stop with the shorter side
  const missing: string[] = [];
  for (let i = 0; i < n; i++) if (raw[i] === null) missing.push(safeText(labels[i], 24));
  if (missing.length) {
    const shown = missing.filter(Boolean).slice(0, 3);
    let named = shown.length ? shown.join(", ") : "unlabelled";
    if (missing.length > shown.length) named += ` and ${missing.length - shown.length} more`;
    line += `, ${missing.length} gap${missing.length === 1 ? "" : "s"} (${named})`;
  }
  return line;
}

function slices(x: unknown[], series: Record<string, unknown>, top = 4): string {
  const data = dataOf(series);
  const parts: [string, number][] = [];
  for (let i = 0; i < Math.min(x.length, data.length); i++) {
    const v = data[i];
    if (isNum(v) && v > 0) parts.push([safeText(x[i]), v as number]);
  }
  const total = parts.reduce((s, [, v]) => s + v, 0);
  if (!total) return "";
  parts.sort((a, b) => b[1] - a[1]);  // JS sort is stable since ES2019, as Python's is
  const shown = parts.slice(0, top).map(([label, v]) => `${label} ${roundHalfEven((v / total) * 100, 0)}`.trim() + "%");
  if (parts.length > top) shown.push(`+${parts.length - top} more`);
  return shown.join(", ");
}

/** chart._drawn_points: a scatter series' points with a number on BOTH scales, in the order written. */
function drawnPoints(series: Record<string, unknown>): Record<string, unknown>[] {
  return iterated(Object.hasOwn(series, "points") ? series.points : []).filter(
    (p): p is Record<string, unknown> => isDict(p) && isNum(p.x) && isNum(p.y),
  );
}

// The words a scatter title uses to name its axes: everything before "against", "by" or "vs".
const AGAINST = /^(.+?)\s+(?:against|by|vs\.?)\s+(.+)$/i;

function axisWord(text: string): string {
  return text.trim().toLowerCase().replace(/[\s:,.?!]+$/, "");
}

function axisNames(title: string): [string, string] {
  const match = AGAINST.exec(title.trim());
  if (match === null) return ["x", "y"];
  const across = axisWord(match[2]), up = axisWord(match[1]);
  return across && up ? [across, up] : ["x", "y"];
}

function pointCount(n: number): string {
  return n === 1 ? "1 point" : `${n} points`;
}

/** chart._scatter_line: what it plots, then the highest point; several groups give each one's range. */
function scatterLine(series: Record<string, unknown>[], title: string): string {
  const [across, up] = axisNames(title);
  let groups = series.slice(0, 2).map((s) => [safeText(s.name, MAX_LABEL), drawnPoints(s)] as const);
  groups = groups.filter(([, points]) => points.length > 0);
  if (!groups.length) return "";
  if (groups.length > 1) {
    return groups.map(([name, points]) => {
      const xs = points.map((p) => p.x as number);
      return `${name || "Series"} ${pointCount(points.length)}, ${across} ${fmtNum(Math.min(...xs))} to ${fmtNum(Math.max(...xs))}`;
    }).join("; ");
  }
  const points = groups[0][1];
  const xs = points.map((p) => p.x as number), ys = points.map((p) => p.y as number);
  let top = points[0];
  for (const p of points) {  // max by (y, -x): highest y, ties go to the smaller x
    if ((p.y as number) > (top.y as number)
      || ((p.y as number) === (top.y as number) && -(p.x as number) > -(top.x as number))) top = p;
  }
  const line = `${pointCount(points.length)}; ${across} ${fmtNum(Math.min(...xs))} to ${fmtNum(Math.max(...xs))}, `
    + `${up} ${fmtNum(Math.min(...ys))} to ${fmtNum(Math.max(...ys))}; highest ${fmtNum(top.y as number)} at ${fmtNum(top.x as number)}`;
  const label = safeText(top.label, MAX_LABEL);
  return label ? `${line} (${label})` : line;
}

/** chart._signed: a step with its sign — 3200 → "+3,200"; -1450 → "-1,450"; 0 → "0". */
function signedValue(value: number): string {
  return value > 0 ? `+${fmtNum(value)}` : fmtNum(value);
}

/** chart._waterfall_line: a bridge as its points in order — each step signed, each total a balance, an
 *  unknown step named and everything after it "not stated". */
function waterfallLine(series: Record<string, unknown>): string {
  const points = iterated(Object.hasOwn(series, "points") ? series.points : []).filter(isDict) as Record<string, unknown>[];
  let balance = 0;
  let moved = false;   // whether a step has moved the balance yet
  let broken = false;
  const parts: string[] = [];
  for (const p of points) {
    const label = safeText(p.label, MAX_LABEL);
    const total = p.total === true;
    if (broken) {
      if (total) parts.push(label ? `${label} not stated` : "closing not stated");
      continue;
    }
    if (total) {
      const opening = p.value;
      if (!moved && isNum(opening)) balance = opening as number;
      parts.push(`${label} ${fmtNum(balance)}`.trim());
      continue;
    }
    const value = p.value;
    if (!isNum(value)) {
      parts.push(label ? `${label}, unknown` : "unknown");
      broken = true;
      continue;
    }
    balance += value as number;
    moved = true;
    parts.push(`${signedValue(value as number)} ${label}`.trim());
  }
  return parts.filter(Boolean).join(" → ");
}

function textChart(block: Record<string, unknown>): string {
  let series = (isList(block.series) ? block.series : []).filter(isDict) as Record<string, unknown>[];
  let x = iterated(block.x);                       // list(block.get("x") or []): a stored number raises there
  if (block.sortDesc === true && ["bar", "hbar"].includes(chartKind(block.kind)) && series.length) {
    const values = dataOf(series[0]).map((v) => (isNum(v) ? v : null));
    const order = x.map((_, i) => i).sort((a, b) => {
      const ka = [values[a] === null ? 1 : 0, -(values[a] as number ?? 0), a] as const;
      const kb = [values[b] === null ? 1 : 0, -(values[b] as number ?? 0), b] as const;
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    });
    x = order.map((i) => x[i]);
    series = series.map((s) => {
      const d = dataOf(s);
      return { ...s, data: order.map((i) => (i < d.length ? d[i] : null)) };
    });
  }
  if (!series.length) return "";
  const kind = chartKind(block.kind);
  const title = safeText(block.title, 80);
  let body = "";
  if (kind === "pie" || kind === "donut") {
    body = slices(x, series[0]);
  } else if (kind === "scatter") {
    body = scatterLine(series, title);
  } else if (kind === "waterfall") {
    body = waterfallLine(series[0]);
  } else {
    body = series.slice(0, 6).map((s) => seriesLine(s, iterated(block.x))).filter(Boolean).join("; ");
  }
  if (!body) return "";
  const unit = safeText(block.unit, 20);
  const head = `**${title || "Chart"}**` + (unit ? ` (${unit})` : "");
  const line = `${head}: ${body}`;
  const caveat = safeText(block.caveat, 120);
  return caveat ? `${line}\n_${caveat}_` : line;
}

// images.py — the photo lines carry what the drawing side carries; a local URL is not web-safe, so safe_url
// drops it and the caption stands as the line (#20).

/** Python's `series.get("data", [])` where the list is then walked: a stored null/number/bool is a TypeError over
 *  there — the whole block is skipped by _render_safely — so it is thrown here too, never quietly ignored. */
function dataOf(series: Record<string, unknown>): unknown[] {
  return walkable(series, "data", true);
}

/** A field walked as a sequence. Python raises TypeError on a stored null/number/bool — and _render_safely drops
 *  the whole block there — so this throws the same way; strings and dicts walk their characters and keys, as they
 *  do over there; a missing field gives the default. */
function walkable(block: Record<string, unknown>, key: string, missingDefault = false): unknown[] {
  const v = missingDefault ? pick(block, key, []) : block[key];
  if (v === undefined && missingDefault) return [];
  if (isList(v)) return v;
  if (isStr(v)) return [...v];
  if (isDict(v)) return Object.keys(v);
  if (v === undefined && !missingDefault) return [];
  throw new Error(key);
}

function textImages(block: Record<string, unknown>): string {
  const photos = isList(block.images) ? block.images : [];
  const lines: string[] = [];
  for (const photo of photos.slice(0, 12)) {
    if (!isDict(photo)) continue;
    const line = textImage(photo);
    const source = safeText(photo.source);
    if (line) lines.push(source ? `${line} [${source}]` : line);
  }
  const title = safeText(block.title);
  return (title && lines.length ? [`**${title}**`] : []).concat(lines).join("\n");
}

// include.py: show_blocks swapped it for its board long before storing — a stored one has no text.
function textInclude(): string {
  return "";
}

// flip.py
function textFlip(block: Record<string, unknown>): string {
  const cards = isList(block.cards) ? block.cards : [];
  const lines: string[] = [];
  for (const card of cards.slice(0, 12)) {
    if (!isDict(card)) continue;
    const front = firstOf(card, "front", "question");
    const back = firstOf(card, "back", "answer");
    if (front && back) lines.push(`- Q: ${front} — A: ${back}`);
  }
  const title = safeText(block.title);
  return (title && lines.length ? [`**${title}**`] : []).concat(lines).join("\n");
}

// actions.py
function nextSteps(labels: string[]): string {
  const kept = labels.filter(Boolean);
  return kept.length ? "Next: " + kept.join(" · ") : "";
}

function textButton(block: Record<string, unknown>): string {
  const label = safeText(block.label);
  return nextSteps([label ? mdLink(label, safeUrl(block.url, true)) : ""]);
}

function textActions(block: Record<string, unknown>): string {
  const items = isList(block.items) ? block.items : [];
  return nextSteps(items.filter(isDict).map((it) => safeText(F(it).label)));
}

// layers.py
const LAYERS_MAX = 12;
const L_TITLE = 80, L_CAPTION = 200, L_LABEL = 24, L_NOTE = 280;

function textLayers(block: Record<string, unknown>): string {
  const layers = firstList(block, "layers").slice(0, LAYERS_MAX).filter((x) => isDict(x) && safeText(x.label));
  const lines: string[] = [];
  layers.forEach((layer, i) => {
    const l = F(layer);
    const label = safeText(l.label, L_LABEL);
    const note = safeText(l.note, L_NOTE);
    lines.push(note ? `${i + 1}. ${label} — ${note}` : `${i + 1}. ${label}`);
  });
  if (!lines.length) return "";
  const title = safeText(block.title, L_TITLE);
  const caption = safeText(block.caption, L_CAPTION);
  return (title ? [`**${title}**`] : []).concat(caption ? [caption] : []).concat(lines).join("\n");
}

// timeline.py
function stopsOf(block: Record<string, unknown>): unknown[] {
  if (isList(block.groups)) return block.groups;
  const flat = firstList(block, "items", "events", "stops", "steps");
  return [{ items: flat }];
}

function textTimeline(block: Record<string, unknown>): string {
  const title = safeText(block.title);
  const lines: string[] = title ? [`**${title}**`] : [];
  for (const group of stopsOf(block).slice(0, 14)) {
    if (!isDict(group) || !isList(group.items)) continue;
    const label = safeText(group.label);
    const stops: string[] = [];
    for (const item of (group.items as unknown[]).slice(0, 12)) {
      const name = isDict(item) ? safeText(item.title) : "";
      if (!name) continue;
      const it = F(item);
      const time = safeText(it.time, 40);
      const place = safeText(it.place);
      stops.push("- " + (time ? `${time} · ` : "") + name + (place ? ` (${place})` : ""));
    }
    if (stops.length) {
      if (label) lines.push(`**${label}**`);
      lines.push(...stops);
    }
  }
  return lines.length > (title ? 1 : 0) ? lines.join("\n") : "";
}

// heatmap.py
function textHeatmap(block: Record<string, unknown>): string {
  const rows = block.rows, cols = block.cols, values = block.values;
  if (!isList(rows) || !rows.length || !isList(cols) || !cols.length || !isList(values) || !values.length) return "";
  const columns = cols.slice(0, 12);
  const body: string[][] = [];
  rows.slice(0, 12).forEach((label, i) => {
    const line = isList(values[i]) ? (values[i] as unknown[]).slice(0, columns.length) : [];
    body.push([tableCell(label), ...line.map(heatCell)]);   // #36: a cell that is not a number reads "–"
  });
  const title = safeText(block.title);
  const unit = safeText(block.unit, 20);
  const head = title || unit ? `**${title || "Heatmap"}**` + (unit ? ` (${unit})` : "") : "";
  return (head ? [head] : []).concat(mdTable(["", ...columns.map(tableCell)], body)).join("\n");
}

// flow.py
const FL_TITLE = 80, FL_LABEL = 40, FL_NOTE = 280, FL_GROUP = 40;
const FL_MAX_NODES = 10, FL_MAX_GROUPS = 3, FL_MIN_COUNT = 2, FL_MAX_COUNT = 100;
const CHIP = 16, MAX_CHIPS = 10;

function chipsText(chips: unknown): string {
  if (!isList(chips)) return "";
  return chips.slice(0, MAX_CHIPS)
    .map((c) => safeText(isDict(c) ? c.text : c, CHIP))
    .filter(Boolean).join(", ");
}

function isCount(value: unknown, low: number, high: number): boolean {
  return isNum(value) && Number.isInteger(value) && value >= low && value <= high;
}

function textFlow(block: Record<string, unknown>): string {
  const nodes = firstList(block, "nodes").slice(0, FL_MAX_NODES)
    .filter((n) => isDict(n) && safeText(n.label));
  const lines: string[] = [];
  nodes.forEach((node, i) => {
    const n = F(node);
    const label = safeText(n.label, FL_LABEL);
    const note = safeText(n.note, FL_NOTE);
    const holds = chipsText(n.holds);
    let line = note ? `${i + 1}. ${label} — ${note}` : `${i + 1}. ${label}`;
    if (holds) line = `${line} (holds: ${holds})`;
    lines.push(line);
  });
  if (!lines.length) return "";
  const numbers = new Map<string, number>();
  nodes.forEach((node, i) => {
    const id = F(node).id;
    if (isStr(id)) numbers.set(id, i + 1);
  });
  for (const group of firstList(block, "groups").slice(0, FL_MAX_GROUPS)) {
    const label = isDict(group) ? safeText(group.label, FL_GROUP) : "";
    if (!label) continue;
    const g = F(group);
    const at = walkable(g, "nodes")
      .filter((k): k is string => isStr(k) && numbers.has(k))
      .map((k) => numbers.get(k)!);
    if (!at.length) continue;
    const span = at.length === 1 ? `step ${at[0]}` : `steps ${Math.min(...at)}-${Math.max(...at)}`;
    const times = isCount(g.count, FL_MIN_COUNT, FL_MAX_COUNT) ? ` × ${g.count}` : "";
    lines.push(`_${label}${times}: ${span}_`);
  }
  const title = safeText(block.title, FL_TITLE);
  return (title ? [`**${title}**`] : []).concat(lines).join("\n");
}

// steps.py
const S_TITLE = 80, S_TEXT = 600, S_MAX_ITEMS = 12, S_MAX_TICK = 20;

function changeLines(item: Record<string, unknown>, labels: Record<string, string>): string[] {
  const holds = isDict(item.holds) ? (item.holds as Record<string, unknown>) : {};
  const lines: string[] = [];
  for (const [node, chips] of Object.entries(holds).slice(0, FL_MAX_NODES)) {
    const named = Object.hasOwn(labels, node) ? labels[node] : undefined;
    const name = safeText(named, S_TITLE) || safeText(node, 24);
    const held = chipsText(chips);
    if (name && held) lines.push(`${name} now holds: ${held}`);
  }
  if (isCount(item.tick, 1, S_MAX_TICK)) lines.push(`The repeated part runs ${item.tick} more times.`);
  return lines;
}

function textSteps(block: Record<string, unknown>, labels?: Labels): string {
  const items = firstList(block, "items").slice(0, S_MAX_ITEMS)
    .filter((it) => isDict(it) && safeText(it.title));
  const flowId = isStr(block.for) ? block.for : "";
  const forLabels: Record<string, string> = labels && flowId && Object.hasOwn(labels, flowId) ? labels[flowId] : {};
  const parts: string[] = [];
  items.forEach((item, i) => {
    const it = F(item);
    const head = `**Step ${i + 1} of ${items.length} · ${safeText(it.title, S_TITLE)}**`;
    const lines = [head, safeText(it.text, S_TEXT), ...changeLines(it, forLabels)].filter(Boolean);
    parts.push(lines.join("\n"));
  });
  if (!parts.length) return "";
  const title = safeText(block.title, S_TITLE);
  return (title ? [`**${title}**`] : []).concat(parts).join("\n\n");
}

// calculator.py — a formula worked out the way text_fallback's arithmetic() does: names, numbers, + - * / ( )
// and unary minus, and nothing else. Helper calls, comparisons and (without `powers`) ^ are NOT simple formulas:
// arithmetic gives None there, and the words say so ("open in Hermes Desktop", "–"). The PARSE is the drawing
// side's own (lib/formula.ts) — this is the shipped reader with the drawing's extra grammar refused, not a
// second evaluator.
const INPUT_ID = /^[A-Za-z_][A-Za-z0-9_]{0,23}$/;

export function arithmetic(formula: unknown, names: Map<string, number>, powers: boolean = false): number | null {
  if (!isStr(formula) || formula.length > MAX_STRING) return null;
  let tree: Node;
  try {
    tree = parseFormula(formula);
  } catch {
    return null;
  }
  if (!simpleTree(tree, powers)) return null;
  return evaluate(tree, names);
}

function simpleTree(node: Node, powers: boolean): boolean {
  switch (node.kind) {
    case "number": case "name": return true;
    case "negate": return simpleTree(node.arg, powers);
    case "binary": {
      const ops = ["+", "-", "*", "/"];
      if (node.op === "^") return powers;
      if (!ops.includes(node.op)) return false;  // a comparison is not a simple arithmetic formula here
      return simpleTree(node.left, powers) && simpleTree(node.right, powers);
    }
    case "call": return false;  // helpers play in Hermes Desktop, never in a text line
  }
}

function textCalculator(block: Record<string, unknown>): string {
  const inputs = walkable(block, "inputs").slice(0, 6).filter((it) => isDict(it) && isStr(it.id));
  const names = new Map<string, number>();
  const shown: string[] = [];
  for (const item of inputs) {
    const it = F(item);
    const start = [it.value, it.min].find(isNum) ?? 0;
    names.set(it.id as string, start);
    const label = firstOf(it, "label", "id");
    shown.push(`${label} ${withUnit(fmtNum(start), safeText(it.unit, 20))}`);
  }
  const lines: string[] = [];
  for (const out of walkable(block, "outputs").slice(0, 6)) {
    const label = isDict(out) ? safeText(out.label) : "";
    if (!label) continue;
    const value = arithmetic(F(out).formula, names);
    lines.push(value === null
      ? `- ${label}: open in Hermes Desktop for the live calculator`
      : `- ${label}: ${withUnit(fmtNum(value), safeText(F(out).unit, 20))}`);
  }
  if (!lines.length) return "";
  return (shown.length ? [`With ${shown.join(", ")}:`] : []).concat(lines).join("\n");
}

// simulate.py
const SIM_TITLE = 80, SIM_UNIT = 12, SIM_MAX_PILES = 3, SIM_ROWS = 5;

function isName(v: unknown): v is string {
  return isStr(v) && INPUT_ID.test(v);
}

/** simulate._times: five evenly spaced times from 0 to `to`, each on a step. */
function timesOf(to: number, step: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < SIM_ROWS; k++) out.push(Math.floor((to * k) / (SIM_ROWS - 1) / step + 0.5) * step);
  return out;
}

/** simulate._amount: 214358.88 → "214,359"; 12.3456 → "12.35"; 0.004567 → "0.00457". */
function amount(v: number): string {
  if (Math.abs(v) >= 100) return fmtNum(roundHalfEven(v, 0));
  if (Math.abs(v) >= 1) return fmtNum(roundHalfEven(v, 2));
  return fmtNum(v);
}

function textSimulate(block: Record<string, unknown>): string {
  const t = block.t, view = block.view;
  if (!isDict(t) || !isDict(view) || !isName(t.name)) return "";
  const to = t.to, step = pick(t, "step", 1);
  const pilesRaw = Object.hasOwn(view, "piles") ? view.piles : view.series;
  if (!isNum(to) || !isNum(step) || to <= 0 || step <= 0 || !isList(pilesRaw)) return "";
  const piles = pilesRaw.slice(0, SIM_MAX_PILES).filter((p) => isDict(p) && safeText(p.name));
  if (!piles.length) return "";
  const names = new Map<string, number>();
  if (isDict(block.values)) {
    for (const [k, v] of Object.entries(block.values)) if (isName(k) && isNum(v)) names.set(k, v);
  }
  const shown: string[] = [];
  const inputs = isList(block.inputs) ? block.inputs : [];
  for (const item of inputs) {
    if (!isDict(item)) continue;
    const it = F(item);
    const key = pick(it, "name", it.id);
    if (!isName(key)) continue;
    const start = [it.value, it.min].find(isNum) ?? 0;
    names.set(key, start);
    const value = withUnit(fmtNum(start), safeText(it.unit, SIM_UNIT));
    shown.push(`${firstOf(it, "label", "name", "id")} ${value}`);
  }
  const unit = safeText(block.unit, SIM_UNIT);
  const rows: string[][] = [];
  for (const when of timesOf(to, step)) {
    const withTime = new Map(names);
    withTime.set(t.name, when);
    const cells = piles.map((p) => {
      const v = arithmetic(F(p).formula, withTime, true);
      return v === null ? "–" : withUnit(amount(v), unit);
    });
    rows.push([fmtNum(when), ...cells]);
  }
  const header = [tableCell(t.unit) || (t.name as string), ...piles.map((p) => tableCell(F(p).name))];
  const title = safeText(block.title, SIM_TITLE);
  const lead = (title ? [`**${title}**`] : []).concat(shown.length ? [`With ${shown.join(", ")}:`] : []);
  return lead.concat(mdTable(header, rows)).join("\n");
}

// form.py
const FORM_NOTE = 80, FORM_GROUP = 40;

function choice(value: unknown): string {
  if (isList(value)) return value.slice(0, 12).map(choice).filter(Boolean).join(", ");
  if (isDict(value)) return firstOf(value, "label", "value");
  return safeText(value, 60);
}

function optionText(option: unknown): string {
  const name = choice(option);
  const note = isDict(option) && name ? safeText(option.note, FORM_NOTE) : "";
  return note ? `${name} — ${note}` : name;
}

function chosen(field: Record<string, unknown>, options: unknown[]): string {
  const value = field.value;
  for (const option of options) {
    if (isDict(option) && !Array.isArray(value) && option.value === value) return choice(option);
  }
  return choice(value);
}

function textForm(block: Record<string, unknown>): string {
  const fields = isList(block.fields) ? block.fields : [];
  const lines: string[] = [];
  let group = "";
  for (const field of fields.slice(0, 12)) {
    if (!isDict(field)) continue;
    const f = F(field);
    const label = firstOf(f, "label", "id");
    if (!label) continue;
    const heading = safeText(f.group, FORM_GROUP);
    if (heading && heading !== group) lines.push(`${heading}:`);
    group = heading;
    const options = isList(f.options) ? (f.options as unknown[]) : [];
    const picked = chosen(f, options);
    const value = picked ? withUnit(picked, safeText(f.unit, 20)) : "";
    const listed = options.slice(0, 12).map(optionText).filter(Boolean).join(" / ");
    lines.push(`- ${label}${value ? `: ${value}` : ""}${listed ? ` (${listed})` : ""}`);
  }
  if (!lines.length) return "";
  const title = safeText(block.title);
  return (title ? [`**${title}**`] : []).concat(lines, ["(answer in a message)"]).join("\n");
}

// calendar.py / upnext.py / weather.py — the day-walking types the chat fallback speaks and this twin
// skipped when it was written against an older base. Ported whole: a real YYYY-MM-DD day, HH:MM times,
// the C-locale day and month names the card itself would say.
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CALENDAR_MAX_EVENTS = 12;
const UPNEXT_MAX_ITEMS = 12;
const UPNEXT_STATES = ["overdue", "today", "soon"];

/** calendar._day: a real day from "YYYY-MM-DD", else None — the calendar rejects "2026-02-30" exactly as
 *  Python's date.fromisoformat does. */
function calendarDay(text: unknown): { weekday: number; day: number; month: number } | null {
  if (!isStr(text)) return null;
  const t = text.trim();
  if (t.length !== 10) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== mo || date.getUTCDate() !== d) return null;
  return { weekday: (date.getUTCDay() + 6) % 7, day: d, month: mo };
}

/** "Sat 14 Nov": %a %d %b — Python's day number is not zero padded. */
function dayWords(day: { weekday: number; day: number; month: number }): string {
  return `${DAY_NAMES[day.weekday]} ${day.day} ${MONTH_NAMES[day.month - 1]}`;
}

/** calendar._hm: a start or end as HH:MM — a full ISO stamp gives its minutes, anything else its first five. */
function hourMinute(text: unknown): string {
  const value = safeText(text, 40);
  return value.length >= 16 && value[10] === "T" ? value.slice(11, 16) : value.slice(0, 5);
}

function textCalendar(block: Record<string, unknown>): string {
  const day = calendarDay(block.date);
  const head = day ? `**${dayWords(day)}**` : "";
  const lines: string[] = [];
  const events = block.events || [];
  if (events && !isList(events)) throw new Error("events");   // the for-loop over there raises too
  for (const event of (isList(events) ? events : []).slice(0, CALENDAR_MAX_EVENTS)) {
    if (!isDict(event) || !safeText(event.title)) continue;
    const when = hourMinute(event.start) + (event.end ? `–${hourMinute(event.end)}` : "");
    const place = safeText(event.place);
    lines.push(`- ${when} ${safeText(event.title)}` + (place ? ` · ${place}` : ""));
  }
  return [head, ...(lines.length ? lines : ["- Nothing planned"])].join("\n");
}

/** weather._deg: the temperature as the card prints it — a whole degree. */
function deg(value: number): string {
  return `${roundHalfEven(value, 0)}°`;
}

function hasText(v: unknown): boolean {
  return isStr(v) && v.trim() !== "";
}

function textWeather(block: Record<string, unknown>): string {
  if (!(isNum(block.temp) && hasText(block.place))) return "";
  const place = safeText(block.place), sky = safeText(block.condition);
  const parts = [`**${deg(block.temp as number)}** ` + (sky ? `${sky} in ${place}` : place)];
  if (isNum(block.high)) parts.push(`High ${deg(block.high as number)}`);
  if (isNum(block.low)) parts.push(`${deg(block.low as number)} tonight`);
  return parts.join(" · ");
}

function textUpnext(block: Record<string, unknown>): string {
  const lines: string[] = [];
  const rawItems = block.items || [];
  if (rawItems && !isList(rawItems)) throw new Error("items");
  for (const item of (isList(rawItems) ? rawItems : []).slice(0, UPNEXT_MAX_ITEMS)) {
    const day = isDict(item) ? calendarDay(item.date) : null;
    const title = isDict(item) ? safeText(item.title) : "";
    if (!(day && title)) continue;
    const r = F(item);
    const extra = [safeText(r.time) || safeText(r.amount)];
    if (UPNEXT_STATES.includes(readStateWord(r.state))) extra.push(safeText(r.stateText));
    const tail = extra.filter(Boolean).map((e) => ` · ${e}`).join("");
    lines.push(`- ${dayWords(day)} · ${title}${tail}`);
  }
  if (!lines.length) return "";
  const head = safeText(block.title) || "Up next";
  return [`**${head}**`, ...lines].join("\n");
}

/** upnext reads the bare state word (overdue/today/soon) — not the checklist's five. */
function readStateWord(v: unknown): string {
  return isStr(v) ? v : "";
}

/** heatmap._cell (#36): a number as written; anything else — a word, a null — is a dash. */
function heatCell(value: unknown): string {
  return isNum(value) ? tableCell(value) : "–";
}

// text_fallback.RENDERERS — every type but the layout ones. Unknown types give nothing, as over the wire.
// (steps takes the flow-label map as its second word, like text_steps does over there.)
const RENDERERS: Record<string, (block: Record<string, unknown>, labels?: Labels) => string> = {
  heading: textHeading, text: textText, divider: () => textDivider(), badge: textBadge, link: textLink,
  image: textImage, bar: textBar, callout: textCallout, source: textSource, table: textTable,
  list: textListBlock, checklist: textChecklist, tiles: textTiles, streak: textStreak, progress: textProgress,
  stat: textStat, kpis: textKpis, chart: textChart, images: textImages, include: textInclude, flip: textFlip,
  calendar: textCalendar, upnext: textUpnext, weather: textWeather,
  button: textButton, actions: textActions, layers: textLayers, timeline: textTimeline, heatmap: textHeatmap,
  flow: textFlow, calculator: textCalculator, simulate: textSimulate, form: textForm, steps: textSteps,
};

const SIMPLE: Record<string, (block: Record<string, unknown>, depth: number, labels: Labels) => string> = {};
for (const [kind, fn] of Object.entries(RENDERERS)) {
  SIMPLE[kind] = (block, _depth, labels) => fn(block, labels);
}

function layoutPieces(block: Record<string, unknown>, depth: number, labels: Labels): string[] {
  if (block.type === "tabs") {
    const out: string[] = [];
    for (const tab of isList(block.tabs) ? block.tabs : []) {
      const children = isDict(tab) && isList(tab.children) ? (tab.children as unknown[]) : [];
      const inside = pieces(children, depth + 1, labels);
      const label = inside.length ? safeText(F(tab).label) : "";
      if (label) out.push(`**${label}**`);
      out.push(...inside);
    }
    return out;
  }
  const children = isList(block.children) ? block.children : [];
  const title = block.type === "section" ? safeText(block.title) : "";
  const inside = pieces(children, depth + 1, labels);
  return (title && inside.length ? [`**${title}**`] : []).concat(inside);
}

/** text_fallback._render: one block as text pieces (a container gives one per child). */
function renderBlock(block: unknown, depth: number, labels: Labels): string[] {
  if (!isDict(block) || depth > MAX_DEPTH) return [];
  const kind = block.type;
  if (LAYOUT_TYPES.includes(kind as string)) return layoutPieces(block, depth, labels);
  const renderer = isStr(kind) && Object.hasOwn(SIMPLE, kind) ? SIMPLE[kind] : undefined;
  const text = renderer ? renderer(block, depth, labels) : "";
  return text ? [text] : [];
}

/** text_fallback._render_safely: a malformed block is skipped — an export must still go out. */
function renderSafely(block: unknown, depth: number, labels: Labels): string[] {
  try {
    return renderBlock(block, depth, labels);
  } catch {
    return [];
  }
}

function pieces(blocks: unknown[], depth: number, labels: Labels): string[] {
  const out: string[] = [];
  for (const block of blocks) out.push(...renderSafely(block, depth, labels));
  return out;
}

/** text_fallback.blocks_as_text(blocks, limit=None): a whole board as Markdown, uncapped. "" when nothing in it
 *  can be shown as text. */
export function blocksAsMarkdown(blocks: unknown): string {
  if (!isList(blocks)) return "";
  let labels: Labels = {};
  try {
    labels = flowLabels(blocks);
  } catch {  // odd ids only cost the labels, as over the wire
    labels = {};
  }
  return pieces(blocks, 0, labels).join("\n\n");
}
