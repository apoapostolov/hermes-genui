import { clean, firstList, firstText, keepFirst, num, str, textOrNumber, type Trail } from "../../core/fields";

export type Highlight = { row: number } | { column: number };
export type LegacyTable = { type: "table"; columns: string[]; rows: string[][]; highlight?: Highlight; caption?: string };

export type TableColumnKind = "text" | "number" | "currency" | "percent" | "date" | "badge" | "link" | "bar" | "sources";
export type TableColumn = {
  id: string; label: string; kind: TableColumnKind; align?: "left" | "right" | "center";
  tone?: "accent" | "good" | "warn" | "neutral"; max?: number; unit?: string;
};
export type TableCell = { text: string; value?: number; url?: string; tone?: "accent" | "good" | "warn" | "neutral" };
export type TableSource = { label: string; url?: string };
export type StructuredRow = { cells: Record<string, TableCell>; sources: TableSource[] };
export type AggregateOp = "sum" | "avg" | "min" | "max" | "count";
export type Aggregate = { column: string; op: AggregateOp; label: string };
export type StructuredTable = {
  type: "table"; caption?: string; structured: true; columns: TableColumn[]; rows: StructuredRow[];
  filterable: boolean; page: number; aggregates: Aggregate[];
};
export type TableBlock = LegacyTable | StructuredTable;

const MAX_COLUMNS = 8;
const MAX_ROWS = 30;
const KINDS: TableColumnKind[] = ["text", "number", "currency", "percent", "date", "badge", "link", "bar", "sources"];
const OPS: AggregateOp[] = ["sum", "avg", "min", "max", "count"];
const TONES = ["accent", "good", "warn", "neutral"];

function isObject(v: unknown): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function plain(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
}

function safeUrl(v: unknown): string | undefined {
  const s = plain(v, 500);
  return s && /^https?:\/\/[^\s<>]+$/i.test(s) ? s : undefined;
}

function readSources(raw: unknown): TableSource[] {
  if (!Array.isArray(raw)) return [];
  const sources: TableSource[] = [];
  for (const item of raw.slice(0, 4)) {
    const label = isObject(item) ? firstText([item.label, item.name, item.title], 40) : plain(item, 40);
    if (!label) continue;
    const source: TableSource = { label };
    const url = safeUrl(isObject(item) ? item.url : undefined);
    if (url) source.url = url;
    sources.push(source);
  }
  return sources;
}

function readStructuredColumns(raw: unknown, here: Trail): TableColumn[] {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_COLUMNS) : [];
  const used = new Set<string>();
  const columns = list.map((item: any, i: number) => {
    if (!isObject(item)) return { id: `c${i}`, label: plain(item, 40) ?? `Column ${i + 1}`, kind: "text" as TableColumnKind };
    const label = firstText([item.label, item.title, item.name], 40) ?? `Column ${i + 1}`;
    let id = plain(item.id ?? item.key, 40)?.replace(/[^A-Za-z0-9_-]+/g, "-").toLowerCase() ?? `c${i}`;
    if (used.has(id)) id = `${id}-${i}`;
    used.add(id);
    const column: TableColumn = { id, label, kind: KINDS.find((k) => k === item.kind) ?? "text" };
    const align = ["left", "right", "center"].find((a) => a === item.align);
    const tone = TONES.find((t) => t === item.tone);
    const max = num(item.max);
    const unit = plain(item.unit, 12);
    if (align) column.align = align as TableColumn["align"];
    if (tone) column.tone = tone as TableColumn["tone"];
    if (max !== null && max > 0) column.max = max;
    if (unit) column.unit = unit;
    return column;
  });
  if (Array.isArray(raw) && raw.length > MAX_COLUMNS) here.drop("table keeps 8 columns");
  return columns;
}

function readStructuredCell(raw: unknown, column: TableColumn): TableCell | null {
  if (isObject(raw)) {
    const value = num(raw.value ?? raw.number);
    const text = firstText([raw.text, raw.label, raw.value], 120) ?? "";
    const cell: TableCell = { text };
    if (value !== null) cell.value = value;
    const url = safeUrl(raw.url ?? raw.href);
    if (url) cell.url = url;
    const tone = TONES.find((t) => t === raw.tone);
    if (tone) cell.tone = tone as TableCell["tone"];
    return cell.text || cell.value !== undefined ? cell : null;
  }
  if (column.kind === "sources") return null;
  if (typeof raw === "number") return { text: String(raw), value: raw };
  const text = plain(raw, 120);
  if (!text) return null;
  if (column.kind === "number" || column.kind === "currency" || column.kind === "percent" || column.kind === "bar") {
    const n = Number(text.replace(/,/g, ""));
    return isFinite(n) ? { text, value: n } : null;
  }
  return { text };
}

function readAggregates(raw: unknown, columns: TableColumn[]): Aggregate[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 4).map((item: any, i: number) => {
    const id = plain(isObject(item) ? item.column ?? item.id : undefined, 40);
    const column = columns.find((c) => c.id === id) ?? columns[i];
    const op = OPS.find((o) => o === (isObject(item) ? item.op : undefined)) ?? "sum";
    const label = firstText([isObject(item) ? item.label : undefined, column?.label], 20) ?? op;
    return { column: column.id, op, label };
  }).filter((a) => columns.some((c) => c.id === a.column));
}

function readStructuredTable(raw: any, here: Trail, caption: string | undefined): TableBlock | null {
  const columns = readStructuredColumns(raw.columns, here.at("columns"));
  if (!columns.length) return here.drop("table needs columns");
  const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  const rows: StructuredRow[] = [];
  rawRows.slice(0, MAX_ROWS).forEach((row: any) => {
    const cells: Record<string, TableCell> = {};
    let hasCell = false;
    const sources = readSources(isObject(row) ? row.sources ?? row.sourceIds : undefined);
    columns.forEach((column, ci) => {
      const value = isObject(row)
        ? row[column.id] ?? row[column.label]
        : Array.isArray(row) ? row[ci] : undefined;
      if (column.kind === "sources") {
        sources.push(...readSources(Array.isArray(value) ? value : value ? [value] : []));
        return;
      }
      const cell = readStructuredCell(value, column);
      if (cell) { cells[column.id] = cell; hasCell = true; }
    });
    if (hasCell || sources.length) rows.push({ cells, sources });
  });
  if (rawRows.length > MAX_ROWS) here.drop("table keeps 30 rows");
  if (!rows.length) return here.drop("table needs at least one row");
  const page = num(raw.page);
  return clean({ type: "table" as const, caption, structured: true as const, columns, rows,
    filterable: raw.filterable === true,
    page: page !== null && page >= 1 && page <= 10 ? Math.floor(page) : 1,
    aggregates: readAggregates(raw.aggregates, columns) });
}

/**
 * table: options compared across the same attributes.
 * The original `columns: string[]` and `rows: (string|number)[][]` form is unchanged. A structured table writes columns
 * as objects with an id, label and kind, rows as objects keyed by id, and may add filterable, page, aggregates and a
 * sources kind. Both draw in the same card and use the same caption.
 *   {caption: "Spend", columns: [{id: "shop", label: "Shop"}, {id: "spend", label: "Spend", kind: "currency", unit: "₹"}],
 *    rows: [{shop: "A", spend: 1200}], filterable: true, aggregates: [{column: "spend", op: "sum"}]}
 */
export function readTable(raw: any, here: Trail): TableBlock | null {
  const caption = firstText([raw.caption, raw.title], 100);
  const structured = (Array.isArray(raw.columns) && raw.columns.some(isObject))
    || raw.filterable === true || raw.page !== undefined || Array.isArray(raw.aggregates);
  if (structured) return readStructuredTable(raw, here, caption);

  const rawRows = firstList([raw.rows, raw.data]) ?? [];
  let columns = readColumns(firstList([raw.columns, raw.headers, raw.header]));
  let rowsToRead = rawRows;
  if (!columns.length) {
    const first = rawRows[0];
    if (Array.isArray(first)) {
      columns = readColumns(first);
      rowsToRead = rawRows.slice(1);
    } else if (first && typeof first === "object") {
      columns = readColumns(Object.keys(first));
    }
  }
  if (!columns.length) return here.drop("table needs columns");
  columns = keepFirst(columns, MAX_COLUMNS, here.at("columns"), "columns");

  const rows: string[][] = [];
  rowsToRead.forEach((row, i) => {
    const cells = readRow(row, columns, here.at("rows").at(i));
    if (cells) rows.push(cells);
  });
  if (!rows.length) here.drop("table has no rows");
  const kept = keepFirst(rows, MAX_ROWS, here.at("rows"), "rows");

  const highlight = readHighlight(raw.highlight, columns, kept, here.at("highlight"));
  return clean({ type: "table" as const, columns, rows: kept, highlight, caption });
}

/** Column names as text: ["Phone", {label: "Price"}, 3] → ["Phone", "Price", "3"]. */
function readColumns(list: unknown[] | undefined): string[] {
  if (!list) return [];
  return list.map((c: any) => {
    if (c && typeof c === "object") return firstText([c.label, c.name, c.title], 40) ?? "";
    return textOrNumber(c, 40) ?? "";
  });
}

/** One row as exactly one cell per column, or null (noted) when it can't be. */
function readRow(row: unknown, columns: string[], here: Trail): string[] | null {
  let cells: unknown[];
  if (Array.isArray(row)) {
    cells = row;
  } else if (row && typeof row === "object") {
    cells = cellsByColumnName(row as Record<string, unknown>, columns);
  } else {
    return here.drop("row is not a list of cells");
  }
  if (cells.length > columns.length) return here.drop(`row has ${cells.length} cells, table has ${columns.length} columns`);
  const out = cells.map(cellText);
  while (out.length < columns.length) out.push("");
  return out;
}

/** {Phone: "Pixel", price: 44999} with columns ["Phone", "Price"] → ["Pixel", 44999]. */
function cellsByColumnName(row: Record<string, unknown>, columns: string[]): unknown[] {
  const byLowerName = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  return columns.map((c) => byLowerName.get(c.toLowerCase()));
}

/** A cell as text: "₹44,999" stays; 4.6 → "4.6"; true → "Yes"; null or anything else → "". */
function cellText(v: unknown): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return textOrNumber(v, 120) ?? "";
}

/** {row: 0} / {column: 2} / 0 / "Pixel 10a" → which row or column to tint, if it exists. */
function readHighlight(v: any, columns: string[], rows: string[][], here: Trail): Highlight | undefined {
  if (v === undefined || v === null) return undefined;
  let found: Highlight | undefined;
  if (num(v) !== null) {
    found = { row: v };
  } else if (typeof v === "string") {
    found = highlightByName(v, columns, rows);
  } else if (typeof v === "object") {
    if (num(v.row) !== null) found = { row: v.row };
    const column = num(v.column) ?? num(v.col);
    if (!found && column !== null) found = { column };
  }
  if (!found) {
    here.drop("highlight should be {row: n} or {column: n}");
    return undefined;
  }
  const inRange = "row" in found ? isIndex(found.row, rows.length) : isIndex(found.column, columns.length);
  if (!inRange) {
    here.drop("highlight is outside the table");
    return undefined;
  }
  return found;
}

/** "Pixel 10a" → the row whose first cell reads that; "Price" → that column. */
function highlightByName(name: string, columns: string[], rows: string[][]): Highlight | undefined {
  const wanted = str(name)?.toLowerCase();
  const row = rows.findIndex((r) => r[0].toLowerCase() === wanted);
  if (row >= 0) return { row };
  const column = columns.findIndex((c) => c.toLowerCase() === wanted);
  if (column >= 0) return { column };
  return undefined;
}

function isIndex(n: number, length: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < length;
}
