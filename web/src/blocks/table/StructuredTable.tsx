// A table with typed columns, a local filter, ten-row pages, a computed footer and source chips.
// With `interactive: true` it becomes a work surface too: the search row, a tick column and one button whose label
// IS the state ("Select" with nothing ticked, "Send" with a selection) that sends the ticked rows into the chat as
// one message. The selection is the reader's own message, written by ticking rows, so it is submitted whatever
// its length; the command/file guard still holds it back (text about trust, not about who typed it), and a tap the
// host refuses falls back to the composer. The word under
// the tools is only ever the host's own answer, and only the LAST tap may write it. A tick belongs to the
// row's DATA, not to a seat, a page or a hidden filter, so it rides filtering and paging and survives a
// refresh that keeps the data (pick.ts has the whole rule). A table without that word draws exactly what it
// drew before it existed.
import { useContext, useMemo, useRef, useState } from "react";
import { BlockActions, type SendResult } from "../../host/actions";
import { Icon } from "../../lib/Icon";
import { formatNumber } from "../../lib/format";
import { shownCell } from "./cells";
import { livePicks, pickedMessage, rowKey, rowMatches, selectedRows } from "./pick";
import type { Aggregate, AggregateOp, StructuredRow, StructuredTable as TableBlock } from "./read";

const PAGE = 10;

/** Where the last tap went, in as few words as stay true. A word never claims more than the host
 *  acknowledged: no draft without an ack, no send without a yes, and a refusal that kept nothing says so. */
const SENT_WORDS: Record<SendResult, string> = {
  sent: "Sent to chat.",
  drafted: "In the composer. Press Send.",
  blocked: "In the composer. Blocked from sending.",
  failed: "Send failed. Nothing was kept.",
  nowhere: "No chat here.",
};

function aggregateValue(rows: StructuredRow[], a: Aggregate): number | null {
  const values = rows.map((r) => r.cells[a.column]?.value).filter((v): v is number => v !== undefined);
  if (a.op === "count") return values.length;
  if (!values.length) return null;
  if (a.op === "sum") return values.reduce((s, v) => s + v, 0);
  if (a.op === "avg") return values.reduce((s, v) => s + v, 0) / values.length;
  if (a.op === "min") return Math.min(...values);
  return Math.max(...values);
}

function aggregateLabel(op: AggregateOp): string {
  return { sum: "Total", avg: "Average", min: "Lowest", max: "Highest", count: "Count" }[op];
}

/** What the button says: a process ("Select") while nothing is ticked, an action ("Send") once something is.
 *  The accessible name and the hover carry the rest, so the pill stays narrow where a card hugs a narrow table. */
function sendLabel(chosen: number): string {
  return chosen ? "Send" : "Select";
}

export function StructuredTable({ caption, columns, rows, filterable, page, aggregates, interactive }: TableBlock) {
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(page);
  const [picked, setPicked] = useState<string[]>([]); // ticked rows, by their DATA (see pick.rowKey)
  // The last answer AND the message it answers: a word may only describe the selection on screen right now, so a
  // choice that changed while the host was thinking can never be labelled with the old message's result.
  const [answer, setAnswer] = useState<{ text: string; where: SendResult } | null>(null);
  // Which tap an answer belongs to: only the LAST tap may write the word, so a slow answer from an earlier one
  // never mislabels the newest choice.
  const taps = useRef(0);
  const { send } = useContext(BlockActions);
  // Removal is real removal: a refresh whose SOURCE data dropped (or replaced) a ticked row discards that tick
  // before this render commits, the documented render-phase adjustment for retiring state when the data
  // underneath it changes. Discarding, not hiding, is what keeps a reappearing identical row from coming back
  // ticked and armed to send a choice the reader no longer holds.
  const live = livePicks(rows, columns, picked);
  if (live.length !== picked.length) setPicked(live);
  const searching = filterable || interactive;
  const filtered = useMemo(() => {
    if (!searching) return rows;
    return rows.filter((row) => rowMatches(row, columns, query));
  }, [rows, columns, query, searching]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(at, pages);
  const slice = filtered.slice((current - 1) * PAGE, current * PAGE);
  // React keys follow the ROW'S DATA, not its seat: a refresh that reorders rows keeps each row's DOM node, and any
  // focus inside it, with its own data, so Space still ticks the row the reader had focused. Identical rows are told
  // apart by how many copies came before them, since equal data is one selection but two rows on screen.
  const rowKeys = useMemo(() => {
    const seen = new Map<string, number>();
    const byRow = new Map<StructuredRow, string>();
    for (const row of rows) {
      const base = rowKey(row, columns);
      const copy = seen.get(base) ?? 0;
      seen.set(base, copy + 1);
      byRow.set(row, `${base}#${copy}`);
    }
    return byRow;
  }, [rows, columns]);
  const chosen = selectedRows(rows, columns, picked);
  const message = pickedMessage(caption, columns, rows, picked);
  const span = columns.length + (interactive ? 1 : 0);

  return (
    <div className={`hb-card hb-table-card hb-table hb-table-structured${interactive ? " hb-table-interactive" : ""}`}>
      <table className="hb-table-grid">
        {caption && <caption className="hb-table-caption">{caption}</caption>}
        <thead>
          <tr>
            {interactive && <th className="hb-pick" scope="col" aria-label="Select" />}
            {columns.map((c) => <th key={c.id} scope="col" className={c.align ? `hb-align-${c.align}` : undefined}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {slice.map((row, i) => {
            const key = rowKey(row, columns);
            const first = columns[0] ? shownCell(row.cells[columns[0].id], columns[0]) : "";
            return (
              <tr key={rowKeys.get(row) ?? rowKey(row, columns)}>
                {interactive && (
                  <td className="hb-pick">
                    <input
                      type="checkbox"
                      checked={picked.includes(key)}
                      onChange={() => {
                        setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
                      }}
                      aria-label={`Select row ${first || `#${(current - 1) * PAGE + i + 1}`}`}
                    />
                  </td>
                )}
                {columns.map((column, ci) => (
                  <td key={column.id} className={column.align ? `hb-align-${column.align}` : undefined}>
                    {column.kind === "sources" ? (
                      <span className="hb-table-sources">
                        {row.sources.length ? row.sources.map((s, si) => s.url ? (
                          <a key={si} href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
                        ) : <span key={si}>{s.label}</span>
                        ) : <span className="hb-table-empty">{shownCell(undefined, column)}</span>}
                      </span>
                    ) : column.kind === "bar" ? (
                      <span className="hb-table-bar">
                        <span className="hb-table-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(0, ((row.cells[column.id]?.value ?? 0) / (column.max ?? Math.max(1, ...rows.map((r) => r.cells[column.id]?.value ?? 0)))) * 100))}%` }} />
                        <span className="hb-table-bar-value">{shownCell(row.cells[column.id], column)}</span>
                      </span>
                    ) : column.kind === "badge" ? (
                      <span className={`hb-chip hb-chip-${row.cells[column.id]?.tone ?? column.tone ?? "plain"}`}>
                        {shownCell(row.cells[column.id], column)}
                      </span>
                    ) : column.kind === "link" && row.cells[column.id]?.url ? (
                      <a href={row.cells[column.id].url} target="_blank" rel="noreferrer">{shownCell(row.cells[column.id], column)}</a>
                    ) : (
                      <span>{shownCell(row.cells[column.id], column)}</span>
                    )}
                    {ci === 0 && row.sources.length > 0 && column.kind !== "sources" && (
                      <span className="hb-table-source-hint" aria-label={`Sources: ${row.sources.map((s) => s.label).join(", ")}`}>•</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          {!slice.length && (
            <tr>
              <td colSpan={span} className="hb-table-empty-cell">
                {searching && query.trim() ? `Nothing matches “${query.trim()}”.` : "No rows match."}
              </td>
            </tr>
          )}
        </tbody>
        {aggregates.length > 0 && (
          <tfoot>
            <tr>
              {interactive && <td className="hb-pick" />}
              {columns.map((column, ci) => {
                const a = aggregates.find((item) => item.column === column.id);
                if (!a) return <td key={column.id} />;
                const value = aggregateValue(filtered, a);
                return <td key={column.id}>
                  <span className="hb-table-aggregate-label">{ci === 0 ? a.label : aggregateLabel(a.op)}</span>
                  {value !== null ? ` ${formatNumber(value)}` : ` ${shownCell(undefined, column)}`}
                </td>;
              })}
            </tr>
          </tfoot>
        )}
      </table>
      {(searching || pages > 1 || interactive) && (
        <div className="hb-table-tools">
          {searching && <input type="search" value={query} placeholder="Filter rows" aria-label="Filter rows"
            onChange={(e) => { setQuery(e.target.value); setAt(1); }} />}
          {interactive && (
            <button
              type="button"
              className="hb-pill hb-table-send"
              title={chosen.length ? message : "Tick a row, then send it"}
              aria-label={chosen.length
                ? `Send ${chosen.length} selected ${chosen.length === 1 ? "row" : "rows"} to the chat`
                : "Select a row to send to the chat"}
              disabled={!chosen.length}
              onClick={() => {
                const tap = ++taps.current;
                void send(message, { force: true }).then((where) => {
                  if (tap === taps.current) setAnswer({ text: message, where });
                });
              }}
            >
              <Icon name="spark" size={14} stroke={2.2} /><span className="hb-pill-label">{sendLabel(chosen.length)}</span>
            </button>
          )}
          {pages > 1 && <div className="hb-table-pages">
            <button type="button" disabled={current === 1} onClick={() => setAt(Math.max(1, current - 1))} aria-label="Previous page">‹</button>
            <span>Page {current} of {pages}</span>
            <button type="button" disabled={current === pages} onClick={() => setAt(Math.min(pages, current + 1))} aria-label="Next page">›</button>
          </div>}
        </div>
      )}
      {interactive && (
        <div className="hb-table-status" role="status" aria-live="polite">
          {answer && answer.text === message ? SENT_WORDS[answer.where] : ""}
        </div>
      )}
    </div>
  );
}
