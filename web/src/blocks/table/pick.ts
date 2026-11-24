// The words behind an interactive table: what a query keeps, and what a pick sends to the chat.
// A row shows when the search reads a word in any of its cells; the picked selection is tied to the
// ROW ITSELF — its data, carried as a key — never to a seat in the array: a refresh that removes or
// replaces the picked data DISCARDS that pick for good (livePicks — it can add nothing to a message,
// cannot throw, and identical data reappearing later is a NEW row that never inherits the old tick),
// and a refresh that moves the row keeps the reader's choice riding along with it. The message carries
// the column names once, so the chat knows what each value means:
//   pickedMessage("Phones under ₹50k", ["Phone", "Price"], [["Pixel 10a", "₹44,999"]], [rowKey(rows[0])])
//   → "Phones under ₹50k:\nPhone | Price\nPixel 10a | ₹44,999"

/** True when the row carries the query somewhere, whatever the case; a blank query keeps every row. */
export function rowMatches(row: string[], query: string): boolean {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return true;
  return row.some((cell) => cell.toLowerCase().includes(wanted));
}

/** What a tick actually selects: the row's data, canonically. Equal data — wherever it sits after a
 *  refresh — carries the same key; different data can never inherit an old key. */
export function rowKey(row: string[]): string {
  return JSON.stringify(row);
}

/** Picks whose rows still carry their data on the board — the rule the drawing applies to its own
 *  state on every refresh. A key whose row was removed or replaced is DISCARDED, not hidden: gone
 *  from the array means gone from memory, so identical data reappearing later reads as a new entry
 *  and starts unselected — an old tick can never resurrect behind the reader's back. Data that is
 *  unchanged, reordered, or merely hidden by the reader's own query keeps every pick: only a real
 *  change of the source data can discard one. */
export function livePicks(rows: string[][], picked: string[]): string[] {
  if (!picked.length) return picked;
  const present = new Set<string>();
  for (const row of rows) if (Array.isArray(row)) present.add(rowKey(row));
  return picked.filter((key) => present.has(key));
}

/** The picked rows that still exist, in current board order. A key whose row was removed or replaced
 *  by different data contributes nothing — it is simply gone, silently and safely, never an error and
 *  never somebody else's seat. (The drawing has already discarded such keys via livePicks; this keeps
 *  the promise even for a picked array handed in from elsewhere.) */
export function selectedRows(rows: string[][], picked: string[]): string[][] {
  const wanted = new Set(picked);
  return rows.filter((row) => Array.isArray(row) && wanted.has(rowKey(row)));
}

/** The message a tap sends: where the rows came from, the column names, then each picked row in order. */
export function pickedMessage(
  caption: string | undefined,
  columns: string[],
  rows: string[][],
  picked: string[],
): string {
  const line = (cells: string[]) => cells.join(" | ");
  return [`${caption ? `${caption}:` : "Table:"}`, line(columns),
    ...selectedRows(rows, picked).map(line)].join("\n");
}
