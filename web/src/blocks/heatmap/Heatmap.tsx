// A grid of shaded cells, column labels across the top and row labels down the side.
import { useState } from "react";
import type { HeatmapBlock } from "./read";
import { cellColour, cellText, rangeOf } from "./heatmapColour";
import { useNamed } from "../../core/a11y";

const SHOW_NUMBERS_UP_TO = 6;  // columns; past that the cells are too narrow, so a tap shows the number instead

/**
 * With six columns or fewer each cell prints its number; with more, a tap on a cell shows "row · col: value" under
 * the grid. Every cell carries its full reading as a label for screen readers.
 *
 * The grid is a table: one row per row (a div that only passes its children through, so the columns still line up),
 * a rowheader per row and a cell per value, which holds the button that shows the number. Cells stay buttons, so the
 * keyboard order is the one it was.
 */
export function Heatmap({ title, rows, cols, values, unit, scale }: HeatmapBlock) {
  const [picked, setPicked] = useState<{ row: number; col: number } | null>(null);
  const range = rangeOf(values);
  const numbersInCells = cols.length <= SHOW_NUMBERS_UP_TO;
  const named = useNamed("heatmap", title);
  return (
    <div className="hb-card hb-heatmap">
      {title && <div id={named.title.id} className="hb-card-title">{title}</div>}
      <div className="hb-heat-grid" style={{ gridTemplateColumns: `minmax(0, max-content) repeat(${cols.length}, minmax(0, 1fr))` }}
        role="table" {...named.root}>
        <div role="row" className="hb-heat-arow">
          <span role="cell" className="hb-heat-acell" />
          {cols.map((c, j) => <span key={j} className="hb-heat-col" role="columnheader">{c}</span>)}
        </div>
        {rows.map((r, i) => (
          <div role="row" className="hb-heat-arow" key={i}>
            <span className="hb-heat-row" role="rowheader">{r}</span>
            {cols.map((c, j) => {
              const v = values[i][j];
              return (
                <span role="cell" className="hb-heat-acell" key={j}>
                  <button type="button" className="hb-heat-cell" style={{ background: cellColour(v, range, scale) }}
                    onClick={() => setPicked({ row: i, col: j })} aria-label={`${r}, ${c}: ${cellText(v, unit)}`}>
                    {numbersInCells && v !== null ? cellText(v, unit) : ""}
                  </button>
                </span>
              );
            })}
          </div>
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
