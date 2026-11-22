// A grid of shaded cells, column labels across the top and row labels down the side.
import { Fragment, useState } from "react";
import type { HeatmapBlock } from "./read";
import { cellColour, cellText, rangeOf } from "./heatmapColour";

const SHOW_NUMBERS_UP_TO = 6;  // columns; past that the cells are too narrow, so a tap shows the number instead

/** With six columns or fewer each cell prints its number; with more, a tap on a cell shows "row · col: value" under
 *  the grid. Every cell carries its full reading as a label for screen readers, and a cell with no number is read as
 *  "no data" rather than as an empty one. */
export function Heatmap({ title, rows, cols, values, unit, scale }: HeatmapBlock) {
  const [picked, setPicked] = useState<{ row: number; col: number } | null>(null);
  const range = rangeOf(values);
  const numbersInCells = cols.length <= SHOW_NUMBERS_UP_TO;
  return (
    <div className="hb-card hb-heatmap">
      {title && <div className="hb-card-title">{title}</div>}
      <div className="hb-heat-grid" style={{ gridTemplateColumns: `minmax(0, max-content) repeat(${cols.length}, minmax(0, 1fr))` }}
        role="table" aria-label={title ?? "Heat map"}>
        <span />
        {cols.map((c, j) => <span key={j} className="hb-heat-col" role="columnheader">{c}</span>)}
        {rows.map((r, i) => (
          <Fragment key={i}>
            <span className="hb-heat-row" role="rowheader">{r}</span>
            {cols.map((c, j) => {
              const v = values[i][j];
              return (
                <button key={j} type="button" className="hb-heat-cell" style={{ background: cellColour(v, range, scale) }}
                  onClick={() => setPicked({ row: i, col: j })} aria-label={`${r}, ${c}: ${v === null ? "no data" : cellText(v, unit)}`}>
                  {numbersInCells && v !== null ? cellText(v, unit) : ""}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
      {picked && (
        <div className="hb-heat-picked">
          {rows[picked.row]} · {cols[picked.col]}: <b>{cellText(values[picked.row][picked.col], unit)}</b>
        </div>
      )}
    </div>
  );
}
