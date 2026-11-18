// Headline numbers: a kpis row of cards (each at most 200px wide), or one stat card. A card holds its label, the big
// number, a coloured change line and, when given a trend, a small line of it.
import { fmt, partColour, SHORT_FROM } from "../chart/chartData";
import { formatAmount, formatChange, formatNumber } from "../../lib/format";
import type { KpiItem } from "./read";

/** A whole number from 1800 to 2100 with no unit reads as a year, so it gets no thousands separator.
 *  {value: 1986} → true;  {value: 1986, unit: "₹"} → false;  {value: 1986.5} → false;  {value: 2500} → false */
function isYear(k: KpiItem): boolean {
  return typeof k.value === "number" && !k.unit && Number.isInteger(k.value) && k.value >= 1800 && k.value <= 2100;
}

// A unit that is a currency sign on its own: its amounts shorten with the sign in front ("$4.21B", "₹18.4L").
const CURRENCY = /^[$₹€£¥]$/;

/**
 * A kpi value as it reads: money units through formatAmount, % stuck to the number, other units after it. The number
 * is in the user's locale (rupees stay Indian), shortened from 100,000 up unless `full` is asked for (the hover).
 * A null value reads "no data": nothing was measured, so it is not written as 0 or as a bare dash.
 *   {value: 72275, unit: "₹Cr"} → "₹72,275 Cr";  {value: 18.6, unit: "%"} → "18.6%" (in de-DE "18,6%");
 *   {value: 9, unit: "/10"} → "9/10";  {value: 24310.5, unit: "pts"} → "24,311 pts" (in de-DE "24.311 pts")
 *   {value: 4213500000, unit: "$"} → "$4.21B" (full: "$4,213,500,000");  {value: 250000, unit: "pts"} → "250K pts"
 *   {value: null, unit: "₹"} → "no data"
 */
export function kpiValue(k: KpiItem, { full = false }: { full?: boolean } = {}): string {
  if (k.value === null) return "no data";
  if (typeof k.value === "string") return k.value;
  if (isYear(k)) return String(k.value);
  const short = !full && Math.abs(k.value) >= SHORT_FROM;
  if (short && k.unit && CURRENCY.test(k.unit)) return fmt(k.value, k.unit);
  const money = formatAmount(k.value, k.unit);
  if (money !== null) return money;
  const plain = short ? fmt(k.value) : formatNumber(k.value, { digits: Math.abs(k.value) >= 1000 ? 0 : 1 });
  const attached = k.unit === "%" || k.unit?.startsWith("/");  // "18.6%", "9/10"; other units after a space
  return attached ? `${plain}${k.unit}` : k.unit ? `${plain} ${k.unit}` : plain;
}

/** One card. `trendColour` colours its trend line; without it the line takes the first chart colour. A card whose
 *  value is unknown says "no data" in the quiet text colour, so it doesn't read as a figure. */
export function KpiCard({ item, trendColour }: { item: KpiItem; trendColour?: string }) {
  const shown = kpiValue(item);
  const full = kpiValue(item, { full: true });
  const change = formatChange(item.change, item.change_unit);
  const isText = typeof item.value === "string";
  const empty = item.value === null;
  const valueClass = ["hb-kpi-value", isText ? "hb-kpi-value-text" : "", empty ? "hb-kpi-value-empty" : ""].filter(Boolean).join(" ");
  return (
    <div className="hb-card hb-kpi">
      <div className="hb-kpi-label">{item.label}</div>
      <div className={valueClass} title={full !== shown ? full : undefined}>
        {shown}
      </div>
      {change && <div className={changeClass(item)}>{change}</div>}
      {item.trend && <Sparkline values={item.trend} colour={trendColour} />}
    </div>
  );
}

/** A row of cards. When two or more have a trend, each trend line takes the chart colour of its card's place (the
 *  1st card's blue, the 2nd's amber …), so a comparison's cards match its chart's lines, which come in the same
 *  order. A lone trend keeps the first colour. */
export function Kpis({ items }: { items: KpiItem[] }) {
  const several = items.filter((k) => k.trend).length >= 2;
  return (
    <div className="hb-kpis">
      {items.map((k, i) => <KpiCard key={i} item={k} trendColour={several ? partColour(i) : undefined} />)}
    </div>
  );
}

/** The chip's classes: which way it moved, and `hb-kpi-invert` when a fall is the good news (the stylesheet swaps the
 *  tone the two directions get). A change of zero is flat: no arrow, no tone.
 *  {change: -0.9} → "hb-kpi-change hb-kpi-down";  {change: 0} → "hb-kpi-change hb-kpi-flat";
 *  {change: -0.9, invert_tone: true} → "hb-kpi-change hb-kpi-down hb-kpi-invert" */
function changeClass(item: KpiItem): string {
  const change = item.change ?? 0;
  const direction = change > 0 ? "hb-kpi-up" : change < 0 ? "hb-kpi-down" : "hb-kpi-flat";
  return `hb-kpi-change ${direction}${item.invert_tone ? " hb-kpi-invert" : ""}`;
}

// The sparkline's drawing box; the SVG stretches it to the card's width (the stroke keeps its thickness).
const SPARK_W = 120;
const SPARK_H = 28;
const SPARK_PAD = 2;

/** A trend as a small line under the number: no axes, no labels, hidden from screen readers (the number says it). */
function Sparkline({ values, colour }: { values: (number | null)[]; colour?: string }) {
  return (
    <svg className="hb-kpi-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={sparkPath(values)} style={colour ? { stroke: colour } : undefined} />
    </svg>
  );
}

/**
 * The line's path across the box, the highest value at the top and the lowest at the bottom (2px in from each edge);
 * a flat trend runs across the middle. Every point keeps its slot, so a null leaves its place empty and the line
 * breaks there rather than joining the points either side of a stretch nobody measured.
 *   [0, 10] → "M0 26L120 2";  [0, 10, 5] → "M0 26L60 2L120 14";  [5, 5] → "M0 14L120 14";
 *   [0, null, 10] → "M0 26M120 2" (two strokes, no line across the gap)
 */
export function sparkPath(values: (number | null)[]): string {
  const known = values.filter((v): v is number => v !== null);
  if (!known.length) return "";
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  const span = SPARK_H - 2 * SPARK_PAD;
  const y = (v: number) => (hi === lo ? SPARK_H / 2 : SPARK_PAD + (1 - (v - lo) / (hi - lo)) * span);
  const x = (i: number) => (i / (values.length - 1)) * SPARK_W;
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${round(x(i))} ${round(y(v))}`;
    pen = true;
  });
  return d;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
