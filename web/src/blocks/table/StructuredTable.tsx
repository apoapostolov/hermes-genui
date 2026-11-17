import { useMemo, useState } from "react";
import { formatAmount, formatNumber, formatPercent } from "../../lib/format";
import type { Aggregate, AggregateOp, StructuredRow, StructuredTable, TableCell, TableColumn } from "./read";

const PAGE = 10;

function shown(cell: TableCell | undefined, column: TableColumn): string {
  if (!cell) return "–";
  if (cell.value === undefined) return cell.text;
  if (column.kind === "currency") return formatAmount(cell.value, column.unit) ?? formatNumber(cell.value);
  if (column.kind === "percent") return formatPercent(cell.value);
  if (column.kind === "number" || column.kind === "bar") return formatNumber(cell.value);
  return cell.text;
}

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

/** A table with typed columns, a local filter, ten-row pages, a computed footer and source chips. */
export function StructuredTable({ caption, columns, rows, filterable, page, aggregates }: StructuredTable) {
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(page);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((row) => columns.some((c) => {
      const cell = row.cells[c.id];
      return `${cell?.text ?? ""} ${row.sources.map((s) => s.label).join(" ")}`.toLowerCase().includes(needle);
    }));
  }, [rows, columns, needle]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(at, pages);
  const slice = filtered.slice((current - 1) * PAGE, current * PAGE);

  return (
    <div className="hb-card hb-table hb-table-structured">
      <table className="hb-table-grid">
        {caption && <caption className="hb-table-caption">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => <th key={c.id} scope="col" className={c.align ? `hb-align-${c.align}` : undefined}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {slice.map((row, i) => (
            <tr key={`${(current - 1) * PAGE + i}`}>
              {columns.map((column, ci) => (
                <td key={column.id} className={column.align ? `hb-align-${column.align}` : undefined}>
                  {column.kind === "sources" ? (
                    <span className="hb-table-sources">
                      {row.sources.length ? row.sources.map((s, si) => s.url ? (
                        <a key={si} href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
                      ) : <span key={si}>{s.label}</span>
                      ) : <span className="hb-table-empty">–</span>}
                    </span>
                  ) : column.kind === "bar" ? (
                    <span className="hb-table-bar">
                      <span className="hb-table-bar-fill"
                        style={{ width: `${Math.min(100, Math.max(0, ((row.cells[column.id]?.value ?? 0) / (column.max ?? Math.max(1, ...rows.map((r) => r.cells[column.id]?.value ?? 0)))) * 100))}%` }} />
                      <span className="hb-table-bar-value">{shown(row.cells[column.id], column)}</span>
                    </span>
                  ) : column.kind === "badge" ? (
                    <span className={`hb-chip hb-chip-${row.cells[column.id]?.tone ?? column.tone ?? "plain"}`}>
                      {shown(row.cells[column.id], column)}
                    </span>
                  ) : column.kind === "link" && row.cells[column.id]?.url ? (
                    <a href={row.cells[column.id].url} target="_blank" rel="noreferrer">{shown(row.cells[column.id], column)}</a>
                  ) : (
                    <span>{shown(row.cells[column.id], column)}</span>
                  )}
                  {ci === 0 && row.sources.length > 0 && column.kind !== "sources" && (
                    <span className="hb-table-source-hint" aria-label={`Sources: ${row.sources.map((s) => s.label).join(", ")}`}>•</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
          {!slice.length && <tr><td colSpan={columns.length} className="hb-table-empty-cell">No rows match.</td></tr>}
        </tbody>
        {aggregates.length > 0 && (
          <tfoot>
            <tr>
              {columns.map((column, ci) => {
                const a = aggregates.find((item) => item.column === column.id);
                if (!a) return <td key={column.id} />;
                const value = aggregateValue(filtered, a);
                return <td key={column.id}>
                  <span className="hb-table-aggregate-label">{ci === 0 ? a.label : aggregateLabel(a.op)}</span>
                  {value !== null ? ` ${formatNumber(value)}` : " –"}
                </td>;
              })}
            </tr>
          </tfoot>
        )}
      </table>
      {(filterable || pages > 1) && (
        <div className="hb-table-tools">
          {filterable && <input type="search" value={query} placeholder="Filter rows" aria-label="Filter rows"
            onChange={(e) => { setQuery(e.target.value); setAt(1); }} />}
          {pages > 1 && <div className="hb-table-pages">
            <button type="button" disabled={current === 1} onClick={() => setAt(Math.max(1, current - 1))} aria-label="Previous page">‹</button>
            <span>Page {current} of {pages}</span>
            <button type="button" disabled={current === pages} onClick={() => setAt(Math.min(pages, current + 1))} aria-label="Next page">›</button>
          </div>}
        </div>
      )}
    </div>
  );
}
