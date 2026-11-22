// Where the marks of an up-and-down chart go: which x labels fit, the columns' slots and widths, a column's outline,
// a line straight or smooth, and end labels pushed apart. Pure sums, so the drawings stay simple and testable.

/** About how wide a label is, in px, at a font size: an average glyph width, enough to keep labels from touching.
 *  "Q1" → 13.2;  "12 Oct" → 39.6 */
export function textWidth(text: string, size = 11): number {
  return text.length * size * 0.6;
}

/**
 * Which x labels are written: the first, then every k-th, so neighbours are at least `minGap` px apart (`step` is the
 * distance between two points).
 *   (4 points 150px apart, gap 80) → [0, 1, 2, 3];  (12, 50, 80) → [0, 2, 4, 6, 8, 10];  (1, 0, 80) → [0]
 */
export function xLabelsShown(n: number, step: number, minGap: number): number[] {
  if (n <= 1 || step <= 0) return [0];
  const every = Math.max(1, Math.ceil(minGap / step));
  const shown: number[] = [];
  for (let i = 0; i < n; i += every) shown.push(i);
  return shown;
}

const MAX_SLOT = 96, MIN_BAR = 14, MAX_BAR = 56;

/**
 * Columns: each x label owns a slot at most 96px wide, and a group of slots that doesn't fill the plot sits in its
 * middle instead of spreading out. A bar is 60% of the slot shared among the series, kept between 14 and 56px, but
 * never so wide that the group spills out of its slot.
 *   (plot 600, 5 labels, 1 series) → slot 96, bar 56, start 60 (the group is 480 wide);  (300, 12, 1) → bar 15
 */
export function columnLayout(plotWidth: number, n: number, seriesCount: number): { slot: number; bar: number; start: number } {
  const slot = Math.min(plotWidth / Math.max(n, 1), MAX_SLOT);
  const wanted = Math.min(Math.max((slot * 0.6) / seriesCount, MIN_BAR), MAX_BAR);
  const bar = Math.min(wanted, (slot * 0.9) / seriesCount);
  return { slot, bar, start: (plotWidth - slot * n) / 2 };
}

/**
 * A column's outline from its base to its end, the end's two corners rounded (radius 4, less for a thin or short
 * column): the top for a value above the base, the bottom for one below it.
 *   (x 10, width 20, base 100, end 40) → "M10,100V44Q10,40 14,40H26Q30,40 30,44V100Z"
 */
export function barPath(x: number, width: number, base: number, end: number, radius = 4): string {
  const f = (n: number) => +n.toFixed(1);
  const r = Math.min(radius, width / 2, Math.abs(base - end));
  const toward = end < base ? 1 : -1;  // from the end back toward the base
  const x2 = x + width;
  return `M${f(x)},${f(base)}V${f(end + toward * r)}Q${f(x)},${f(end)} ${f(x + r)},${f(end)}`
    + `H${f(x2 - r)}Q${f(x2)},${f(end)} ${f(x2)},${f(end + toward * r)}V${f(base)}Z`;
}

/** A point in drawing units. */
export type Point = [number, number];

/** A stretch of a series with no gap in it: where it starts in the data, and the points to join. */
export type Run = { from: number; pts: Point[] };

const STRAIGHT_UP_TO = 12;

/**
 * The points a line may join, split where the data has a gap: a null ends one stretch and the next known point starts
 * another. A stretch of one point is an observation a line can't reach (the drawings put a dot there), never a line
 * back across the gap. Gaps are skipped in place, so every point keeps the x of its own label.
 *   [[0, 10], [5, 20], [10, 15]] → [{from: 0, pts: the three}]
 *   [[0, 10], null, [20, 17]] → [{from: 0, pts: [[0, 10]]}, {from: 2, pts: [[20, 17]]}]
 */
export function lineRuns(pts: (Point | null)[]): Run[] {
  const runs: Run[] = [];
  let run: Run | null = null;
  pts.forEach((p, i) => {
    if (p === null) {
      run = null;
      return;
    }
    if (!run) {
      run = { from: i, pts: [] };
      runs.push(run);
    }
    run.pts.push(p);
  });
  return runs;
}

/** A line through the points: straight segments for 12 points or fewer, so each value sits where it reads, and a
 *  smooth curve for longer series. [[0, 10], [5, 20], [10, 15]] → "M0,10L5,20L10,15" */
export function linePath(pts: [number, number][], stepped = false): string {
  if (stepped) return steppedPath(pts);
  if (pts.length > STRAIGHT_UP_TO) return smoothPath(pts);
  const f = (n: number) => +n.toFixed(1);
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)},${f(y)}`).join("");
}

/** A stepped line: hold each value until the next x label, then jump. [[0,10],[5,20]] → "M0,10L5,10L5,20". */
function steppedPath(pts: [number, number][]): string {
  if (!pts.length) return "";
  const f = (n: number) => +n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${f(pts[i][0])},${f(pts[i - 1][1])}L${f(pts[i][0])},${f(pts[i][1])}`;
  return d;
}

/** A smooth line through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(pts: [number, number][]): string {
  if (!pts.length) return "";
  const f = (n: number) => +n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

/**
 * Heights for labels at the right end of several lines, pushed apart so neighbours are at least `gap` px apart and
 * keep their top-to-bottom order; if that pushes the lowest past `bottom`, they move back up together. Returned in
 * the order given.
 *   ([50, 55, 120]) → [50, 64, 120];  ([100, 100], 14, 105) → [91, 105]
 */
export function spreadLabels(ys: number[], gap = 14, bottom = Infinity): number[] {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const placed = order.map((i) => ys[i]);
  for (let k = 1; k < placed.length; k++) placed[k] = Math.max(placed[k], placed[k - 1] + gap);
  if (placed.length && placed[placed.length - 1] > bottom) {
    placed[placed.length - 1] = bottom;
    for (let k = placed.length - 2; k >= 0; k--) placed[k] = Math.min(placed[k], placed[k + 1] - gap);
  }
  const out = new Array<number>(ys.length);
  order.forEach((i, k) => (out[i] = placed[k]));
  return out;
}

/**
 * Round values for a value axis: about `steps` equal steps of 1, 2, 2.5 or 5 times a power of ten, from at or below
 * the lowest value to at or above the highest. A single value is opened out by 1 either way.
 *   (-4.2, 18.5) → [-10, 0, 10, 20];  (0, 30) → [0, 10, 20, 30];  (0.12, 0.31) → [0.1, 0.2, 0.3, 0.4]
 *   (5, 5) → [4, 5, 6]
 */
export function niceTicks(lo: number, hi: number, steps = 3): number[] {
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  const raw = (hi - lo) / steps;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = power * ([1, 2, 2.5, 5].find((f) => raw / power <= f) ?? 10);
  const ticks: number[] = [];
  for (let k = Math.floor(lo / step); k <= Math.ceil(hi / step); k++) ticks.push(+(k * step).toFixed(10));
  return ticks;
}
