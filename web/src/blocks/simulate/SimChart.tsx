// The line chart view: a line per formula from time 0 to now, against a scale that fits the whole run, so the line
// draws itself as time moves on. A sample a formula can't work out (null) breaks its line rather than being bridged.
// A legend under it gives each value now.
import { useRef } from "react";
import { fmt, partColour } from "../chart/chartData";
import { lineRuns } from "../chart/geometry";
import { useWidth } from "../chart/useWidth";
import type { SimPile } from "./read";
import { niceAbove } from "./sim";

const HEIGHT = 220;
const PAD = { left: 52, right: 12, top: 10, bottom: 22 };

type Props = { piles: SimPile[]; lines: (number | null)[][]; times: number[]; index: number; unit?: string };

export function SimChart({ piles, lines, times, index, unit }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const to = times[times.length - 1];
  const top = Math.max(1e-9, ...lines.flat().map((v) => v ?? 0));
  const yStep = niceAbove(top / 4);
  const yMax = Math.ceil(top / yStep) * yStep;
  const xStep = niceAbove(to / 5);
  const x = (t: number) => PAD.left + (t / to) * (width - PAD.left - PAD.right);
  const y = (v: number) => HEIGHT - PAD.bottom - (v / yMax) * (HEIGHT - PAD.top - PAD.bottom);
  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, k) => k * yStep);
  const xTicks = Array.from({ length: Math.floor(to / xStep + 1e-9) + 1 }, (_, k) => k * xStep);
  const now = times[index];
  const label = piles.map((p, k) => `${p.name} ${valueText(lines[k][index], unit)}`).join(", ");
  return (
    <div ref={box} className="hb-sim-chart">
      <svg width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={`Line chart at ${fmt(now)}: ${label}`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="hb-sim-grid" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end">{fmt(v, unit)}</text>
          </g>
        ))}
        {xTicks.map((t) => <text key={t} x={x(t)} y={HEIGHT - 6} textAnchor="middle">{fmt(t)}</text>)}
        {piles.map((_, k) => {
          const runs = lineRuns(lines[k].slice(0, index + 1).map((v, i) => (v === null ? null : [x(times[i]), y(v)] as [number, number])));
          const last = lines[k][index];
          return (
            <g key={k} style={{ color: partColour(k + 1) }}>
              {runs.map((run, j) => (
                <polyline key={j} points={run.pts.map(([cx, cy]) => `${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ")} className="hb-sim-line" />
              ))}
              {last !== null && <circle cx={x(now)} cy={y(last)} r={4.5} className="hb-sim-point" />}
            </g>
          );
        })}
      </svg>
      <div className="hb-legend">
        {piles.map((p, k) => (
          <span key={k} className="hb-legend-item"><i className="hb-legend-dot" style={{ background: partColour(k + 1) }} />
            {p.name}<span className="hb-legend-value">{valueText(lines[k][index], unit)}</span></span>
        ))}
      </div>
    </div>
  );
}

function valueText(v: number | null | undefined, unit?: string): string {
  return v === null || v === undefined ? "–" : fmt(v, unit, { full: true });
}
