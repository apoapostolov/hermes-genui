// A stacked area chart's marks: each part filled between its band's bottom and top, its top edge drawn as a line.
// A gap (null) breaks both the fill and its top edge, so a part is never drawn across a stretch with no value.
import { partColour, type Band } from "./chartData";
import { linePath, lineRuns, type Point } from "./geometry";
import type { XYLayout } from "./layout";

export function AreaMarks({ bands, layout }: { bands: (Band | null)[][]; layout: XYLayout }) {
  return (
    <g>
      <line x1={layout.left} x2={layout.right} y1={layout.base} y2={layout.base} className="hb-chart-rule" />
      {bands.map((partBands, k) => <Area key={k} bands={partBands} layout={layout} colour={partColour(k)} />)}
    </g>
  );
}

function Area({ bands, layout, colour }: { bands: (Band | null)[]; layout: XYLayout; colour: string }) {
  const tops: (Point | null)[] = bands.map((b, i) => (b === null ? null : [layout.xAt(i), layout.yAt(b.to)]));
  return (
    <g>
      {lineRuns(tops).filter((run) => run.pts.length > 1).map((run, j) => {
        const bottoms = run.pts.map((_, k) => layout.yAt(bands[run.from + k]!.from));
        const backAlongBottom = linePath(run.pts.map(([x], k) => [x, bottoms[k]] as Point).reverse()).replace(/^M/, "L");
        const topEdge = linePath(run.pts);
        return (
          <g key={j}>
            <path d={`${topEdge} ${backAlongBottom} Z`} fill={colour} fillOpacity=".3" />
            <path d={topEdge} fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}
