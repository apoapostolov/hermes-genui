import { chartKind, isOnRightScale, maxSeries, pieSlices, scatterPoints, waterfallBars,
  type ChartKind, type ChartPoint, type ChartSeries, type ChartSpec } from "./chartData";
import { clean, keepFirst, num, str, type Trail } from "../../core/fields";

export type ChartBlock = { type: "chart"; spec: ChartSpec };

// A scatter keeps up to 200 points a series: a longer list is a table, not a picture.
const SCATTER_POINTS = 200;

/**
 * chart: `kind` is line, bar, area, stacked, hbar, combo, pie, donut, scatter or waterfall; any other kind, or none,
 * draws a line.
 * Up to 3 series (stacked and area 6, scatter 2, waterfall 1); a value that isn't a number is a gap (null).
 * Pie and donut: x names the slices and the first series holds their values; zero, negative and missing values are
 * dropped and past 8 slices the smallest merge into "Other" (pieSlices).
 * Combo: the first series is bars, the rest lines; a line with its own unit (or axis "right") gets a right-hand scale.
 *   {type: "chart", kind: "bar", x: ["Q1", "Q2"], series: [{name: "Rev", data: [1, 2]}]}
 *   → {type: "chart", spec: {type: "bar", x: ["Q1", "Q2"], series: [{name: "Rev", data: [1, 2], right: false}]}}
 * Scatter: x labels aren't read; each series holds points of two numbers, and a point without a number along the
 * bottom is dropped (nothing places it). A point whose y is missing or isn't a number stays as unknown and is not
 * drawn. The title names the axes: "Price against mileage" plots price up the side, mileage along the bottom.
 *   {type: "chart", kind: "scatter", series: [{name: "Cars", points: [{x: 62, y: 1.2, label: "Maruti 800"}]}]}
 *   → spec.x [], one series with points [{x: 62, y: 1.2, label: "Maruti 800"}]
 * Waterfall: each point is a labelled step (value) or a total; only total: true counts, so total: "true" is a step.
 * The x labels are the points' names ("Step 3" when a point has none), and a step without a number stays unknown.
 *   {..., kind: "waterfall", series: [{points: [{label: "Revenue", value: 120, total: true}, {label: "Returns", value: -8}]}]}
 *   → spec.series[0].points as read, spec.x ["Revenue", "Returns"]
 * figure: false (a % change comparison, where a change of a change means nothing) drops the headline number and change
 * chip; only true or false count, anything else is ignored.
 *   {..., figure: false} → spec.figure false;  {..., figure: "false"} → no spec.figure (the default: shown)
 * tone: "change" (exactly that string) colours a one-series line by direction from its first value; anything else is
 * ignored.  {..., tone: "change"} → spec.tone "change";  {..., tone: "Change"} → no spec.tone
 * Dropped: no x labels, no series with a number, or a pie with no positive value.
 */
export function readChart(raw: any, here: Trail): ChartBlock | null {
  const type = chartKind(raw?.kind);
  const points = type === "scatter" || type === "waterfall";
  const spec = points ? readPoints(raw, type, here) : readSpec(raw);
  if (!spec) return points ? null : here.drop("chart needs x labels and at least one series");  // readPoints said why
  return { type: "chart", spec };
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
  return specOf(d, type, x, series, unit);
}

/**
 * A scatter's or a waterfall's series, read from their points. The series past the kind's cap and the points past a
 * scatter's 200 are dropped with a note, and so is a point nothing can be drawn from.
 *   scatter: 3 series → 2 kept, one note;  a point without an x → dropped, "a point needs a number on both scales"
 *   waterfall: 2 series → 1 kept;  no point with a value or a total → the block is dropped
 */
function readPoints(d: any, type: "scatter" | "waterfall", here: Trail): ChartSpec | null {
  if (!Array.isArray(d.series) || !d.series.length) {
    return here.drop(type === "scatter" ? "scatter needs series with points" : "waterfall needs series with points");
  }
  const series = keepFirst(d.series, maxSeries(type), here, `${type} series`)
    .map((s: any, k: number) => (type === "scatter" ? readScatterSeries(s, k, here) : readWaterfallSeries(s, here)));
  if (type === "scatter") {
    if (!scatterPoints(series).length) return here.drop("scatter needs a point with a number on both scales");
    return specOf(d, type, [], series, d.unit);
  }
  const points = series[0].points ?? [];
  if (waterfallBars(points).every((bar) => bar === null)) return here.drop("waterfall needs a point with a value or a total");
  const x = points.map((p, i) => p.label ?? (p.total ? `Total ${i + 1}` : `Step ${i + 1}`));
  return specOf(d, type, x, series, d.unit);
}

function specOf(d: any, type: ChartKind, x: (string | number)[], series: ChartSeries[], unit: unknown): ChartSpec {
  const spec: ChartSpec = { type, title: typeof d.title === "string" ? d.title : undefined, x, series,
    unit: typeof unit === "string" ? unit : undefined, source: typeof d.source === "string" ? d.source : undefined };
  if (typeof d.figure === "boolean") spec.figure = d.figure;
  if (d.tone === "change") spec.tone = "change";
  return spec;
}

/** One series as written → its name, its numbers (anything else a gap), its own unit, and which scale it uses. */
function readSeries(s: any, k: number, type: ChartKind, chartUnit: string | undefined): ChartSeries {
  const name = typeof s.name === "string" ? s.name : undefined;
  const data = s.data.map((v: any) => (typeof v === "number" && isFinite(v) ? v : null));
  const unit = typeof s.unit === "string" ? s.unit : undefined;
  const right = isOnRightScale(type, k, unit, s.axis, chartUnit);
  return { name, data, unit, right };
}

/** A scatter's series: its name and the points that have a number along the bottom, in the order written. */
function readScatterSeries(s: any, k: number, here: Trail): ChartSeries {
  const raw = Array.isArray(s?.points) ? s.points : [];
  const points = keepFirst(raw, SCATTER_POINTS, here.at(`series.${k}`), "points").flatMap((p: any, i: number) => {
    const point = readScatterPoint(p, here.at(`series.${k}.points.${i}`));
    return point ? [point] : [];
  });
  return { name: typeof s?.name === "string" ? s.name : undefined, data: [], points };
}

/** A scatter point: its x (a point without one has no place on the drawing), its y (null when unknown), its name. */
function readScatterPoint(raw: any, here: Trail): ChartPoint | null {
  const x = num(raw?.x);
  if (x === null) return here.drop("a point needs a number on both scales");
  return clean({ x, y: num(raw?.y), label: str(raw?.label, 40) });
}

/** A waterfall's series: its name and every point, since an unknown step keeps its place and its label. */
function readWaterfallSeries(s: any, here: Trail): ChartSeries {
  const raw = Array.isArray(s?.points) ? s.points : [];
  const points = raw.flatMap((p: any, i: number) => {
    const point = readWaterfallPoint(p, here.at(`points.${i}`));
    return point ? [point] : [];
  });
  return { name: typeof s?.name === "string" ? s.name : undefined, data: [], points };
}

/** A waterfall point: its label, its signed step (null when unknown) and whether it is a total (`total: true` only). */
function readWaterfallPoint(raw: any, here: Trail): ChartPoint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return here.drop("a point is an object with a label and a value");
  return clean({ label: str(raw.label, 40), value: num(raw.value), total: raw.total === true ? true : undefined });
}
