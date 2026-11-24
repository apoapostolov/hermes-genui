// Options compared side by side. Click a header to sort (up, down, back); the highlighted row gets an accent edge and
// a "Best" chip (a highlighted column, an accent underline on its header). Rises and falls in a change column are
// coloured, with a mini bar from 3 rows up; big amounts are shortened, every digit kept in the hover. The table
// scrolls inside its card (sideways when wide, down past ~520px with the header kept in view), then passes the rest of
// the wheel to the page, so a short table never traps the session's scroll.
// With `interactive: true` the reader can also search the rows, tick the ones that matter and send them to the chat
// — the picked selection is the reader's own message, so it is submitted whatever its length. The word the tools
// row says is only ever the host's own answer, and it waits for it: "Sent to chat" when submit takes it, "Blocked"
// (in the composer) when the command/file guard holds a pick back and the composer acknowledges keeping it, "In the
// composer" when an unacknowledged submit falls into an acknowledged draft, "Send failed — nothing was sent or
// kept" when the surface refuses or dies — and the ticks stay put for a retry in every case. The words wrap
// when the card is too narrow to hold a line: what happened and what to do can always be read whole — a
// narrow hug grows the card taller, never wider than its table.
// A table without that word draws exactly as this file drew before it existed.
// A tick belongs to a ROW, not to a seat: when the source data refreshes underneath an open board, a
// pick whose exact data is still present rides along with it (wherever it moved), and a pick whose
// data was removed or replaced is DISCARDED at that moment — not remembered while hidden, so
// identical data reappearing later is a new row that starts unselected and never re-arms the send.
// The table is never destroyed, and data the reader no longer holds is never sent.
import { useContext, useRef, useState } from "react";
import type { LegacyTable, TableBlock } from "./read";
import { StructuredTable } from "./StructuredTable";
import { bigNumber, changeOf, isChangeColumn, miniBar } from "./cells";
import { cellNumber, isNumberColumn, nextSort, sortedOrder, type SortState } from "./sort";
import { livePicks, pickedMessage, rowKey, rowMatches, selectedRows } from "./pick";
import { BlockActions, SENT_WORDS, type SendResult } from "../../host/actions";
import { InlineText } from "../../lib/InlineText";
import { Icon } from "../../lib/Icon";

// Mini bars need a few rows to compare; with 2 the coloured numbers say it all.
const MINI_BARS_FROM = 3;

export function Table(props: TableBlock) {
  if ("structured" in props && props.structured) return <StructuredTable {...props} />;
  const { columns, rows, highlight, caption, interactive } = props as LegacyTable;
  const [sort, setSort] = useState<SortState>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]); // chosen rows, by their DATA (see pick.rowKey)
  const [sent, setSent] = useState<SendResult | null>(null);
  // Which tap a host answer belongs to: only the LAST tap may put a word on the row — a slow answer from an
  // earlier one must never mislabel the newest choice.
  const taps = useRef(0);
  const { send } = useContext(BlockActions);
  // Removal is real removal: a refresh whose SOURCE data dropped (or replaced) a picked row discards
  // that pick before this render commits — the documented render-phase adjustment for retiring state
  // when the data underneath it changes. Discarding (not hiding) is what keeps a reappearing
  // identical row from silently coming back ticked, armed, and ready to send a choice the reader no
  // longer holds. Unchanged or reordered data keeps every pick, and the reader's own filter hides
  // rows without removing them — it can never discard one.
  const live = livePicks(rows, picked);
  if (live.length !== picked.length) setPicked(live);
  const order = sortedOrder(rows, sort);
  const visible = interactive ? order.filter((r) => rowMatches(rows[r], query)) : order;
  const message = pickedMessage(caption, columns, rows, picked);
  const chosen = selectedRows(rows, picked); // picks whose rows vanished in a refresh are already gone here
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
    <div className={interactive ? "hb-card hb-table-card hb-table-interactive" : "hb-card hb-table-card"}>
      {caption && <div className="hb-chart-title hb-table-caption"><InlineText text={caption} /></div>}
      {interactive && (
        <div className="hb-table-tools">
          <input
            type="search"
            className="hb-table-filter"
            placeholder="Filter rows"
            aria-label="Filter rows"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSent(null);
            }}
          />
          <button
            type="button"
            className="hb-pill"
            aria-label="Send selected rows as context"
            title={chosen.length ? message : undefined}
            disabled={!chosen.length}
            onClick={() => {
              const tap = ++taps.current;
              send(message, { force: true }).then((where) => {
                if (tap === taps.current) setSent(where);
              });
            }}
          >
            <Icon name="spark" size={14} stroke={2.2} /><span className="hb-pill-label">Send selected as context</span>
          </button>
          <span className="hb-table-sent" role="status" aria-live="polite">{sent ? SENT_WORDS[sent] : ""}</span>
        </div>
      )}
      <div className="hb-table-scroll">
        <table className={columns.length >= 3 ? "hb-table hb-table-wide" : "hb-table"}>
          <thead>
            <tr>
              {interactive && <th className="hb-pick" aria-label="Selected rows" />}
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
            {!rows.length && <tr><td className="hb-table-empty" colSpan={interactive ? columns.length + 1 : columns.length}>No rows to show.</td></tr>}
            {interactive && rows.length > 0 && visible.length === 0 && query.trim() && (
              <tr><td className="hb-table-empty" colSpan={columns.length + 1}>Nothing matches “{query.trim()}”.</td></tr>
            )}
            {visible.map((r) => (
              <tr key={r} className={r === bestRow ? "hb-best" : undefined}>
                {interactive && (
                  <td className="hb-pick">
                    <input
                      type="checkbox"
                      checked={picked.includes(rowKey(rows[r]))}
                      onChange={() => {
                        const key = rowKey(rows[r]);
                        setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
                        setSent(null);
                      }}
                      aria-label={`Select row ${rows[r][0] || `#${r + 1}`}`}
                    />
                  </td>
                )}
                {rows[r].map((cell, c) => {
                  const big = bigNumber(cell);
                  const direction = change[c] ? changeOf(cell) : null;
                  const bar = change[c] && withBars ? cellNumber(cell) : null;  // no bar where the value is unknown
                  return (
                    <td key={c} className={cellClass(c, cell, direction ? `hb-${direction}` : "")} title={big?.full}>
                      {bar !== null && <MiniBar value={bar} largest={largest[c]} />}
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
