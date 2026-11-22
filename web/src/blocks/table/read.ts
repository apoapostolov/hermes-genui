import { clean, firstList, firstText, keepFirst, num, str, textOrNumber, type Trail } from "../../core/fields";

export type Highlight = { row: number } | { column: number };
export type TableBlock = { type: "table"; columns: string[]; rows: string[][]; highlight?: Highlight; caption?: string };

const MAX_COLUMNS = 8;
const MAX_ROWS = 30;

/**
 * table: options compared across the same attributes.
 * - columns: names (also `headers`/`header`; {label} or {name} objects work too), up to 8. Without columns, the keys of
 *   the first object row are used, or the first row itself when rows are lists.
 * - rows: lists of cells (also `data`), up to 30; a row may also be an object keyed by column name. Numbers become text.
 *   A null cell reads "–" (a value written down as unknown, not a cell left out); a cell missing from an object row reads
 *   blank. A short row is padded with blank cells; a row with more cells than columns is dropped (with a note).
 * - highlight: {row: n} or {column: n}, counting from 0; a bare number means a row, and text matching a row's first cell
 *   or a column name picks that one. Out of range: ignored, with a note.
 * - caption: optional (also `title`).
 *   {type: "table", headers: ["Phone", "Price"], data: [["Pixel", 44999], {Phone: "Galaxy", Price: "₹42,999"}], highlight: 0}
 *   → {type: "table", columns: ["Phone", "Price"], rows: [["Pixel", "44999"], ["Galaxy", "₹42,999"]], highlight: {row: 0}}
 * Dropped: no columns. With columns but no usable row it is kept with rows: [] (noted), and draws an empty state.
 */
export function readTable(raw: any, here: Trail): TableBlock | null {
  const rawRows = firstList([raw.rows, raw.data]) ?? [];
  let columns = readColumns(firstList([raw.columns, raw.headers, raw.header]));
  let rowsToRead = rawRows;
  if (!columns.length) {
    // No column names: take them from the first row (its keys if it's an object, its cells if it's a list).
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
  if (!rows.length) here.drop("table has no rows"); // noted, but drawn: the headers and a line saying so
  const kept = keepFirst(rows, MAX_ROWS, here.at("rows"), "rows");

  const highlight = readHighlight(raw.highlight, columns, kept, here.at("highlight"));
  const caption = firstText([raw.caption, raw.title], 100);
  return clean({ type: "table" as const, columns, rows: kept, highlight, caption });
}

/** Column names as text: ["Phone", {label: "Price"}, 3] → ["Phone", "Price", "3"]. Unusable entries become "". */
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

/** {Phone: "Pixel", price: 44999} with columns ["Phone", "Price"] → ["Pixel", 44999] (names match ignoring case). */
function cellsByColumnName(row: Record<string, unknown>, columns: string[]): unknown[] {
  const byLowerName = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  return columns.map((c) => byLowerName.get(c.toLowerCase()));
}

/** A cell as text: "₹44,999" stays; 4.6 → "4.6"; true → "Yes"; a null the model wrote → "–" (written down as
 *  unknown, which is not the same as an empty cell); anything else → "". */
function cellText(v: unknown): string {
  if (v === null) return "–";
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
