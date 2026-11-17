// Column charts' marks: bars (each series its own colour, values printed on top when few), stacked bars, and a
// combo's bars with its lines. Columns are rounded only at their far end and stand on a baseline; while one column
// is picked the others fade.
import type { Band, ChartSpec } from "./chartData";
import { fmt, partColour } from "./chartData";
import { barPath, linePath } from "./geometry";
import type { XYLayout } from "./layout";

type Props = { spec: ChartSpec; layout: XYLayout; hover: number | null };

const SERIES_GAP = 2;  // between the bars of one group

/** How strongly column i shows while `hover` is picked: the picked one fully, the rest faded. */
const shade = (hover: number | null, i: number) => (hover === null || hover === i ? 1 : 0.55);

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
        if (v === null) return null;
        const x = xAt(i) - (bar * count) / 2 + k * bar;
        const width = count > 1 ? bar - SERIES_GAP : bar;
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
 *  one. */
export function ComboMarks({ spec, layout, hover }: Props) {
  const { xAt, yAt, bar } = layout;
  const zero = yAt(0);
  return (
    <g>
      {spec.series[0].data.map((v, i) => v === null ? null : (
        <path key={i} d={barPath(xAt(i) - bar / 2, bar, zero, yAt(v))} fill={partColour(0)} opacity={shade(hover, i)} className="hb-chart-bar" />
      ))}
      <Baseline layout={layout} />
      {spec.series.slice(1).map((s, j) => {
        const y = layout.yOf(s);
        const pts = s.data.flatMap((v, i) => (v === null ? [] : [[xAt(i), y(v)] as [number, number]]));
        if (!pts.length) return null;
        const colour = partColour(j + 1);
        return (
          <g key={j}>
            <path d={linePath(pts, spec.stepped)} fill="none" stroke={colour} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="3.5" fill={colour} className="hb-chart-dot" />)}
          </g>
        );
      })}
    </g>
  );
}
