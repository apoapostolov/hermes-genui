// Headline numbers: kpis (a row of up to 4) and stat (one on its own). Both read their numbers with readKpi.
import { firstText, keepFirst, num, str, type Trail } from "../../core/fields";

export type KpiItem = {
  label: string;
  value: number | string | null;
  unit?: string;
  change?: number | null;
  change_unit?: "%" | "pt";
  invert_tone?: true;
  trend?: (number | null)[];
};

// A trend is a small line under the number: it needs 2 points, and more than 60 would not show in it.
const TREND_FEWEST = 2;
const TREND_MOST = 60;
// A chip prints one decimal, so it only carries numbers a reader can scan. A bigger change loses its chip, as it does
// in the Python fallback, rather than a wall of digits.
const MAX_CHIP = 1e15;
export type KpisBlock = { type: "kpis"; items: KpiItem[] };
export type StatBlock = { type: "stat" } & KpiItem;

/**
 * One headline number (a kpis item, or a stat). The value may be a number, short text ("Leeds United (H)"), or null:
 * a null is a number nobody measured, drawn and written as "no data" (never as 0 or a dash).
 * `change_unit` defaults to points on a "%" card (a margin moving from 18.6% to 17.7% fell 0.9 points) and to "%"
 * elsewhere, for a change worked out from `previous`; a written `change` keeps its own meaning and defaults to "%"
 * on every card. An explicit `change_unit` is kept either way. `previous` makes the change from that number and wins
 * over a written `change`; `invert_tone` says a fall is the good news. trend: see readTrend.
 *   {label: "Revenue", value: 72275, unit: "₹Cr", change: 2.2} → {label: "Revenue", value: 72275, unit: "₹Cr", change: 2.2, change_unit: "%"}
 *   {label: "Net margin", value: 18.6, unit: "%", change: 5} → {…, change: 5, change_unit: "%"}
 *   {label: "Revenue", value: 72275, unit: "₹Cr", previous: 70223} → {…, change: 2.92…, change_unit: "%"}
 *   {label: "Net margin", value: 18.6, unit: "%", previous: 19.5} → {…, change: -0.9, change_unit: "pt"}
 *   {label: "Chargebacks", value: null} → {label: "Chargebacks", value: null, change_unit: "%"}
 */
export function readKpi(item: any): KpiItem {
  let value: number | string | null = num(item.value);
  if (value === null) value = str(item.value, 40) ?? null;
  const unit = typeof item.unit === "string" ? item.unit : undefined;
  const fromPrevious = "previous" in item;
  const changeUnit = readChangeUnit(item.change_unit, unit, fromPrevious);
  let change = fromPrevious ? changeFrom(item.previous, value, changeUnit) : num(item.change);
  if (change !== null && Math.abs(change) >= MAX_CHIP) change = null;
  const kpi: KpiItem = { label: item.label, value, unit, change, change_unit: changeUnit };
  if (kpi.unit === undefined) delete kpi.unit;
  if (kpi.change === null) delete kpi.change;
  if (item.invert_tone === true) kpi.invert_tone = true;
  const trend = readTrend(item.trend);
  if (trend) kpi.trend = trend;
  return kpi;
}

/** A change's unit: the one written, else points for a change worked out from `previous` on a "%" card, and "%" for
 *  every other case (a written change keeps its own meaning on a "%" card too).
 *  ("pt", "₹", false) → "pt";  (undefined, "%", true) → "pt";  (undefined, "%", false) → "%";  (undefined, "₹Cr", true) → "%" */
function readChangeUnit(written: unknown, unit: string | undefined, fromPrevious: boolean): "%" | "pt" {
  if (written === "%" || written === "pt") return written;
  return fromPrevious && unit === "%" ? "pt" : "%";
}

/**
 * The change from a previous number, in `unit`; null when either side is unknown or a percentage would divide by zero.
 *   (100, 70, "%") → -30;  (70223, 72275, "%") → 2.92…;  (19.5, 18.6, "pt") → -0.9
 *   (null, 70, "%") → null;  ("many", 70, "%") → null;  (0, 70, "%") → null;  (0, 70, "pt") → 70
 *   ("n/a", 70, "pt") → null (a text value has no number to subtract from)
 */
function changeFrom(previous: unknown, value: number | string | null, unit: "%" | "pt"): number | null {
  const before = num(previous);
  if (before === null || typeof value !== "number") return null;
  const moved = value - before;
  if (unit === "pt") return moved;
  return before === 0 ? null : (moved / Math.abs(before)) * 100;
}

/**
 * A trend as drawn: one slot per point, a null kept where the model measured nothing, the latest 60 slots at most;
 * undefined with fewer than 2 numbers. A slot kept empty is what breaks the sparkline; dropping it would slide the
 * later points into the wrong places.
 *   [100, "90", null, 85, 80] → [100, null, null, 85, 80];  [5, "6"] → undefined;  "1,2,3" → undefined
 */
function readTrend(v: unknown): (number | null)[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const slots = v.slice(-TREND_MOST).map((x) => num(x));
  const known = slots.filter((n) => n !== null).length;
  return known >= TREND_FEWEST ? slots : undefined;
}

/**
 * kpis: up to 4 headline numbers in cards. Items without a text label are dropped.
 *   {type: "kpis", items: [{label: "Steps", value: 8200}, {value: 3}]} → {type: "kpis", items: [{label: "Steps", value: 8200, …}]}
 * Dropped: no items list, or no item with a label.
 */
export function readKpis(raw: any, here: Trail): KpisBlock | null {
  if (!Array.isArray(raw.items)) return here.drop("kpis needs items");
  const items: KpiItem[] = [];
  raw.items.forEach((item: any, i: number) => {
    if (!item || typeof item.label !== "string") {
      here.at("items").at(i).drop("item has no label");
      return;
    }
    items.push(readKpi(item));
  });
  if (!items.length) return here.drop("kpis has no item with a label");
  return { type: "kpis", items: keepFirst(items, 4, here, "items") };
}

/**
 * stat: one big number with its label and an optional change chip. Label also `title`.
 *   {type: "stat", title: "Saved", value: 42000, unit: "₹", change: 12} → {type: "stat", label: "Saved", value: 42000, unit: "₹", change: 12, change_unit: "%"}
 */
export function readStat(raw: any, here: Trail): StatBlock | null {
  const label = firstText([raw.label, raw.title], 40);
  if (!label) return here.drop("stat needs a label");
  return { type: "stat", ...readKpi({ ...raw, label }) };
}
