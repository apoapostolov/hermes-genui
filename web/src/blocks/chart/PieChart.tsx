// Pie and donut: shares of a whole, with a legend beside the drawing (below it when the chart is narrower than 440px)
// listing each slice's name, value and share, so no label is squeezed onto a slice.
import { useRef, useState } from "react";
import { fmt, partColour, seriesName, shareNote, sharePct, type ChartSpec } from "./chartData";
import { ChartTip, type Tip } from "./ChartTip";
import { pickKeys } from "./pick";

const BOX = 168, C = BOX / 2, OUTER = 80, HOLE = 52;  // the drawing's size and centre, the outer radius, a donut's hole

/** A point on the circle, at a fraction of a turn clockwise from 12 o'clock: (0, 80) -> top; (0.25, 80) -> right. */
function at(turn: number, r: number): [number, number] {
  const a = turn * 2 * Math.PI;
  return [+(C + r * Math.sin(a)).toFixed(2), +(C - r * Math.cos(a)).toFixed(2)];
}

/** One slice's outline from `start` to `end` (fractions of a turn): a wedge from the centre, or with a hole (a donut)
 *  a piece of the ring. A slice that is the whole circle stops just short of closing, or its arc would vanish. */
function slicePath(start: number, end: number, hole: number): string {
  const stop = Math.min(end, start + 0.9999);
  const large = stop - start > 0.5 ? 1 : 0;
  const [x1, y1] = at(start, OUTER);
  const [x2, y2] = at(stop, OUTER);
  if (hole === 0) return `M${C},${C} L${x1},${y1} A${OUTER},${OUTER} 0 ${large} 1 ${x2},${y2} Z`;
  const [x3, y3] = at(stop, hole);
  const [x4, y4] = at(start, hole);
  return `M${x1},${y1} A${OUTER},${OUTER} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${hole},${hole} 0 ${large} 0 ${x4},${y4} Z`;
}

/** A slice's name short enough for a donut's hole: "Fixed deposits" stays; "Equity mutual funds (large cap)" ->
 *  "Equity mutual f…". */
function shortLabel(label: string): string {
  if (label.length <= 15) return label;
  return `${label.slice(0, 14)}…`;
}

/** Which colour a slice gets: the chart palette in order, except an "Other" slice (the small ones merged, or the
 *  model's own), which is grey so it doesn't look like a category. ("Rent", 0) -> palette 1; ("Other", 5) -> grey. */
function sliceColour(label: string, i: number): string {
  if (label === "Other") return "var(--hb-muted)";
  return partColour(i);
}

/**
 * Pie and donut, from x (the slices) and the first series (their values, all positive: readChart checked that). A
 * donut shows the total in its middle; a pie shows it above. Values in % are shares already, so their total (100%)
 * says nothing: the biggest slice is shown instead, and the legend leaves out the value column. Pointing at a slice
 * or its legend row (or stepping with the arrow keys) fades the others and shows its hover card.
 */
export function PieChart({ spec }: { spec: ChartSpec }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const box = spec.height ?? BOX;
  const scale = box / BOX;
  const values = spec.series[0].data as number[];
  const total = values.reduce((sum, v) => sum + v, 0);
  const unit = spec.series[0].unit ?? spec.unit;
  const donut = spec.type === "donut";
  const hole = donut ? HOLE : 0;

  const slices: { start: number; end: number }[] = [];
  let start = 0;
  for (const v of values) {
    slices.push({ start, end: start + v / total });
    start += v / total;
  }

  const valuesAreShares = unit === "%";
  const biggest = values.indexOf(Math.max(...values));
  const headline = valuesAreShares
    ? { value: sharePct(values[biggest] / total), label: String(spec.x[biggest]) }
    : { value: fmt(total, unit), label: "Total" };

  /** Picks slice i (or none) and points the hover card at the middle of its ring. */
  function pick(i: number | null) {
    setPicked(i);
    const el = svg.current;
    const body = el?.parentElement;  // .hb-pie-body, which the card is placed in
    if (i === null || !el || !body) return setTip(null);
    const [x, y] = at((slices[i].start + slices[i].end) / 2, donut ? (OUTER + HOLE) / 2 : OUTER * 0.6);
    const drawing = el.getBoundingClientRect();
    const around = body.getBoundingClientRect();
    const label = String(spec.x[i]);
    setTip({ x: drawing.left - around.left + x * scale, y: drawing.top - around.top + y * scale, title: label,
      rows: [{ colour: sliceColour(label, i), name: seriesName(spec.series, 0), value: fmt(values[i], unit, { full: true }) }],
      note: valuesAreShares ? undefined : shareNote(values, values[i]) });
  }
  const toggle = (i: number) => pick(picked === i ? null : i);
  const faded = (i: number) => (picked === null || picked === i ? 1 : 0.5);
  const mouse = (i: number | null) => (e: { pointerType: string }) => e.pointerType === "mouse" && pick(i);

  return (
    <figure className="hb-card hb-chart hb-pie">
      <figcaption className="hb-chart-title">{spec.title ?? spec.series[0].name ?? "Chart"}</figcaption>
      {!donut && (
        <div className="hb-chart-figure">
          <span className="hb-chart-big">{headline.value}</span>
          <span className="hb-chart-at">{headline.label}</span>
        </div>
      )}
      <div className="hb-pie-body">
        <svg ref={svg} width={box} height={box} viewBox={`0 0 ${BOX} ${BOX}`} className="hb-pie-svg" role="img"
          aria-label={spec.title ?? "chart"} {...pickKeys(values.length, picked, pick)}>
          {slices.map((s, i) => (
            <path key={i} d={slicePath(s.start, s.end, hole)} fill={sliceColour(String(spec.x[i]), i)} opacity={faded(i)}
              className="hb-slice" onClick={() => toggle(i)} onPointerEnter={mouse(i)} onPointerLeave={mouse(null)} />
          ))}
          {donut && (
            <g textAnchor="middle" pointerEvents="none">
              <text x={C} y={C - 2} className="hb-pie-total">{headline.value}</text>
              <text x={C} y={C + 15} className="hb-chart-axis">{shortLabel(headline.label)}</text>
            </g>
          )}
        </svg>
        <table className="hb-pie-legend">
          <tbody>
            {values.map((v, i) => (
              <tr key={i} onClick={() => toggle(i)} onPointerEnter={mouse(i)} onPointerLeave={mouse(null)} style={{ opacity: faded(i) }}>
                <td className="hb-pie-swatch"><i style={{ background: sliceColour(String(spec.x[i]), i) }} /></td>
                <td className="hb-pie-name">{spec.x[i]}</td>
                {!valuesAreShares && <td className="hb-pie-value">{fmt(v, unit)}</td>}
                <td className="hb-pie-share">{sharePct(v / total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ChartTip tip={tip} />
      </div>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
