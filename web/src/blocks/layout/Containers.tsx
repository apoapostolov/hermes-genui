// Containers only arrange blocks that are already drawn: side by side, in a titled card, or in a grid.
import { useState, type ReactNode } from "react";
import { InlineText } from "../../lib/InlineText";
import { useNamed } from "../../core/a11y";

/** Side by side, wrapping onto the next line when there's no room (each part wants about 140px). */
// Small pieces that keep their own width in a row (a pill, a button, a link); everything else shares the row's width.
const OWN_WIDTH_KINDS = ["badge", "button", "link"];

export function Row({ kinds, children }: { kinds: string[]; children: ReactNode[] }) {
  return (
    <div className="hb-row">
      {children.map((child, i) => (
        <div key={i} className={OWN_WIDTH_KINDS.includes(kinds[i]) ? "hb-row-cell hb-row-cell-own" : "hb-row-cell"}>{child}</div>
      ))}
    </div>
  );
}

/** Two or more columns, as many as fit. */
export function Grid({ children }: { children: ReactNode[] }) {
  return <div className="hb-grid">{children.map((child, i) => <div key={i} className="hb-grid-cell">{child}</div>)}</div>;
}

/** Big blocks side by side on a wide screen (each column at least ~380px); they stack when there's no room. */
export function Columns({ children }: { children: ReactNode[] }) {
  return <div className="hb-columns">{children.map((child, i) => <div key={i} className="hb-column">{child}</div>)}</div>;
}

/** A titled card. collapsed: an accordion that starts closed; click the title to open it. */
export function Section({ title, collapsed, children }: { title?: string; collapsed: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!collapsed);
  const named = useNamed("section", title);
  if (!collapsed) {
    return (
      <div className="hb-card hb-section" role="group" {...named.root}>
        {title && <div id={named.title.id} className="hb-card-title"><InlineText text={title} /></div>}
        <div className="hb-section-body">{children}</div>
      </div>
    );
  }
  return (
    <div className="hb-card hb-section" role="group" {...named.root}>
      <button type="button" className="hb-section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span id={named.title.id} className="hb-card-title"><InlineText text={title ?? ""} /></span>
        <svg className={open ? "hb-chevron hb-chevron-open" : "hb-chevron"} width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {open && <div className="hb-section-body hb-appear">{children}</div>}
    </div>
  );
}
