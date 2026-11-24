// Horizontal bars: a row per x label, read top to bottom as a ranking. Asked for as hbar, or chosen for bars whose
// labels read better as rows (kindToDraw in chartData.ts).
import { Fragment, useRef, useState } from "react";
import { chartLabel, fmt, partColour, seriesName, type ChartSpec } from "./chartData";
import { hbarBarOf, hbarSpan } from "./hbarLayout";  // the shared layout math — the export measures what this draws
import { ChartTip, type Tip } from "./ChartTip";
import { ChartLegend } from "./Legend";
import { pickKeys } from "./pick";

/**
 * hbar: label | bar | value on each row, the label wrapping so a long name still reads on a phone. One series of
 * positive values is drawn in one colour; with a negative value the bars grow either way from a zero line, gains
 * green and falls orange (a sector down 4% over the year). Several series: a thinner bar for each in its own colour,
 * named in a legend. Rows keep the given order.
 */
export function HBarChart({ spec }: { spec: ChartSpec }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const tracks = useRef<(HTMLDivElement | null)[]>([]);

  const { lo, span, zeroAt } = hbarSpan(spec);  // one scale for every row (hbarLayout.ts)
  const single = spec.series.length === 1;
  const signed = lo < 0;
  const colourOf = (k: number, v: number) => {
    if (!single || !signed) return partColour(k);
    return v >= 0 ? "var(--hb-good)" : "var(--hb-warn)";
  };
  const unitOf = (k: number) => spec.series[k].unit ?? spec.unit;
  const barOf = (v: number) => hbarBarOf(v, span, zeroAt);

  /** Picks row i (or none) and points the hover card at the far end of its longest bar. */
  function pick(i: number | null) {
    setPicked(i);
    const track = i === null ? null : tracks.current[i];
    if (i === null || !track || !box.current) return setTip(null);
    const rows: Tip["rows"] = [];
    let end = zeroAt;
    spec.series.forEach((s, k) => {
      const v = s.data[i] ?? null;
      if (v === null) return;
      rows.push({ colour: colourOf(k, v), name: seriesName(spec.series, k), value: fmt(v, unitOf(k), { full: true }) });
      const { left, width } = barOf(v);
      end = Math.max(end, left + width);
    });
    const t = track.getBoundingClientRect();
    const b = box.current.getBoundingClientRect();
    setTip({ x: t.left - b.left + (t.width * end) / 100, y: t.top - b.top, title: String(spec.x[i]), rows });
  }

  const shade = (i: number) => (picked === null || picked === i ? 1 : 0.55);
  const rowEvents = (i: number) => ({ onPointerEnter: () => pick(i), onPointerDown: () => pick(i) });
  return (
    <figure className="hb-card hb-chart">
      <figcaption className="hb-chart-title">{spec.title ?? spec.series[0].name ?? "Chart"}</figcaption>
      {!single && <ChartLegend series={spec.series} />}
      <div ref={box} className="hb-hbar-box">
        <div className={`hb-hbar-grid${single ? "" : " hb-hbar-many"}`} role="img" aria-label={chartLabel(spec)}
          style={spec.height ? { minHeight: spec.height } : undefined}
          {...pickKeys(spec.x.length, picked, pick, true)} onPointerLeave={() => pick(null)}>
          {spec.x.map((label, i) => (
            <Fragment key={i}>
              <div className="hb-hbar-label" {...rowEvents(i)}>{label}</div>
              <div className="hb-hbar-tracks" ref={(el) => { tracks.current[i] = el; }} {...rowEvents(i)}>
                {spec.series.map((s, k) => {
                  const v = s.data[i] ?? null;
                  const bar = v === null ? null : barOf(v);
                  return (
                    <div key={k} className="hb-hbar-track">
                      {signed && <div className="hb-hbar-zero" style={{ left: `${zeroAt}%` }} />}
                      {v !== null && bar && (
                        <div className="hb-hbar-bar" style={{ left: `${bar.left}%`, width: `${bar.width}%`,
                          background: colourOf(k, v), opacity: shade(i) }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="hb-hbar-values" {...rowEvents(i)}>
                {spec.series.map((s, k) => {
                  const v = s.data[i] ?? null;
                  const tone = single && signed && v !== null ? (v >= 0 ? " hb-hbar-up" : " hb-hbar-down") : "";
                  return <span key={k} className={`hb-hbar-value${tone}`}>{v === null ? "–" : fmt(v, unitOf(k))}</span>;
                })}
              </div>
            </Fragment>
          ))}
        </div>
        <ChartTip tip={tip} />
      </div>
      {spec.xLabel && <div className="hb-chart-axis-note">{spec.xLabel}</div>}
      {spec.caveat && <div className="hb-chart-caveat">{spec.caveat}</div>}
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
