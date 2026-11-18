// A line chart's marks: one line per series without a fill, a dot and a label at each line's end (the last value for
// one series, each name for several), and for tone "change" a line that is green above its start and orange below.
import { fmt, partColour, type ChartSpec } from "./chartData";
import { linePath, textWidth } from "./geometry";
import { isChangeLine, seriesEnds, startLabelY, TICK_GAP, valueColour, type XYLayout } from "./layout";

type Props = { spec: ChartSpec; layout: XYLayout; gid: string; hover: number | null };

export function LineMarks({ spec, layout, gid, hover }: Props) {
  const { xAt, yAt, left, right, top, base } = layout;
  const one = spec.series.length === 1;
  const start = isChangeLine(spec) ? seriesEnds(spec.series[0].data).first : null;
  const zero = yAt(0);
  const showZero = !one && zero > top && zero < base;  // several lines on both sides of zero (% change from a start)

  return (
    <g>
      {layout.ticks.length
        ? <Gridlines spec={spec} layout={layout} />
        : <line x1={left} x2={right} y1={base} y2={base} className="hb-chart-rule" />}
      {showZero && <line x1={left} x2={right} y1={zero} y2={zero} className="hb-chart-rule-strong" strokeDasharray="3 3" />}
      {start !== null && <StartMark spec={spec} layout={layout} gid={gid} start={start} />}
      {spec.series.map((s, k) => {
        const pts = pointsOf(s.data, layout);
        if (!pts.length) return null;
        return (
          <path key={k} d={linePath(pts)} fill="none" stroke={start !== null ? `url(#change-${gid})` : partColour(k)}
            strokeWidth={one ? 2.25 : 1.75} strokeLinejoin="round" strokeLinecap="round"
            pathLength={1} strokeDasharray="1" strokeDashoffset="1" className="hb-chart-line hb-chart-draw" />
        );
      })}
      {layout.ends.map((e) => (
        <g key={e.series}>
          <circle cx={xAt(e.at)} cy={e.dotY} r="3.5" fill={e.dot} className="hb-chart-dot" />
          <text x={xAt(e.at) + 8} y={e.y + 4} className="hb-chart-end" style={{ fill: e.ink }}>{e.text}</text>
        </g>
      ))}
      {hover !== null && (
        <g>
          <Crosshair layout={layout} at={hover} />
          {spec.series.map((s, k) => {
            const v = s.data[hover] ?? null;
            return v === null ? null : <circle key={k} cx={xAt(hover)} cy={yAt(v)} r="4" fill={valueColour(spec, k, v)} className="hb-chart-dot" />;
          })}
        </g>
      )}
    </g>
  );
}

/** Faint lines across the plot at the layout's round values, each value written at its left end ("-10%", "0%"). */
export function Gridlines({ spec, layout }: { spec: ChartSpec; layout: XYLayout }) {
  const { left, right, yAt } = layout;
  return (
    <g>
      {layout.ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={yAt(t)} y2={yAt(t)} className="hb-chart-rule" />
          <text x={left - TICK_GAP} y={yAt(t) + 4} textAnchor="end" className="hb-chart-tick">{fmt(t, spec.unit)}</text>
        </g>
      ))}
    </g>
  );
}

/** A series's points in drawing units, gaps left out. */
function pointsOf(data: (number | null)[], { xAt, yAt }: XYLayout): [number, number][] {
  return data.flatMap((v, i) => (v === null ? [] : [[xAt(i), yAt(v)] as [number, number]]));
}

/** A change line's start: the gradient that turns its stroke orange below the first value, and a dashed line there
 *  labelled "Start 23,440" on the side the line leaves free (startLabelY), with a halo of the page's colour. The
 *  gradient is measured in the drawing's own units with a hard stop, so a flat line still gets a colour. */
function StartMark({ spec, layout, gid, start }: Omit<Props, "hover"> & { start: number }) {
  const { left, right, top, base, yAt } = layout;
  const y = yAt(start);
  const at = Math.min(1, Math.max(0, (y - top) / (base - top || 1)));
  const label = `Start ${fmt(start, spec.series[0].unit ?? spec.unit)}`;
  const labelY = startLabelY(pointsOf(spec.series[0].data, layout), left, left + 2 + textWidth(label), y, base);
  return (
    <g>
      <defs>
        <linearGradient id={`change-${gid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={base}>
          <stop offset={at} style={{ stopColor: "var(--hb-good)" }} />
          <stop offset={at} style={{ stopColor: "var(--hb-warn)" }} />
        </linearGradient>
      </defs>
      <line x1={left} x2={right} y1={y} y2={y} className="hb-chart-rule-strong" strokeDasharray="3 3" />
      <text x={left + 2} y={labelY} className="hb-chart-axis hb-chart-halo">{label}</text>
    </g>
  );
}

/** The thin upright line through the picked x label. */
export function Crosshair({ layout, at }: { layout: XYLayout; at: number }) {
  const x = layout.xAt(at);
  return <line x1={x} x2={x} y1={layout.top} y2={layout.base} className="hb-chart-rule-strong" />;
}
