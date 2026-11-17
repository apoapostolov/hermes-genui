// A scatter: one dot per point on two numeric scales, a colour per group. The x labels are numbers, not names, so the
// drawing carries round values along the bottom as well as up the side, and the title names the two axes ("Price
// against mileage"). Points are read left to right, then top to bottom, which is the order the arrow keys walk.
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { axisNames, chartScales, fmt, partColour, type ChartSpec } from "./chartData";
import { scatterLayout, scatterTip, TICK_GAP, type Dot, type ScatterLayout } from "./layout";
import { useWidth } from "./useWidth";
import { pickKeys } from "./pick";
import { ChartTip } from "./ChartTip";
import { ChartLegend } from "./Legend";

/** How near the pointer has to be to a dot to pick it, in drawing px. */
const PICK_RADIUS = 28;

export function ScatterChart({ spec }: { spec: ChartSpec }) {
  const plot = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const width = useWidth(plot);
  const [hover, setHover] = useState<number | null>(null);
  const scales = useMemo(() => chartScales(spec, null), [spec]);
  const layout = useMemo(() => scatterLayout(spec, width, scales), [spec, width, scales]);
  const tip = useMemo(() => (hover === null || !layout.dots[hover] ? null : scatterTip(spec, hover, layout)),
    [spec, hover, layout]);

  /** Picks the dot nearest the pointer, if one is near enough. */
  function pickAt(e: PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = ((e.clientX - r.left) / r.width) * layout.W;
    const y = ((e.clientY - r.top) / r.height) * layout.H;
    let best = -1;
    let near = PICK_RADIUS;
    layout.dots.forEach((dot, i) => {
      const away = Math.hypot(dot.cx - x, dot.cy - y);
      if (away <= near) [best, near] = [i, away];
    });
    setHover(best < 0 ? null : best);
  }

  return (
    <figure className="hb-card hb-chart">
      <figcaption className="hb-chart-head">
        <span className="hb-chart-title">{spec.title ?? spec.series[0]?.name ?? "Scatter"}</span>
      </figcaption>
      <div ref={plot} className="hb-chart-plot">
        <svg ref={svg} width="100%" height={layout.H} viewBox={`0 0 ${layout.W} ${layout.H}`} className="hb-chart-svg"
          role="img" aria-label={nameOf(spec, layout)} {...pickKeys(layout.dots.length, hover, setHover)}
          onPointerDown={pickAt} onPointerMove={(e) => (e.buttons || e.pointerType === "mouse") && pickAt(e)}
          onPointerLeave={() => setHover(null)}>
          <Axis spec={spec} layout={layout} />
          {layout.dots.map((dot, i) => (
            <circle key={`${dot.series}-${i}`} cx={dot.cx} cy={dot.cy} r="4" fill={partColour(dot.series)}
              opacity={hover === null || hover === i ? 1 : 0.55} className="hb-chart-dot">
              <title>{dotText(spec, dot)}</title>
            </circle>
          ))}
        </svg>
        <ChartTip tip={tip} />
      </div>
      {spec.series.length > 1 && <ChartLegend series={spec.series} />}
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}

/**
 * The scatter's scales: faint lines with round values up the side, and the round values along the bottom. Decorative:
 * the accessible name carries the ranges, since a screen reader can't read `<text>` in an SVG.
 */
function Axis({ spec, layout }: { spec: ChartSpec; layout: ScatterLayout }) {
  return (
    <g aria-hidden="true">
      {layout.yTicks.map((t) => (
        <g key={t}>
          <line x1={layout.left} x2={layout.right} y1={layout.yAt(t)} y2={layout.yAt(t)} className="hb-chart-rule" />
          <text x={layout.left - TICK_GAP} y={layout.yAt(t) + 4} textAnchor="end" className="hb-chart-tick">{fmt(t, spec.unit)}</text>
        </g>
      ))}
      <line x1={layout.left} x2={layout.right} y1={layout.base} y2={layout.base} className="hb-chart-rule" />
      {layout.xTicks.map((t) => (
        <text key={t} x={layout.xAt(t)} y={layout.H - 8} textAnchor="middle" className="hb-chart-axis">{fmt(t)}</text>
      ))}
    </g>
  );
}

/** A dot as the pointer hovers it: "mileage 62, price 1.2, Maruti 800". */
function dotText(spec: ChartSpec, dot: Dot): string {
  const names = axisNames(spec.title);
  const where = `${names.x ?? "x"} ${fmt(dot.x)}, ${names.y ?? "y"} ${fmt(dot.y)}`;
  return dot.point.label ? `${where}, ${dot.point.label}` : where;
}

/**
 * The drawing's accessible name: what it plots and how far the numbers run.
 *   "Price against mileage: mileage 9 to 62, price 1.2 to 24.6, 4 points"
 */
function nameOf(spec: ChartSpec, layout: ScatterLayout): string {
  const title = spec.title ?? "Scatter";
  const dots = layout.dots;
  if (!dots.length) return `${title}: no points with two numbers`;
  const names = axisNames(spec.title);
  const spread = (values: number[]) => {
    const lo = Math.min(...values), hi = Math.max(...values);
    return lo === hi ? fmt(lo) : `${fmt(lo)} to ${fmt(hi)}`;
  };
  const count = `${dots.length} point${dots.length === 1 ? "" : "s"}`;
  return `${title}: ${names.x ?? "x"} ${spread(dots.map((d) => d.x))}, ${names.y ?? "y"} ${spread(dots.map((d) => d.y))}, ${count}`;
}
