// How a table cell reads beyond its text: a rise or a fall in a change column (with a mini bar), and a big amount
// shortened the way the reader says it. Cells stay text in the block; this only decides how they are drawn.
import { fmt, SHORT_FROM } from "../chart/chartData";
import { cellNumber, isBlank, isNumberColumn } from "./sort";

/** A change column holds numbers, at least one written with a sign, and is all percentages or all signed:
 *  ["+5%", "-3%"] → true;  ["4.1%", "−2.0%"] → true;  ["₹300", "₹50"] → false;  ["-26.8%", "13.3", "+4.7%"] → false
 *  A cell written as unknown ("–") is skipped, the way a blank one is: ["+5%", "–", "-3%"] → true. */
export function isChangeColumn(rows: string[][], column: number): boolean {
  if (!isNumberColumn(rows, column) || !rows.some((r) => /^[-+−]/.test(r[column] ?? ""))) return false;
  // A column of mixed metrics ("13.3", "1.83x", "+4.7%") isn't a change column: every cell is a percentage, or every
  // non-zero cell carries its sign.
  const filled = rows.map((r) => (r[column] ?? "").trim()).filter((cell) => !isBlank(cell));
  const allPercent = filled.every((cell) => cell.endsWith("%"));
  const allSigned = filled.every((cell) => /^[-+−]/.test(cell) || cellNumber(cell) === 0);
  return allPercent || allSigned;
}

/** A change cell as a rise or a fall: "+1.76%" → "up"; "−18.67%" → "down"; "0.00%" or "" → null. */
export function changeOf(cell: string): "up" | "down" | null {
  const n = cellNumber(cell);
  if (n === null || n === 0) return null;
  return n > 0 ? "up" : "down";
}

/**
 * Where a mini bar sits, in % of its track: it grows from the middle (zero), right for a rise and left for a fall,
 * the column's largest change filling half the track.
 *   (5, 10) → {left: 50, width: 25};  (-10, 10) → {left: 0, width: 50};  (0, 0) → {left: 50, width: 0}
 */
export function miniBar(value: number, largest: number): { left: number; width: number } {
  const width = largest > 0 ? (Math.abs(value) / largest) * 50 : 0;
  return { left: value < 0 ? 50 - width : 50, width };
}

// A cell that is only a number: an optional sign, an optional currency symbol, then digits (with or without
// thousands commas) and decimals. "-$4,213,500,000", "₹18,40,000" and "560001" match; "4,800 mAh" doesn't.
const AMOUNT = /^([-+−]?)([$₹€£¥]?)(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d+)?$/;

/**
 * A cell that is only an amount of 100,000 or more, shortened through fmt, with every digit kept for its hover. Plain
 * digits without commas or a currency symbol are left alone: they are more often a code (a PIN, an id) than an amount.
 *   en-US: "1,250,000" → {short: "1.25M", full: "1,250,000"};  "₹18,40,000" → {short: "₹18.4L", full: "₹18,40,000"}
 *   "+1,250,000" → {short: "+1.25M", …};  "99,999" → null;  "4,800 mAh" → null;  "560001" → null
 */
export function bigNumber(cell: string): { short: string; full: string } | null {
  const m = AMOUNT.exec(cell.trim());
  if (!m) return null;
  const [, sign, currency, digits, decimals = ""] = m;
  if (!currency && !digits.includes(",")) return null;
  const magnitude = Number(digits.replace(/,/g, "") + decimals);
  if (magnitude < SHORT_FROM) return null;
  const v = sign === "-" || sign === "−" ? -magnitude : magnitude;
  const unit = currency || undefined;
  const plus = sign === "+" ? "+" : "";  // fmt writes a minus itself; a rise written with + keeps it
  return { short: plus + fmt(v, unit), full: plus + fmt(v, unit, { full: true }) };
}
