// A waterfall (a bridge): one column per point, each step from the balance it starts at to the one it ends at, each
// total pinned from zero. A thin line carries the balance across to the next column. Steps take the gain or loss tone
// and their sign is written on them too, so the colour repeats the text rather than carrying it alone.
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { fmt, partColour, type ChartSpec, type WaterfallBar } from "./chartData";
import { barPath } from "./geometry";
import { TICK_GAP, waterfallLayout, waterfallTip, waterfallValue, type WaterfallLayout } from "./layout";
import { useWidth } from "./useWidth";
import { pickKeys } from "./pick";
import { ChartTip, type Tip } from "./ChartTip";

export function WaterfallChart({ spec }: { spec: ChartSpec }) {
  const plot = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const width = useWidth(plot);
  const [hover, setHover] = useState<number | null>(null);
  const layout = useMemo(() => waterfallLayout(spec, width), [spec, width]);
  const tip: Tip | null = hover === null || !layout.bars[hover] ? null : waterfallTip(spec, hover, layout);
  const unit = spec.series[0]?.unit ?? spec.unit;
  const last = layout.bars.length - 1;
  // The picked bar's balance, or the closing one; none when the run stopped short (a bar after an unknown step).
  const shown = hover ?? (layout.bars[last] ? last : null);
  const bar = shown === null ? null : layout.bars[shown];

  /** Picks the column nearest the pointer. */
  function pickAt(e: PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = ((e.clientX - r.left) / r.width) * layout.W;
    let best = -1;
    let near = layout.slot / 2;
    layout.bars.forEach((b, i) => {
      if (b === null) return;
      const away = Math.abs(layout.xAt(i) - x);
      if (away <= near) [best, near] = [i, away];
    });
    setHover(best < 0 ? null : best);
  }

  return (
    <figure className="hb-card hb-chart">
      <figcaption className="hb-chart-head">
        <span className="hb-chart-title">{spec.title ?? spec.series[0]?.name ?? "Waterfall"}</span>
      </figcaption>
      {spec.figure !== false && bar !== null && (
        <div className="hb-chart-figure">
          <span className="hb-chart-big">{fmt(bar.to, unit)}</span>
          <span className="hb-chart-at">{spec.x[shown as number]}</span>
        </div>
      )}
      <div ref={plot} className="hb-chart-plot">
        <svg ref={svg} width="100%" height={layout.H} viewBox={`0 0 ${layout.W} ${layout.H}`} className="hb-chart-svg"
          role="img" aria-label={nameOf(spec, layout)} {...pickKeys(layout.bars.length, hover, setHover)}
          onPointerDown={pickAt} onPointerMove={(e) => (e.buttons || e.pointerType === "mouse") && pickAt(e)}
          onPointerLeave={() => setHover(null)}>
          <Axis spec={spec} layout={layout} />
          <g aria-hidden="true">
            {layout.bars.map((b, i) => {
              const prev = i ? layout.bars[i - 1] : null;
              if (!b || !prev) return null;
              const y = layout.yAt(prev.to);
              return <line key={i} x1={layout.xAt(i - 1) + layout.bar / 2} x2={layout.xAt(i) - layout.bar / 2}
                y1={y} y2={y} className="hb-waterfall-link" />;
            })}
          </g>
          {layout.bars.map((b, i) => (b === null ? null : (
            <path key={i} d={barPath(layout.xAt(i) - layout.bar / 2, layout.bar, layout.yAt(b.from), layout.yAt(b.to))}
              fill={colourOf(b)} opacity={hover === null || hover === i ? 1 : 0.55} className="hb-chart-bar">
              <title>{barText(b, String(spec.x[i]), unit)}</title>
            </path>
          )))}
          {layout.valueLabels && layout.bars.map((b, i) => (b === null ? null : (
            <text key={i} x={layout.xAt(i)} y={b.to >= b.from ? layout.yAt(b.to) - 6 : layout.yAt(b.to) + 14}
              textAnchor="middle" className="hb-chart-value">{waterfallValue(b, unit)}</text>
          )))}
          <g aria-hidden="true">
            {layout.labels.map((label, i) => (
              <text key={i} x={layout.xAt(i)} y={layout.H - 7} textAnchor="middle" className="hb-chart-axis">{label}</text>
            ))}
          </g>
        </svg>
        <ChartTip tip={tip} />
      </div>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}

/** A total keeps the chart's first colour; a step takes the gain tone when it rises and the loss tone when it falls. */
function colourOf(bar: WaterfallBar): string {
  if (bar.total) return partColour(0);
  return bar.to >= bar.from ? "var(--hb-good)" : "var(--hb-warn)";
}

/**
 * The round values up the side, the line at zero, and a label under every column (an unknown step keeps its label, so
 * the reader can see which step is missing). Decorative: the accessible name carries the balance.
 */
function Axis({ spec, layout }: { spec: ChartSpec; layout: WaterfallLayout }) {
  return (
    <g aria-hidden="true">
      {layout.ticks.map((t) => (
        <g key={t}>
          <line x1={layout.left} x2={layout.right} y1={layout.yAt(t)} y2={layout.yAt(t)} className="hb-chart-rule" />
          <text x={layout.left - TICK_GAP} y={layout.yAt(t) + 4} textAnchor="end" className="hb-chart-tick">{fmt(t, spec.unit)}</text>
        </g>
      ))}
      <line x1={layout.left} x2={layout.right} y1={layout.yAt(0)} y2={layout.yAt(0)} className="hb-chart-rule-strong" />
    </g>
  );
}

/** A bar as the pointer hovers it: "Returns, minus 8, balance 112". */
function barText(bar: WaterfallBar, label: string, unit?: string): string {
  if (bar.total) return `${label}, total ${fmt(bar.to, unit)}`;
  const step = bar.to - bar.from;
  return `${label}, ${step < 0 ? "minus" : "plus"} ${fmt(Math.abs(step), unit)}, balance ${fmt(bar.to, unit)}`;
}

/** The drawing's accessible name: what it bridges and where the balance ends. */
function nameOf(spec: ChartSpec, layout: WaterfallLayout): string {
  const drawn = layout.bars.filter((b): b is WaterfallBar => b !== null);
  const title = spec.title ?? "Waterfall";
  if (!drawn.length) return `${title}: no point with a value`;
  const unit = spec.series[0]?.unit ?? spec.unit;
  return `${title}: ${drawn.length} of ${spec.x.length} bars, balance ${fmt(drawn[drawn.length - 1].to, unit)}`;
}
