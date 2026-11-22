export type SortState = { column: number; direction: "up" | "down" } | null;

/** What a null cell reads as: a value written down as unknown. It looks like a filled cell but carries no number, so
 *  every reading that asks "does this cell hold a value" counts it as blank. */
export const GAP = "–";

/** A cell with nothing in it: left out (""), or written as unknown (GAP). */
export function isBlank(cell: string): boolean {
  return !cell || cell === GAP;
}

/**
 * The number a cell starts with, for sorting and right-aligning: up to three leading symbols (₹, $, "Rs ") are
 * allowed, commas ignored, and the sign may come before them. A typeset minus (−) counts as one.
 * "₹44,999" → 44999; "4,800 mAh" → 4800; "4.6★" → 4.6; "−4.1%" → -4.1; "-$279.84" → -279.84; "Pixel 10a" → null;
 * "" → null.
 */
export function cellNumber(cell: string): number | null {
  const plain = cell.replace(/,/g, "").replace(/^−/, "-");
  const m = /^([-+]?)[^\d\-+]{0,3}([-+]?\d+(?:\.\d+)?)/.exec(plain);
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === "-" ? -n : n;
}

/**
 * The order to show rows in (indices into rows) when sorted by one column. Numbers compare as numbers, text
 * alphabetically (with numbers inside text in order: "Day 2" before "Day 10"); blank cells always go last.
 *   rows [["A", "₹300"], ["B", ""], ["C", "₹50"]], {column: 1, direction: "up"} → [2, 0, 1]
 * With no sort, the order as written: [0, 1, 2].
 */
export function sortedOrder(rows: string[][], sort: SortState): number[] {
  const order = rows.map((_, i) => i);
  if (!sort) return order;
  const sign = sort.direction === "up" ? 1 : -1;
  return order.sort((a, b) => {
    const left = rows[a][sort.column] ?? "";
    const right = rows[b][sort.column] ?? "";
    if (isBlank(left) || isBlank(right)) return blanksLast(left, right);
    return sign * compareCells(left, right);
  });
}

function blanksLast(left: string, right: string): number {
  const leftBlank = isBlank(left), rightBlank = isBlank(right);
  if (leftBlank && rightBlank) return 0;
  if (leftBlank) return 1;
  return -1;
}

function compareCells(left: string, right: string): number {
  const a = cellNumber(left);
  const b = cellNumber(right);
  if (a !== null && b !== null) return a - b;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

/** A click on a column header: not sorted → up → down → back to the order as written. */
export function nextSort(sort: SortState, column: number): SortState {
  if (!sort || sort.column !== column) return { column, direction: "up" };
  if (sort.direction === "up") return { column, direction: "down" };
  return null;
}

/** A column reads as numbers (right-aligned) when every filled cell starts with one. A cell written as unknown (GAP)
 *  is not filled: "31000", "–", "18000" is a number column. */
export function isNumberColumn(rows: string[][], column: number): boolean {
  const filled = rows.map((r) => r[column] ?? "").filter((cell) => !isBlank(cell));
  return filled.length > 0 && filled.every((cell) => cellNumber(cell) !== null);
}
