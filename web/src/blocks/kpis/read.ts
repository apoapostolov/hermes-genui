// Headline numbers: kpis (a row of up to 4) and stat (one on its own). Both read their numbers with readKpi.
import { clean, firstText, keepFirst, num, str, type Trail } from "../../core/fields";

export type KpiItem = {
  label: string;
  value: number | string | null;
  unit?: string;
  change?: number | null;
  change_unit?: "%" | "pt";
  trend?: number[];
};

// A trend is a small line under the number: it needs 2 points, and more than 60 would not show in it.
const TREND_FEWEST = 2;
const TREND_MOST = 60;
export type KpisBlock = { type: "kpis"; name?: string; items: KpiItem[] };
export type StatBlock = { type: "stat" } & KpiItem;

/**
 * One headline number (a kpis item, or a stat). The value may be a number or short text ("Leeds United (H)");
 * change_unit is "pt" only when asked for, otherwise "%". trend: see readTrend.
 *   {label: "Revenue", value: 72275, unit: "₹Cr", change: 2.2} → {label: "Revenue", value: 72275, unit: "₹Cr", change: 2.2, change_unit: "%"}
 */
export function readKpi(item: any): KpiItem {
  let value: number | string | null = num(item.value);
  if (value === null) value = str(item.value, 40) ?? null;
  const unit = typeof item.unit === "string" ? item.unit : undefined;
  const changeUnit = item.change_unit === "pt" ? "pt" : "%";
  const kpi: KpiItem = { label: item.label, value, unit, change: num(item.change), change_unit: changeUnit };
  if (kpi.unit === undefined) delete kpi.unit;
  if (kpi.change === null) delete kpi.change;
  const trend = readTrend(item.trend);
  if (trend) kpi.trend = trend;
  return kpi;
}

/**
 * A trend's finite numbers, the latest 60 at most; undefined with fewer than 2.
 *   [100, "90", null, 85, 80] → [100, 85, 80];  [5, "6"] → undefined;  "1,2,3" → undefined
 */
function readTrend(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const numbers = v.map(num).filter((n): n is number => n !== null);
  return numbers.length >= TREND_FEWEST ? numbers.slice(-TREND_MOST) : undefined;
}

/**
 * kpis: up to 4 headline numbers in cards. Items without a text label are dropped. `name` is the group's heading
 * ("This week"): it is not drawn, but it names the row for a screen reader.
 *   {type: "kpis", name: "This week", items: [{label: "Steps", value: 8200}, {value: 3}]}
 *   → {type: "kpis", name: "This week", items: [{label: "Steps", value: 8200, …}]}
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
  return clean({ type: "kpis" as const, name: str(raw.name, 60), items: keepFirst(items, 4, here, "items") });
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
