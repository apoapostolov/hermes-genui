// Needs you | Handled: what the assistant is tracking. A small two-way switch with count badges (red when something is
// overdue, green for what it handled); Needs you shows cards with a state, a pay or renew link the plugin vouched for,
// one help button (it fills the message box) and Details; Handled shows what it closed, follows or flagged, with
// Reopen. The choice of view is remembered in this browser.
import { useContext, useEffect, useState } from "react";
import { BlockActions } from "../../host/actions";
import type { Card, Details, Row, TrackerBlock } from "./read";

const VIEW_KEY = "hermes-genui.tracker.view";
const SEEN_KEY = "hermes-genui.tracker.handled";
type View = "need" | "done";

function stored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private window: not remembered */ }
}

function More({ d }: { d?: Details }) {
  if (!d) return null;
  return (
    <details className="hb-tr-details">
      <summary>Details</summary>
      <dl>
        {d.from && <><dt>From</dt><dd>{d.from}</dd></>}
        {d.received && <><dt>Received</dt><dd>{d.received}</dd></>}
        {d.about.length > 0 && <><dt>About</dt><dd>{d.about.join(" · ")}</dd></>}
        {d.trail.length > 0 && <><dt>So far</dt><dd>{d.trail.join(" → ")}</dd></>}
      </dl>
    </details>
  );
}

function CardView({ card }: { card: Card }) {
  const { fill } = useContext(BlockActions);
  return (
    <article className={`hb-tr-card hb-tr-${card.state}`}>
      <div className="hb-tr-top">
        <span className="hb-tr-title">{card.title}</span>
        {card.amount && <span className="hb-tr-amount">{card.amount}</span>}
      </div>
      {card.stateText && <span className={`hb-tr-pill hb-tr-pill-${card.state}`}>{card.stateText}</span>}
      {(card.link || card.help) && (
        <div className="hb-tr-acts">
          {card.link && <a className="hb-tr-go" href={card.link.url} target="_blank" rel="noreferrer">{card.link.label} ↗</a>}
          {card.help && <button type="button" className="hb-tr-help" onClick={() => fill(card.help!)}>{card.help}</button>}
        </div>
      )}
      <More d={card.details} />
    </article>
  );
}

function RowView({ row, onReopen }: { row: Row; onReopen: (id: string) => void }) {
  return (
    <article className={`hb-tr-row hb-tr-${row.kind}`}>
      <div className="hb-tr-top">
        <span className="hb-tr-title">{row.title}{row.amount ? ` · ${row.amount}` : ""}</span>
        <span className="hb-tr-verb">{row.kind === "closed" ? `✓ ${row.verb}` : row.verb}</span>
      </div>
      {row.why && <span className="hb-tr-why">{row.why}</span>}
      {row.reopen && <button type="button" className="hb-tr-link" onClick={() => onReopen(row.id)}>Reopen</button>}
      <More d={row.details} />
    </article>
  );
}

export function Tracker({ need, handled }: TrackerBlock) {
  const { rest } = useContext(BlockActions);
  const [view, setView] = useState<View>(() => (stored(VIEW_KEY) === "done" ? "done" : "need"));
  const [reopened, setReopened] = useState<string[]>([]);
  const [pulse, setPulse] = useState(false);
  const rows = handled.filter((r) => !reopened.includes(r.id));
  useEffect(() => {
    const before = Number(stored(SEEN_KEY));
    store(SEEN_KEY, String(handled.length));
    if (stored(SEEN_KEY) !== null && Number.isFinite(before) && handled.length > before && before > 0) setPulse(true);
  }, [handled.length]);
  const choose = (v: View) => { setView(v); store(VIEW_KEY, v); };
  const reopen = (id: string) => {
    setReopened((ids) => [...ids, id]);
    void rest?.(`/assistant/items/${id}`, { method: "POST", body: { status: "suggested" } });
  };
  const red = need.some((c) => c.state === "overdue");
  return (
    <div className="hb-tr">
      <div className="hb-tr-switch" role="tablist" aria-label="Needs you or handled">
        <button type="button" role="tab" aria-selected={view === "need"} onClick={() => choose("need")}>
          Needs you <span className={`hb-tr-badge${red ? " hb-tr-badge-red" : ""}`}>{need.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={view === "done"} onClick={() => choose("done")}>
          Handled <span className={`hb-tr-badge hb-tr-badge-green${pulse ? " hb-tr-pulse" : ""}`}>✓ {rows.length}</span>
        </button>
      </div>
      <div className="hb-tr-list" role="tabpanel">
        {view === "need"
          ? (need.length ? need.map((c) => <CardView key={c.id} card={c} />)
            : <p className="hb-tr-empty">Nothing needs you right now.</p>)
          : (rows.length ? rows.map((r) => <RowView key={r.id} row={r} onReopen={reopen} />)
            : <p className="hb-tr-empty">When a payment, renewal or delivery mail arrives, it lands here with the reason.</p>)}
      </div>
    </div>
  );
}
