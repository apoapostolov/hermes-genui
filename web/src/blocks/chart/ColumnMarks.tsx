// Column charts' marks: bars (each series its own colour, values printed on top when few), stacked bars, and a
// combo's bars with its lines. Columns are rounded only at their far end and stand on a baseline; while one column
// is picked the others fade. A gap (null) draws no bar: a tick at the baseline marks the place, so a missing value
// isn't read as a zero.
import type { Band, ChartSpec } from "./chartData";
import { fmt, partColour } from "./chartData";
import { barPath, linePath, lineRuns, type Point } from "./geometry";
import type { XYLayout } from "./layout";

type Props = { spec: ChartSpec; layout: XYLayout; hover: number | null };

const SERIES_GAP = 2;  // between the bars of one group

/** How strongly column i shows while `hover` is picked: the picked one fully, the rest faded. */
const shade = (hover: number | null, i: number) => (hover === null || hover === i ? 1 : 0.55);

/** Where a column has no value: a short tick on the baseline, never a bar (a zero bar has no height either). */
export function GapTick({ x, width, zero }: { x: number; width: number; zero: number }) {
  const w = Math.min(4, width);
  return <rect x={x + (width - w) / 2} y={zero - 4} width={w} height={8} rx="1" className="hb-chart-gap" />;
}

/** The line the columns stand on, at zero. */
function Baseline({ layout }: { layout: XYLayout }) {
  const y = layout.yAt(0);
  return <line x1={layout.left} x2={layout.right} y1={y} y2={y} className="hb-chart-rule-strong" />;
}

export function BarMarks({ spec, layout, hover }: Props) {
  const { xAt, yAt, bar } = layout;
  const count = spec.series.length;
  const zero = yAt(0);
  return (
    <g>
      {spec.series.map((s, k) => s.data.map((v, i) => {
        const x = xAt(i) - (bar * count) / 2 + k * bar;
        const width = count > 1 ? bar - SERIES_GAP : bar;
        if (v === null) {
          return <g key={`${k}-${i}`} opacity={shade(hover, i)}><GapTick x={x} width={width} zero={zero} /></g>;
        }
        const end = yAt(v);
        return (
          <g key={`${k}-${i}`} opacity={shade(hover, i)}>
            <path d={barPath(x, width, zero, end)} fill={partColour(k)} className="hb-chart-bar" />
            {layout.valueLabels && (
              <text x={x + width / 2} y={v < 0 ? end + 14 : end - 6} textAnchor="middle" className="hb-chart-value">
                {fmt(v, s.unit ?? spec.unit)}
              </text>
            )}
          </g>
        );
      }))}
      <Baseline layout={layout} />
    </g>
  );
}

/** Stacked bars: each part in its band, 2px shorter so the parts sit apart; a zero part isn't drawn. */
export function StackMarks({ bands, layout, hover }: { bands: (Band | null)[][]; layout: XYLayout; hover: number | null }) {
  const { xAt, yAt, bar } = layout;
  return (
    <g>
      {bands.map((partBands, k) => partBands.map((b, i) => (b === null || b.from === b.to ? null : (
        <rect key={`${k}-${i}`} x={xAt(i) - bar / 2} y={Math.min(yAt(b.from), yAt(b.to))} width={bar}
          height={Math.max(Math.abs(yAt(b.from) - yAt(b.to)) - 2, 1)} rx="3" fill={partColour(k)} opacity={shade(hover, i)} />
      ))))}
      <Baseline layout={layout} />
    </g>
  );
}

/** A combo: the first series as columns, the rest as lines with a dot on each value, on their own scale if they have
 *  one. Gaps are left as they are: a tick for a missing column, a break in a line. */
export function ComboMarks({ spec, layout, hover }: Props) {
  const { xAt, yAt, bar } = layout;
  const zero = yAt(0);
  return (
    <g>
      {spec.series[0].data.map((v, i) => (v === null
        ? <g key={i} opacity={shade(hover, i)}><GapTick x={xAt(i) - bar / 2} width={bar} zero={zero} /></g>
        : <path key={i} d={barPath(xAt(i) - bar / 2, bar, zero, yAt(v))} fill={partColour(0)} opacity={shade(hover, i)} className="hb-chart-bar" />))}
      <Baseline layout={layout} />
      {spec.series.slice(1).map((s, j) => {
        const y = layout.yOf(s);
        const slots: (Point | null)[] = s.data.map((v, i) => (v === null ? null : [xAt(i), y(v)]));
        const runs = lineRuns(slots);
        if (!runs.length) return null;
        const colour = partColour(j + 1);
        return (
          <g key={j}>
            {runs.filter((r) => r.pts.length > 1).map((r, x) => (
              <path key={x} d={linePath(r.pts, spec.stepped)} fill="none" stroke={colour} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {runs.flatMap((r) => r.pts).map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="3.5" fill={colour} className="hb-chart-dot" />)}
          </g>
        );
      })}
    </g>
  );
}
