import { chartKind, isOnRightScale, maxSeries, pieSlices, type ChartKind, type ChartSeries, type ChartSpan, type ChartSpec } from "./chartData";
import type { Trail } from "../../core/fields";

export type ChartBlock = { type: "chart"; spec: ChartSpec };

/**
 * chart: `kind` is line, bar, area, stacked, hbar, combo, pie, donut, histogram or range; any other kind, or none,
 * draws a line. Up to 3 series (stacked and area 6; histogram and range 1); a value that isn't a number is a gap
 * (null).
 * Pie and donut: x names the slices and the first series holds their values; zero, negative and missing values are
 * dropped and past 8 slices the smallest merge into "Other" (pieSlices).
 * Combo: the first series is bars, the rest lines; a line with its own unit (or axis "right") gets a right-hand scale.
 * Histogram: x names the bins left to right and the first series holds their counts; a negative count is a gap, a zero
 * is a known zero.
 * Range: one series holding `low` and `high` per x (both numbers or both null) and optionally `now`, the dot; the
 * window's ends are read lower-first, so a pair written the other way still draws.
 *   {type: "chart", kind: "bar", x: ["Q1", "Q2"], series: [{name: "Rev", data: [1, 2]}]}
 *   → {type: "chart", spec: {type: "bar", x: ["Q1", "Q2"], series: [{name: "Rev", data: [1, 2], right: false}]}}
 *   {type: "chart", kind: "range", x: ["Mon"], series: [{low: [18], high: [34], now: [26]}]}
 *   → spec.series [{data: [26], span: [{low: 18, high: 34, now: 26}]}]
 * figure: false (a % change comparison, where a change of a change means nothing) drops the headline number and change
 * chip; only true or false count, anything else is ignored.
 *   {..., figure: false} → spec.figure false;  {..., figure: "false"} → no spec.figure (the default: shown)
 * tone: "change" (exactly that string) colours a one-series line by direction from its first value; anything else is
 * ignored.  {..., tone: "change"} → spec.tone "change";  {..., tone: "Change"} → no spec.tone
 * Dropped: no x labels, no series with a number, or a pie with no positive value.
 */
export function readChart(raw: any, here: Trail): ChartBlock | null {
  const spec = readSpec(raw);
  if (!spec) return here.drop("chart needs x labels and at least one series");
  return { type: "chart", spec };
}

function readSpec(d: any): ChartSpec | null {
  if (!Array.isArray(d.x) || !Array.isArray(d.series) || !d.series.length) return null;
  const type = chartKind(d.kind);
  const unit = typeof d.unit === "string" ? d.unit : undefined;
  const range = type === "range";
  let x: string[] = d.x.map(String);
  let series: ChartSeries[] = d.series
    .filter((s: any) => s && (Array.isArray(s.data) || (range && (Array.isArray(s.low) || Array.isArray(s.high)))))
    .slice(0, maxSeries(type))
    .map((s: any, k: number) => (range ? readSpanSeries(s, x.length) : readSeries(s, k, type, unit)));
  if (!series.length || series.every((s) => s.data.every((v) => v === null))) return null;
  if (type === "pie" || type === "donut") {
    const slices = pieSlices(x, series[0].data);
    if (!slices.x.length) return null;
    x = slices.x;
    series = [{ ...series[0], data: slices.data }];
  }
  const spec: ChartSpec = { type, title: typeof d.title === "string" ? d.title : undefined, x,
    series, unit, source: typeof d.source === "string" ? d.source : undefined };
  if (typeof d.figure === "boolean") spec.figure = d.figure;
  if (d.tone === "change") spec.tone = "change";
  return spec;
}

/** A number as written, or null: anything else (a string, NaN, Infinity) is unknown, not zero. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** One series as written → its name, its numbers (anything else a gap), its own unit, and which scale it uses. A
 *  histogram counts, so a negative count is a gap. */
function readSeries(s: any, k: number, type: ChartKind, chartUnit: string | undefined): ChartSeries {
  const name = typeof s.name === "string" ? s.name : undefined;
  const data = s.data.map((v: any) => {
    const n = num(v);
    return n !== null && type === "histogram" && n < 0 ? null : n;
  });
  const unit = typeof s.unit === "string" ? s.unit : undefined;
  const right = isOnRightScale(type, k, unit, s.axis, chartUnit);
  return { name, data, unit, right };
}

/** A range series as written → one window per x label plus the name, the unit and the middle of each window as `data`.
 *  The ends are read lower-first; a window missing one end is no window (null), and its dot may still be there. */
function readSpanSeries(s: any, n: number): ChartSeries {
  const lows: unknown[] = Array.isArray(s.low) ? s.low : [];
  const highs: unknown[] = Array.isArray(s.high) ? s.high : [];
  const nows: unknown[] = Array.isArray(s.now) ? s.now : [];
  const span: ChartSpan[] = Array.from({ length: n }, (_, i) => {
    const a = num(lows[i]), b = num(highs[i]);
    const now = num(nows[i]);
    if (a === null || b === null) return { low: null, high: null, now };
    return a <= b ? { low: a, high: b, now } : { low: b, high: a, now };
  });
  const data = span.map((w) => (w.low !== null && w.high !== null ? (w.low + w.high) / 2 : w.now));
  const name = typeof s.name === "string" ? s.name : undefined;
  const unit = typeof s.unit === "string" ? s.unit : undefined;
  return { name, data, unit, right: false, span };
}
