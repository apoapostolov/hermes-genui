// The chart's data as one line of words, for the drawing's accessible description: axis names cannot be read out of
// an SVG, so the words a chart is announced by come from the same numbers it draws. It is the line the text fallback
// writes (blocks/chart.py, text_chart) without the Markdown bold, so the two say the same thing.
import { formatNumber } from "../../lib/format";
import type { ChartSeries, ChartSpec } from "./chartData";

/** A number as the text fallback writes it, in the user's own digits: 72275 → "72,275";  18.6 → "18.6";
 *  1234.5678 → "1,234.57";  0.004567 → "0.005" */
export function plainNum(v: number): string {
  if (Number.isInteger(v)) return formatNumber(v, { digits: 0 });
  return formatNumber(v, { digits: Math.abs(v) >= 1 ? 2 : 3 });
}

/** A change chip as words: (7.7) → "(▲ 7.7%)";  (-0.9) → "(▼ 0.9%)". The arrow says the direction, so the browser
 *  reads "up 7.7 percent" rather than a symbol it has no name for. */
export function chipWords(change: number): string {
  const arrow = change < 0 ? "▼" : "▲";
  return `(${arrow} ${plainNum(Math.abs(change))}%)`;
}

/** One series, first value to last, the change where the first value allows one: {name: "Revenue", data: [1.9, null,
 *  2.4]} → "Revenue 1.9 → 2.4 (▲ 26.3%)". No percentage when the first value is 0. */
function seriesLine(series: ChartSeries): string {
  const data = series.data.filter((v): v is number => v !== null);
  if (!data.length) return "";
  const first = data[0];
  const last = data[data.length - 1];
  const line = `${series.name ?? ""} ${plainNum(first)} → ${plainNum(last)}`.trim();
  return first ? `${line} ${chipWords(Math.round(((last - first) / Math.abs(first)) * 1000) / 10)}` : line;
}

/** A pie or donut as its biggest slices and their shares: "A 50%, B 20%, C 15%, D 10%, +1 more". */
function slicesLine(x: (string | number)[], data: (number | null)[]): string {
  const parts = x
    .map((label, i) => ({ label: String(label), value: data[i] ?? null }))
    .filter((p): p is { label: string; value: number } => p.value !== null && p.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (!total) return "";
  const shown = parts.slice(0, 4).map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`.trim());
  if (parts.length > 4) shown.push(`+${parts.length - 4} more`);
  return shown.join(", ");
}

/**
 * The chart as one line, the way the text fallback writes it: the title (and unit), then each series first → last, or
 * a pie's biggest slices.
 *   {title: "Revenue vs profit", unit: "₹Cr", series: [{name: "Revenue", data: [67087, 72275]}]}
 *     → "Revenue vs profit (₹Cr): Revenue 67,087 → 72,275 (▲ 7.7%)"
 *   a donut over A 50, B 20, C 15, D 10, E 5 → "Mix: A 50%, B 20%, C 15%, D 10%, +1 more"
 *   a chart with nothing to say → "" (the drawing is named by its title alone)
 */
export function describeChart(spec: ChartSpec): string {
  const pie = spec.type === "pie" || spec.type === "donut";
  const body = pie
    ? slicesLine(spec.x, spec.series[0]?.data ?? [])
    : spec.series.map(seriesLine).filter(Boolean).join("; ");
  if (!body) return "";
  return `${spec.title ?? "Chart"}${spec.unit ? ` (${spec.unit})` : ""}: ${body}`;
}
