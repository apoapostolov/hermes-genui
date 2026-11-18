// Column charts' marks: bars (each series its own colour, values printed on top when few), stacked bars, a combo's bars
// with its lines, a histogram's touching columns and a range's low-to-high bands. Columns are rounded only at their far
// end and stand on a baseline; while one column is picked the others fade.
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
            <path d={linePath(pts)} fill="none" stroke={colour} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="3.5" fill={colour} className="hb-chart-dot" />)}
          </g>
        );
      })}
    </g>
  );
}

/** A histogram's columns: one per bin, as wide as its slot with a hairline between them so the shape of the
 *  distribution reads, standing on zero. A bin of 0 is a known zero and draws no column; a bin with no count draws
 *  nothing at all. */
export function HistogramMarks({ spec, layout, hover }: Props) {
  const { xAt, yAt, slot } = layout;
  const zero = yAt(0);
  const width = Math.max(slot - 1, 1);
  const unit = spec.series[0].unit ?? spec.unit;
  return (
    <g>
      {spec.series[0].data.map((v, i) => v === null ? null : (
        <g key={i} opacity={shade(hover, i)}>
          {v !== 0 && (
            <rect x={xAt(i) - width / 2} y={Math.min(yAt(v), zero)} width={width}
              height={Math.max(Math.abs(zero - yAt(v)), 1)} rx="2" fill={partColour(0)} className="hb-chart-bar" />
          )}
          {layout.valueLabels && (
            <text x={xAt(i)} y={yAt(v) - 6} textAnchor="middle" className="hb-chart-value">{fmt(v, unit)}</text>
          )}
        </g>
      ))}
      <Baseline layout={layout} />
    </g>
  );
}

/** A range's windows: a low-to-high band per x, filled in the series colour with its edge in the line colour, and the
 *  dot where the latest reading sits — outside the band when it falls there. */
export function RangeMarks({ spec, layout, hover }: Props) {
  const { xAt, yAt, bar, left, right, base } = layout;
  return (
    <g>
      <line x1={left} x2={right} y1={base} y2={base} className="hb-chart-rule" />
      {(spec.series[0].span ?? []).map((w, i) => {
        if (!w || (w.low === null && w.high === null && w.now === null)) return null;
        const cx = xAt(i);
        const low = w.low, high = w.high;
        return (
          <g key={i} opacity={shade(hover, i)}>
            {low !== null && high !== null && (
              <rect x={cx - bar / 2} y={yAt(high)} width={bar} height={Math.max(yAt(low) - yAt(high), 1)}
                rx="3" fill={partColour(0)} className="hb-chart-band" />
            )}
            {w.now !== null && <circle cx={cx} cy={yAt(w.now)} r="4" fill={partColour(0)} className="hb-chart-dot" />}
          </g>
        );
      })}
    </g>
  );
}
