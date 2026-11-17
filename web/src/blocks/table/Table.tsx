// Options compared side by side. Click a header to sort (up, down, back); the highlighted row gets an accent edge and
// a "Best" chip (a highlighted column, an accent underline on its header). Rises and falls in a change column are
// coloured, with a mini bar from 3 rows up; big amounts are shortened, every digit kept in the hover. The table
// scrolls inside its card (sideways when wide, down past ~520px with the header kept in view), never the page.
import { useState } from "react";
import type { LegacyTable, TableBlock } from "./read";
import { StructuredTable } from "./StructuredTable";
import { bigNumber, changeOf, isChangeColumn, miniBar } from "./cells";
import { cellNumber, isNumberColumn, nextSort, sortedOrder, type SortState } from "./sort";
import { InlineText } from "../../lib/InlineText";

// Mini bars need a few rows to compare; with 2 the coloured numbers say it all.
const MINI_BARS_FROM = 3;

export function Table(props: TableBlock) {
  if ("structured" in props && props.structured) return <StructuredTable {...props} />;
  const { columns, rows, highlight, caption } = props as LegacyTable;
  const [sort, setSort] = useState<SortState>(null);
  const order = sortedOrder(rows, sort);
  const bestRow = highlight && "row" in highlight ? highlight.row : -1;
  const bestColumn = highlight && "column" in highlight ? highlight.column : -1;
  const numeric = columns.map((_, c) => isNumberColumn(rows, c));
  const change = columns.map((_, c) => isChangeColumn(rows, c));
  const largest = columns.map((_, c) => (change[c] ? largestChange(rows, c) : 0));
  const withBars = rows.length >= MINI_BARS_FROM;
  const cellClass = (c: number, text: string, extra = "") => [
    numeric[c] ? "hb-num" : "",
    c === 0 ? "hb-first" : "",
    c === bestColumn ? "hb-best-col" : "",
    text.length > 28 ? "hb-wrap" : "",
    extra,
  ].filter(Boolean).join(" ");

  return (
    <div className="hb-card hb-table-card">
      {caption && <div className="hb-chart-title hb-table-caption"><InlineText text={caption} /></div>}
      <div className="hb-table-scroll">
        <table className={columns.length >= 3 ? "hb-table hb-table-wide" : "hb-table"}>
          <thead>
            <tr>
              {columns.map((name, c) => (
                <th key={c} aria-sort={ariaSort(sort, c)} className={cellClass(c, name, sort?.column === c ? "hb-sorted" : "")}>
                  <button type="button" onClick={() => setSort(nextSort(sort, c))}>
                    <span>{name}</span>
                    <span className="hb-sort" aria-hidden="true">{sortMark(sort, c)}</span>
                    {c === bestColumn && <span className="hb-chip hb-chip-soft">Best</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!rows.length && <tr><td className="hb-table-empty" colSpan={columns.length}>No rows to show.</td></tr>}
            {order.map((r) => (
              <tr key={r} className={r === bestRow ? "hb-best" : undefined}>
                {rows[r].map((cell, c) => {
                  const big = bigNumber(cell);
                  const direction = change[c] ? changeOf(cell) : null;
                  return (
                    <td key={c} className={cellClass(c, cell, direction ? `hb-${direction}` : "")} title={big?.full}>
                      {change[c] && withBars && <MiniBar value={cellNumber(cell) ?? 0} largest={largest[c]} />}
                      {big ? big.short : <InlineText text={cell} />}
                      {c === 0 && r === bestRow && <span className="hb-chip hb-chip-soft">Best</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A small diverging bar before a change: zero in the middle, coloured like the number beside it. */
function MiniBar({ value, largest }: { value: number; largest: number }) {
  const { left, width } = miniBar(value, largest);
  return (
    <span className="hb-mini" aria-hidden="true">
      <span className="hb-mini-zero" />
      <span className="hb-mini-bar" style={{ left: `${left}%`, width: `${width}%` }} />
    </span>
  );
}

/** The largest size of change in a column, so its biggest bar fills half the track. */
function largestChange(rows: string[][], column: number): number {
  return Math.max(0, ...rows.map((r) => Math.abs(cellNumber(r[column]) ?? 0)));
}

/** ↑ or ↓ on the sorted column; elsewhere a faint ↕ that shows on hover. */
function sortMark(sort: SortState, column: number): string {
  if (!sort || sort.column !== column) return "↕";
  return sort.direction === "up" ? "↑" : "↓";
}

function ariaSort(sort: SortState, column: number): "ascending" | "descending" | undefined {
  if (!sort || sort.column !== column) return undefined;
  return sort.direction === "up" ? "ascending" : "descending";
}
