// Where everything goes in an up-and-down chart (line, bar, area, stacked, combo), worked out from the spec and the
// width it has on screen: the plot's edges, where a label or value sits, how wide a column is, which x labels and
// value labels are written, and the labels at the ends of lines. Also what the hover card says at a point.
import { fmt, kindToDraw, partColour, seriesName, type ChartSeries, type ChartSpec } from "./chartData";
import { columnLayout, niceTicks, spreadLabels, textWidth, xLabelsShown } from "./geometry";
import { formatChange } from "../../lib/format";
import type { Tip } from "./ChartTip";

type Scale = { min: number; max: number };

/** A label at the right end of a line: its text, the height of its dot and of its text, and their colours. */
export type EndLabel = { series: number; at: number; text: string; dotY: number; y: number; dot: string; ink: string };

export type XYLayout = {
  W: number; H: number;
  /** The plot's edges: left and right x, top and bottom (base) y. */
  left: number; right: number; top: number; base: number;
  /** Whether each x label owns a column (bars, stacked, combo) rather than a point on a line; a column's width. */
  slotted: boolean; bar: number;
  xAt: (i: number) => number; yAt: (v: number) => number;
  /** The y of a value on a series's own scale (a combo's line may use the right one). */
  yOf: (s: ChartSeries) => (v: number) => number;
  xLabels: number[]; valueLabels: boolean; ends: EndLabel[];
  /** The values of the faint gridlines, written on the left (several lines only); empty for none. */
  ticks: number[];
};

const COLUMNS_H = 210, LINES_H = 220;   // the drawing's height in px
const TOP = 10, BOTTOM = 26, VALUE_ROOM = 16, SIDE = 8;
const X_TITLE_ROOM = 16, Y_TITLE_ROOM = 14;  // an axis caption grows the drawing; the plot keeps its own height
const MAX_VALUE_LABELS = 12, LINE_LABEL_GAP = 80, END_NAME_MAX = 16;
/** The gap between a gridline's value, written on the left, and the plot. */
export const TICK_GAP = 8;

/** Whether a chart is a one-series line coloured by direction from its first value (tone "change"). */
export function isChangeLine(spec: ChartSpec): boolean {
  return spec.type === "line" && spec.tone === "change" && spec.series.length === 1;
}

/** The first value of a series and the index of its last one, gaps skipped; null and -1 when it has none. */
export function seriesEnds(data: (number | null)[]): { first: number | null; last: number } {
  const first = data.find((v): v is number => v !== null) ?? null;
  let last = data.length - 1;
  while (last >= 0 && data[last] === null) last--;
  return { first, last };
}

/** A series's colour at a value: a change line's green or orange around its start, otherwise its place in the palette. */
export function valueColour(spec: ChartSpec, k: number, v: number): string {
  if (!isChangeLine(spec)) return partColour(k);
  const start = seriesEnds(spec.series[0].data).first ?? v;
  return v >= start ? "var(--hb-good)" : "var(--hb-warn)";
}

const unitOf = (spec: ChartSpec, s: ChartSeries) => s.unit ?? spec.unit;

/**
 * The layout for a chart drawn `width` px wide against its scales (chartScales). Columns are 210px high and lines
 * 220px. Bars carry their values on top when there are 12 or fewer (bars x series) and each value fits over its bar.
 * A line ends in its last value (one series) or each series's name (several), which takes room on the right.
 * Several lines also get faint gridlines at round values, written on the left, and the scale runs from the lowest to
 * the highest of them, so the gap between the lines reads without hovering.
 *   5 bars at 600px → 96px slots centred, values on top;  53 weekly points → about every 7th x label;
 *   two lines from 0% to 18.5% and -4.2% → gridlines at -10%, 0%, 10%, 20%
 */
export function xyLayout(spec: ChartSpec, width: number, scales: { left: Scale; right: Scale | null }): XYLayout {
  const n = spec.x.length;
  const slotted = spec.type === "bar" || spec.type === "stacked" || spec.type === "combo";
  const drawn = kindToDraw(spec);
  const hasAxis = drawn !== "hbar" && drawn !== "pie" && drawn !== "donut";
  const xRoom = hasAxis && spec.xLabel ? X_TITLE_ROOM : 0;
  const yRoom = hasAxis && spec.yLabel ? Y_TITLE_ROOM : 0;
  const H = (spec.height ?? (slotted ? COLUMNS_H : LINES_H)) + xRoom + yRoom;
  const base = H - BOTTOM - xRoom;
  const endTexts = spec.type === "line" ? lineEndTexts(spec) : [];
  const ticks = gridTicks(spec);
  const tickRoom = ticks.length ? TICK_GAP + Math.max(...ticks.map((t) => textWidth(fmt(t, spec.unit)))) : 0;
  const left = (slotted ? 4 : SIDE) + tickRoom;
  const endRoom = endTexts.length ? Math.min(110, 14 + Math.max(...endTexts.map((e) => textWidth(e.text, 11.5)))) : 0;
  const right = width - (endRoom || (slotted ? 4 : SIDE));
  const plotWidth = right - left;

  const perSlot = spec.type === "bar" ? spec.series.length : 1;
  const columns = columnLayout(plotWidth, n, perSlot);
  const xAt = (i: number) => slotted
    ? left + columns.start + columns.slot * (i + 0.5)
    : left + (n === 1 ? plotWidth / 2 : (plotWidth * i) / (n - 1));
  const step = slotted ? columns.slot : n > 1 ? plotWidth / (n - 1) : 0;

  const valueLabels = spec.type === "bar" && n * perSlot <= MAX_VALUE_LABELS
    && spec.series.every((s) => s.data.every((v) => v === null || textWidth(fmt(v, unitOf(spec, s)), 11.5) <= columns.slot / perSlot));
  const top = TOP + (valueLabels ? VALUE_ROOM : 0) + yRoom;
  const scaleY = ({ min, max }: Scale) => (v: number) => top + (base - top) * (1 - (v - min) / (max - min || 1));
  const yAt = scaleY(ticks.length ? { min: ticks[0], max: ticks[ticks.length - 1] } : scales.left);
  const yRight = scales.right ? scaleY(scales.right) : yAt;
  const yOf = (s: ChartSeries) => (s.right ? yRight : yAt);

  const longest = Math.max(...spec.x.map((label) => textWidth(String(label))));
  const minGap = slotted ? longest + 8 : Math.max(LINE_LABEL_GAP, longest + 12);
  const xLabels = xLabelsShown(n, step, minGap);

  const dotYs = endTexts.map((e) => yAt(e.value));
  const textYs = spreadLabels(dotYs, 14, base);
  const placedEnds = endTexts.map((e, j) => ({ series: e.series, at: e.at, text: e.text, dotY: dotYs[j], y: textYs[j],
    dot: valueColour(spec, e.series, e.value), ink: spec.series.length === 1 ? "var(--hb-ink)" : partColour(e.series) }));

  return { W: width, H, left, right, top, base, slotted, bar: columns.bar, xAt, yAt, yOf, xLabels, valueLabels,
    ends: placedEnds, ticks };
}

/** The gridline values for a chart with several lines, from its lowest value to its highest; none for anything else
 *  (one line reads from its end label and the hover card). */
function gridTicks(spec: ChartSpec): number[] {
  if (spec.type !== "line" || spec.series.length < 2) return [];
  const values = spec.series.flatMap((s) => s.data.filter((v): v is number => v !== null));
  return values.length ? niceTicks(Math.min(...values), Math.max(...values)) : [];
}

// A change line's Start label: its baseline sits 6px above the dashed line or 14px below it; its letters are about 9px
// tall, and below it may reach 6px past the plot's bottom before it meets the x labels.
const START_ABOVE = 6, START_BELOW = 14, LETTER_H = 9, BELOW_ROOM = 6;

/**
 * Where a change line's "Start 23,440" label goes, so the line doesn't run through it: on the side of the dashed
 * start line that the series leaves free under the label (it climbs there → below; it falls or stays flat → above),
 * unless that side is off the drawing. Returns the text's baseline. `points` is the series in drawing units, `from`
 * and `to` the label's x span, `y` the dashed line's height and `base` the plot's bottom.
 *   line at 100, series climbs to 40 under the label → 114 (below);  falls to 160 → 94 (above)
 *   line at 190 with base 194, series climbs → 184 (above: below would sit on the x labels)
 */
export function startLabelY(points: [number, number][], from: number, to: number, y: number, base: number): number {
  const ys = heightsUnder(points, from, to);
  const rise = y - Math.min(y, ...ys);   // how far the series climbs above the start under the label (y grows down)
  const fall = Math.max(y, ...ys) - y;
  const above = y - START_ABOVE;
  const below = y + START_BELOW;
  if (rise > fall) return below <= base + BELOW_ROOM ? below : above;
  return above - LETTER_H >= 0 ? above : below;
}

/** A line's heights between x `from` and `to`: each point there, and where the line crosses either edge.
 *  [[0, 100], [100, 0]] from 10 to 20 → [90, 80] */
function heightsUnder(points: [number, number][], from: number, to: number): number[] {
  const ys: number[] = [];
  points.forEach(([x, y], j) => {
    if (x >= from && x <= to) ys.push(y);
    const next = points[j + 1];
    if (!next) return;
    for (const edge of [from, to]) {
      if (x < edge && next[0] > edge) ys.push(y + ((next[1] - y) * (edge - x)) / (next[0] - x));
    }
  });
  return ys;
}

/** What each line ends in: its last value when it is the only series, else its name (shortened past 16 letters). */
function lineEndTexts(spec: ChartSpec): { series: number; at: number; value: number; text: string }[] {
  const one = spec.series.length === 1;
  return spec.series.flatMap((s, k) => {
    const at = seriesEnds(s.data).last;
    if (at < 0) return [];
    const value = s.data[at] as number;
    const name = seriesName(spec.series, k);
    const text = one ? fmt(value, unitOf(spec, s)) : name.length > END_NAME_MAX ? `${name.slice(0, END_NAME_MAX - 1)}…` : name;
    return [{ series: k, at, value, text }];
  });
}

/**
 * The hover card at x label i: the label, each series's value there in full (gaps left out), and for a one-series
 * line a note of its change since the start. Bars get no share note: only a pie's slices are parts of a whole.
 *   bars [4213500000, 6320250000] at 0 → "Q1", Revenue 4,213,500,000, no note
 *   line [100, 104.2] at 1 → Value 104.2, "▲ 4.2% since start"
 */
export function xyTip(spec: ChartSpec, i: number, layout: XYLayout): Tip {
  const rows: Tip["rows"] = [];
  let y = layout.base;
  let pile = 0;
  spec.series.forEach((s, k) => {
    const v = s.data[i] ?? null;
    if (v === null) return;
    rows.push({ colour: valueColour(spec, k, v), name: seriesName(spec.series, k), value: fmt(v, unitOf(spec, s), { full: true }) });
    pile += Math.max(v, 0);
    y = Math.min(y, layout.yOf(s)(spec.type === "stacked" || spec.type === "area" ? pile : v));
  });
  return { x: layout.xAt(i), y, title: String(spec.x[i]), rows, note: rows.length ? tipNote(spec, i) : "no data" };
}

/** The hover card's note: a one-line chart says how far the picked value has moved since its start, and a label no
 *  series measured says there is no data there (a null is never shown as a zero). */
function tipNote(spec: ChartSpec, i: number): string | undefined {
  if (spec.series.length !== 1 || spec.type !== "line") return undefined;
  const data = spec.series[0].data;
  const v = data[i] ?? null;
  const start = data.findIndex((d) => d !== null);
  const first = data[start] as number;
  if (v === null || i <= start || first === 0) return undefined;
  return `${formatChange(((v - first) / Math.abs(first)) * 100)} since start`;
}
