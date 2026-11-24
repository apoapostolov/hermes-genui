// The horizontal-bar layout formulas, in one place. HBarChart.tsx draws with these; the export's picture
// (lib/export.ts hbarSvg) MEASURES what that drawing laid out instead of recomputing them — so an exported
// hbar cannot drift from the card the reader is looking at, and there is no second copy of the math to keep
// honest. (Round 2 rebuilt the picture from these formulas and got the coordinate system wrong on real grids;
// measurement removed the drift class entirely.)
import type { ChartSpec } from "./chartData";

export type HbarSpan = { lo: number; hi: number; span: number; zeroAt: number };

/** The scale every row shares: zero is always on the track; a span that works out to nothing is one wide. */
export function hbarSpan(spec: ChartSpec): HbarSpan {
  const values = spec.series.flatMap((s) => s.data.filter((v): v is number => v !== null));
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  return { lo, hi, span, zeroAt: (-lo / span) * 100 };  // where zero sits along the track, in %
}

/** A bar's box along the track, in %: at least a 1.5 sliver, so a tiny value still shows. */
export function hbarBarOf(v: number, span: number, zeroAt: number): { left: number; width: number } {
  const width = Math.max((Math.abs(v) / span) * 100, 1.5);
  return { left: v < 0 ? zeroAt - width : zeroAt, width };
}
