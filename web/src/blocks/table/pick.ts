// The words behind an interactive structured table: what a query keeps, and what a tick sends to the chat.
// A row shows when the search reads a word anywhere in it. A tick is tied to the ROW'S DATA, carried as a
// key, never to a seat in the array, a page or a hidden filter: a refresh that removes or replaces the
// ticked data DISCARDS that tick for good (livePicks adds nothing to a message, cannot throw, and
// identical data reappearing later is a NEW row that never inherits the old tick), and a refresh that
// moves the row keeps the reader's choice riding along with it. The message names the columns once, so
// the chat knows what each value means:
//   pickedMessage("Spend", [{id: "shop", label: "Shop"}, {id: "spend", label: "Spend"}],
//                 [{cells: {shop: {text: "A"}, spend: {text: "$1,200", value: 1200}}, sources: []}], [key])
//   → "Spend:\nShop | Spend\nA | $1,200"
import { shownCell } from "./cells";
import type { StructuredRow, TableColumn } from "./read";

/** Everything a row says, as one line for the search: each cell's stored text, the value behind it, what the
 *  cell reads as, and each source's name. A value written only as a number ("44999" in a cell with no text)
 *  is findable by what the reader sees and by the number itself. */
export function rowHaystack(row: StructuredRow, columns: TableColumn[]): string {
  const parts: string[] = [];
  for (const column of columns) {
    const cell = row.cells[column.id];
    if (!cell) continue;
    parts.push(cell.text, shownCell(cell, column));
    if (cell.value !== undefined) parts.push(String(cell.value));
  }
  for (const source of row.sources) parts.push(source.label);
  return parts.filter(Boolean).join(" ");
}

/** True when the row carries the query somewhere, whatever the case; a blank query keeps every row. */
export function rowMatches(row: StructuredRow, columns: TableColumn[], query: string): boolean {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return true;
  return rowHaystack(row, columns).toLowerCase().includes(wanted);
}

/** What a tick actually selects: the row's data, canonically. Equal data wherever it sits after a refresh
 *  carries the same key; different data can never inherit an old key. Tone is left out on purpose: a
 *  re-toned cell is the same fact, so it must not drop a reader's tick. */
export function rowKey(row: StructuredRow, columns: TableColumn[]): string {
  return JSON.stringify([
    columns.map((column) => {
      const cell = row.cells[column.id];
      return cell ? [column.id, cell.text, cell.value ?? null, cell.url ?? null] : null;
    }),
    row.sources.map((source) => [source.label, source.url ?? null]),
  ]);
}

/** Ticks whose rows still carry their data on the board, the rule the drawing applies to its own state on
 *  every refresh. A key whose row was removed or replaced is DISCARDED, not hidden: gone from the array
 *  means gone from memory, so identical data reappearing later reads as a new entry and starts
 *  unselected. Data that is unchanged, reordered, on another page, or merely hidden by the reader's own
 *  query keeps every tick: only a real change of the source data can discard one. */
export function livePicks(rows: StructuredRow[], columns: TableColumn[], picked: string[]): string[] {
  if (!picked.length) return picked;
  const present = new Set(rows.map((row) => rowKey(row, columns)));
  return picked.filter((key) => present.has(key));
}

/** The ticked rows that still exist, in current board order. A key whose row is gone contributes nothing:
 *  silently, safely, never an error and never somebody else's seat. */
export function selectedRows(rows: StructuredRow[], columns: TableColumn[], picked: string[]): StructuredRow[] {
  const wanted = new Set(picked);
  return rows.filter((row) => wanted.has(rowKey(row, columns)));
}

/** One row as a message line: every column in order, a sources column carrying its chip labels, and the
 *  sources of a row that has no sources column named after the cells so nothing the reader saw is lost. */
function rowLine(row: StructuredRow, columns: TableColumn[]): string {
  const labels = row.sources.map((source) => source.label).join(", ");
  const sourcesColumn = columns.some((column) => column.kind === "sources");
  const cells = columns.map((column) => column.kind === "sources"
    ? labels || shownCell(undefined, column)
    : shownCell(row.cells[column.id], column));
  if (!sourcesColumn && labels) cells.push(`[${labels}]`);
  return cells.join(" | ");
}

/** The message a tap sends: where the rows came from, the column labels, then each ticked row in order. */
export function pickedMessage(
  caption: string | undefined,
  columns: TableColumn[],
  rows: StructuredRow[],
  picked: string[],
): string {
  const chosen = selectedRows(rows, columns, picked);
  return [
    `${caption ? `${caption}:` : "Table:"}`,
    columns.map((column) => column.label).join(" | "),
    ...chosen.map((row) => rowLine(row, columns)),
  ].join("\n");
}
