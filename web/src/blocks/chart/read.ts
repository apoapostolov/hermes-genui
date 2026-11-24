import { chartKind, isOnRightScale, kindToDraw, maxSeries, pieSlices, scatterPoints, waterfallBars,
  type ChartKind, type ChartPoint, type ChartSeries, type ChartSpan, type ChartSpec } from "./chartData";
import { clean, keepFirst, num, str, type Trail } from "../../core/fields";

export type ChartBlock = { type: "chart"; spec: ChartSpec };

// A scatter keeps up to 200 points a series: a longer list is a table, not a picture.
const SCATTER_POINTS = 200;

/**
 * chart: `kind` is line, bar, area, stacked, hbar, combo, pie, donut, scatter, waterfall, histogram or range; any
 * other kind, or none, draws a line.
 * Up to 3 series (stacked and area 6, scatter 2, waterfall 1, histogram 1, range 1); a value that isn't a number is a
 * gap (null).
 * Pie and donut: x names the slices and the first series holds their values; zero, negative and missing values are
 * dropped and past 8 slices the smallest merge into "Other" (pieSlices).
 * Combo: the first series is bars, the rest lines; a line with its own unit (or axis "right") gets a right-hand scale.
 * Histogram: x names the bins left to right and the first series holds their counts; a negative count is a gap, a zero
 * is a known zero.
 * Range: one series holding `low` and `high` per x (both numbers or both null) and optionally `now`, the dot; the
 * window's ends are read lower-first, so a pair written the other way still draws.
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
 *   {type: "chart", kind: "range", x: ["Mon"], series: [{low: [18], high: [34], now: [26]}]}
 *   → spec.series [{data: [26], span: [{low: 18, high: 34, now: 26}]}]
 *   {type: "chart", kind: "range", series: [{points: [{label: "Mon", low: 18, high: 34, now: 26}]}]}
 *   → same shape, x taken from the point labels
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
  const type = chartKind(raw?.kind);
  const points = type === "scatter" || type === "waterfall";
  const spec = points ? readPoints(raw, type, here) : readSpec(raw);
  if (!spec) return points ? null : here.drop("chart needs x labels and at least one series");  // readPoints said why
  return { type: "chart", spec };
}

/** A written caption as one line, trimmed and capped before it reaches the card (a cut one ends with "…");
 *  empty and whitespace-only are absent. */
function caption(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function readSpec(d: any): ChartSpec | null {
  const rawSeries = Array.isArray(d.series) ? d.series : [];
  const type = chartKind(d.kind);
  const unit = typeof d.unit === "string" ? d.unit : undefined;
  const range = type === "range";
  let seriesInput = rawSeries;
  if (range && Array.isArray(d.points)) {
    const first = rawSeries[0] && typeof rawSeries[0] === "object" ? rawSeries[0] : {};
    if (!Array.isArray((first as any).points) && !Array.isArray((first as any).low) && !Array.isArray((first as any).high)) {
      seriesInput = [{ ...first, points: d.points }, ...rawSeries.slice(1)];
    }
  }
  if (!seriesInput.length) return null;
  let x: string[] = Array.isArray(d.x) ? d.x.map(String) : [];
  let series: ChartSeries[] = seriesInput
    .filter((s: any) => s && (Array.isArray(s.data) || (range && (Array.isArray(s.low) || Array.isArray(s.high) || Array.isArray(s.points)))))
    .slice(0, maxSeries(type))
    .map((s: any, k: number) => (range ? readSpanSeries(s, x) : readSeries(s, k, type, unit)));
  if (range && !x.length && series[0]?.span?.length) {
    const points = (seriesInput[0] as any)?.points;
    x = series[0].span.map((_, i) => {
      const p = Array.isArray(points) ? points[i] : undefined;
      const label = p && typeof p === "object" ? p.label ?? p.x : undefined;
      return label === undefined || label === null ? `Point ${i + 1}` : String(label);
    });
  }
  if (!x.length) return null;
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
  let rawSeries = Array.isArray(d.series) ? d.series : [];
  if (Array.isArray(d.points)) {
    const first = rawSeries[0] && typeof rawSeries[0] === "object" ? rawSeries[0] : {};
    if (!Array.isArray((first as any).points)) rawSeries = [{ ...first, points: d.points }, ...rawSeries.slice(1)];
  }
  if (!rawSeries.length) {
    return here.drop(type === "scatter" ? "scatter needs series with points" : "waterfall needs series with points");
  }
  const series = keepFirst(rawSeries, maxSeries(type), here, `${type} series`)
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
  if (d.sortDesc === true && (type === "bar" || type === "hbar")) sortByFirstSeries(spec);
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

/** A range series as written → one window per x label plus the name, the unit and the middle of each window as `data`.
 *  Accepts the array form (low/high/now arrays keyed to x) and the points form the guide shows
 *  ({label, low, high, now} per point). The ends are read lower-first; a window missing one end is no window (null),
 *  and its dot may still be there. */
function readSpanSeries(s: any, x: string[]): ChartSeries {
  const points = Array.isArray(s.points) ? s.points : null;
  const usePoints = points && !Array.isArray(s.low) && !Array.isArray(s.high);
  const n = usePoints ? points!.length : x.length;
  const lows: unknown[] = Array.isArray(s.low) ? s.low : [];
  const highs: unknown[] = Array.isArray(s.high) ? s.high : [];
  const nows: unknown[] = Array.isArray(s.now) ? s.now : [];
  const span: ChartSpan[] = Array.from({ length: n }, (_, i) => {
    const p = usePoints && points![i] && typeof points![i] === "object" ? points![i] as any : null;
    const a = num(usePoints ? p?.low : lows[i]), b = num(usePoints ? p?.high : highs[i]);
    const now = num(usePoints ? p?.now : nows[i]);
    if (a === null || b === null) return { low: null, high: null, now };
    return a <= b ? { low: a, high: b, now } : { low: b, high: a, now };
  });
  const data = span.map((w) => (w.low !== null && w.high !== null ? (w.low + w.high) / 2 : w.now));
  const name = typeof s.name === "string" ? s.name : undefined;
  const unit = typeof s.unit === "string" ? s.unit : undefined;
  return { name, data, unit, right: false, span };
}
