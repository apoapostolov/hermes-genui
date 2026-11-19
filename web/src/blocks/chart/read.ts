import { chartKind, isOnRightScale, kindToDraw, maxSeries, pieSlices, type ChartKind, type ChartSeries, type ChartSpec } from "./chartData";
import type { Trail } from "../../core/fields";

export type ChartBlock = { type: "chart"; spec: ChartSpec };

/**
 * chart: `kind` is line, bar, area, stacked, hbar, combo, pie or donut; any other kind, or none, draws a line.
 * Up to 3 series (stacked and area 6); a value that isn't a number is a gap (null).
 * Pie and donut: x names the slices and the first series holds their values; zero, negative and missing values are
 * dropped and past 8 slices the smallest merge into "Other" (pieSlices).
 * Combo: the first series is bars, the rest lines; a line with its own unit (or axis "right") gets a right-hand scale.
 *   {type: "chart", kind: "bar", x: ["Q1", "Q2"], series: [{name: "Rev", data: [1, 2]}]}
 *   → {type: "chart", spec: {type: "bar", x: ["Q1", "Q2"], series: [{name: "Rev", data: [1, 2], right: false}]}}
 * figure: false (a % change comparison, where a change of a change means nothing) drops the headline number and change
 * chip; only true or false count, anything else is ignored.
 *   {..., figure: false} → spec.figure false;  {..., figure: "false"} → no spec.figure (the default: shown)
 * tone: "change" (exactly that string) colours a one-series line by direction from its first value; anything else is
 * ignored.  {..., tone: "change"} → spec.tone "change";  {..., tone: "Change"} → no spec.tone
 * caveat: a limit of the data, trimmed and capped at 120 characters; shown on every kind and read by the text
 * fallback. xLabel and yLabel: axis captions, trimmed and capped at 40; pie and donut have no axis to name. On hbar
 * the single horizontal caption takes xLabel, or yLabel when only a value-axis name was written.
 * Dropped: no x labels, no series with a number, or a pie with no positive value.
 */
export function readChart(raw: any, here: Trail): ChartBlock | null {
  const spec = readSpec(raw);
  if (!spec) return here.drop("chart needs x labels and at least one series");
  return { type: "chart", spec };
}

/** A written caption as one line, trimmed and capped before it reaches the card; empty and whitespace-only are absent. */
function caption(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, max);
  return text || undefined;
}

function readSpec(d: any): ChartSpec | null {
  if (!Array.isArray(d.x) || !Array.isArray(d.series) || !d.series.length) return null;
  const type = chartKind(d.kind);
  const unit = typeof d.unit === "string" ? d.unit : undefined;
  let x: string[] = d.x.map(String);
  let series: ChartSeries[] = d.series
    .filter((s: any) => s && Array.isArray(s.data))
    .slice(0, maxSeries(type))
    .map((s: any, k: number) => readSeries(s, k, type, unit));
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
  const caveat = caption(d.caveat, 120);
  if (caveat) spec.caveat = caveat;
  if (type !== "pie" && type !== "donut") {
    const xLabel = caption(d.xLabel, 40);
    const yLabel = caption(d.yLabel, 40);
    const drawn = kindToDraw(spec);
    if (xLabel && drawn !== "hbar") spec.xLabel = xLabel;
    if (yLabel && drawn !== "hbar") spec.yLabel = yLabel;
    if (drawn === "hbar") {
      const valueLabel = xLabel ?? yLabel;
      if (valueLabel) spec.xLabel = valueLabel;
    }
  }
  if (d.stepped === true) spec.stepped = true;
  if (typeof d.height === "number" && isFinite(d.height)) spec.height = Math.round(Math.min(480, Math.max(120, d.height)));
  if (d.sortDesc === true && type === "bar") sortByFirstSeries(spec);
  return spec;
}

/** Reorder a bar chart's columns by the first series, largest first; gaps go last. */
function sortByFirstSeries(spec: ChartSpec): void {
  const values = spec.series[0]?.data ?? [];
  const order = spec.x.map((_, i) => i).sort((a, b) => {
    const av = values[a] ?? null, bv = values[b] ?? null;
    if (av === null && bv === null) return a - b;
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av || a - b;
  });
  spec.x = order.map((i) => spec.x[i]);
  spec.series = spec.series.map((s) => ({ ...s, data: order.map((i) => s.data[i] ?? null) }));
}

/** One series as written → its name, its numbers (anything else a gap), its own unit, and which scale it uses. */
function readSeries(s: any, k: number, type: ChartKind, chartUnit: string | undefined): ChartSeries {
  const name = typeof s.name === "string" ? s.name : undefined;
  const data = s.data.map((v: any) => (typeof v === "number" && isFinite(v) ? v : null));
  const unit = typeof s.unit === "string" ? s.unit : undefined;
  const right = isOnRightScale(type, k, unit, s.axis, chartUnit);
  return { name, data, unit, right };
}
