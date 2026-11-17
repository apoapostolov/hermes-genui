// Charts that go up and down: line, bar, area, stacked and combo. Pies and donuts, and horizontal bars, have files
// of their own. Hand-drawn SVG at the width the chart has on screen (chart.css sets how wide that may be): the sums
// behind it are in chartData.ts, where things go in layout.ts, the marks in *Marks.tsx.
import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { changePct, chartScales, fmt, kindToDraw, stackSeries, totalAt, type ChartSpec } from "./chartData";
import { seriesEnds, xyLayout, xyTip, type XYLayout } from "./layout";
import { useWidth } from "./useWidth";
import { pickKeys } from "./pick";
import { ChartTip } from "./ChartTip";
import { ChartLegend } from "./Legend";
import { LineMarks, Crosshair } from "./LineMarks";
import { BarMarks, ComboMarks, StackMarks } from "./ColumnMarks";
import { AreaMarks } from "./AreaMarks";
import { HBarChart } from "./HBarChart";
import { PieChart } from "./PieChart";
import { ScatterChart } from "./ScatterChart";
import { WaterfallChart } from "./WaterfallChart";

const WIDE_FROM = 60;  // a line with this many points may be drawn wider than the usual cap

/** A chart of any kind: pies and donuts, a scatter, a waterfall, and horizontal bars (asked for, or bars that read
 *  better as rows: see kindToDraw), have drawings of their own; the rest go up and down. */
export function Chart({ spec }: { spec: ChartSpec }) {
  if (spec.type === "pie" || spec.type === "donut") return <PieChart spec={spec} />;
  if (spec.type === "scatter") return <ScatterChart spec={spec} />;
  if (spec.type === "waterfall") return <WaterfallChart spec={spec} />;
  if (kindToDraw(spec) === "hbar") return <HBarChart spec={spec} />;
  return <XYChart spec={spec} />;
}

/** Line, bar, area, stacked and combo: x labels along the bottom, values up the side. */
function XYChart({ spec }: { spec: ChartSpec }) {
  const plot = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const width = useWidth(plot);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const n = spec.x.length;
  const piled = spec.type === "stacked" || spec.type === "area";  // the series pile on each other
  const bands = useMemo(() => (piled ? stackSeries(spec.series, n) : null), [spec, n, piled]);
  const scales = useMemo(() => chartScales(spec, bands), [spec, bands]);
  const layout = useMemo(() => xyLayout(spec, width, scales), [spec, width, scales]);
  const tip = useMemo(() => (hover === null ? null : xyTip(spec, hover, layout)), [spec, hover, layout]);

  /** Picks the x label nearest the pointer. */
  function pickAt(e: PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = ((e.clientX - r.left) / r.width) * layout.W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(layout.xAt(i) - x) < Math.abs(layout.xAt(best) - x)) best = i;
    setHover(best);
  }

  const multiLegend = spec.type === "combo" || (spec.type === "bar" && spec.series.length > 1)
    || (spec.type === "line" && spec.series.length > 1);
  const wide = spec.type === "line" && n >= WIDE_FROM;
  return (
    <figure className={`hb-card hb-chart${wide ? " hb-chart-wide" : ""}`}>
      <Headline spec={spec} hover={hover} />
      <div ref={plot} className="hb-chart-plot">
        <svg ref={svg} width="100%" height={layout.H} viewBox={`0 0 ${layout.W} ${layout.H}`} className="hb-chart-svg"
          role="img" aria-label={spec.title ?? "chart"} {...pickKeys(n, hover, setHover)}
          onPointerDown={pickAt} onPointerMove={(e) => (e.buttons || e.pointerType === "mouse") && pickAt(e)}
          onPointerLeave={() => setHover(null)}>
          <XLabels spec={spec} layout={layout} />
          {spec.type === "line" && <LineMarks spec={spec} layout={layout} gid={gid} hover={hover} />}
          {spec.type === "bar" && <BarMarks spec={spec} layout={layout} hover={hover} />}
          {spec.type === "stacked" && bands && <StackMarks bands={bands} layout={layout} hover={hover} />}
          {spec.type === "area" && bands && <AreaMarks bands={bands} layout={layout} />}
          {spec.type === "combo" && <ComboMarks spec={spec} layout={layout} hover={hover} />}
          {(spec.type === "area" || spec.type === "combo") && hover !== null && <Crosshair layout={layout} at={hover} />}
        </svg>
        <ChartTip tip={tip} />
      </div>
      {multiLegend && <ChartLegend series={spec.series} />}
      {piled && spec.series.length > 1 && <ChartLegend series={spec.series} at={hover ?? lastIndex(spec)} unit={spec.unit} />}
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}

/** The index of the first series's last value (gaps skipped): where the headline number is read when nothing is
 *  picked. */
function lastIndex(spec: ChartSpec): number {
  const { last } = seriesEnds(spec.series[0].data);
  return last < 0 ? spec.x.length - 1 : last;
}

/** The title, the line's change chip, and the big number: the value at the picked x label, or the latest. A stacked
 *  chart's number is the whole pile; the other series's values sit beside it. figure: false keeps only the title. */
function Headline({ spec, hover }: { spec: ChartSpec; hover: number | null }) {
  const piled = spec.type === "stacked" || spec.type === "area";
  const pct = spec.type === "line" ? changePct(spec.series[0].data) : null;
  const shown = hover ?? lastIndex(spec);
  const big = piled ? totalAt(spec.series, shown) : spec.series[0].data[shown] ?? null;
  const bigUnit = piled ? spec.unit : spec.series[0].unit ?? spec.unit;
  const listed = piled ? [] : spec.series.slice(1);  // a pile's parts have their values in the legend
  const withFigure = spec.figure !== false;
  return (
    <>
      <figcaption className="hb-chart-head">
        <span className="hb-chart-title">{spec.title ?? spec.series[0].name ?? "Chart"}</span>
        {pct !== null && withFigure && <span className={`hb-chip ${pct >= 0 ? "hb-chip-good" : "hb-chip-warn"}`}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>}
      </figcaption>
      {withFigure && (
        <div className="hb-chart-figure">
          <span className="hb-chart-big">{big === null ? "–" : fmt(big, bigUnit)}</span>
          <span className="hb-chart-at">
            {hover !== null ? spec.x[shown] : ""}
            {listed.map((s, k) => {
              const v = s.data[shown] ?? null;
              return v === null ? null : <span key={k} className="hb-chart-other">{s.name ? `${s.name} ` : ""}{fmt(v, s.unit ?? spec.unit)}</span>;
            })}
          </span>
        </div>
      )}
    </>
  );
}

/** The x labels that fit along the bottom (layout.xLabels): under each column, or for a line the first one starting
 *  at the left edge, the last ending at the right and the rest centred. */
function XLabels({ spec, layout }: { spec: ChartSpec; layout: XYLayout }) {
  const last = spec.x.length - 1;
  const anchor = (i: number) => (layout.slotted ? "middle" : i === 0 && last > 0 ? "start" : i === last && last > 0 ? "end" : "middle");
  return (
    <g>
      {layout.xLabels.map((i) => (
        <text key={i} x={layout.xAt(i)} y={layout.H - 7} textAnchor={anchor(i)} className="hb-chart-axis">{String(spec.x[i])}</text>
      ))}
    </g>
  );
}
