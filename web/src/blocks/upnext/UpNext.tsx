// What's coming, after Odie's Today: a row of cards you swipe through, each with its weekday and where it came from,
// the day as a big number, an illustration for its kind, the title, and the time or amount. A tap asks about it.
import { useContext, type CSSProperties } from "react";
import { BlockActions } from "../../host/actions";
import { EventArt, kindVars } from "../../lib/EventArt";
import { Icon } from "../../lib/Icon";
import type { UpNextBlock, UpNextItem } from "./read";

const dayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function Card({ item, compact }: { item: UpNextItem; compact?: boolean }) {
  const { fill } = useContext(BlockActions);
  const day = dayOf(item.date);
  return (
    <button type="button" className="hb-up-card" style={kindVars(item.kind) as CSSProperties}
      onClick={() => fill(item.ask ?? `Tell me about ${item.title}`)}>
      <span className="hb-up-top">
        <span>
          <span className="hb-up-weekday">
            {day.toLocaleDateString("en-GB", { weekday: "short" })}
            {item.source && <span className="hb-up-source" title={item.source === "mail" ? "From mail" : "From calendar"}>
              <Icon name={item.source === "mail" ? "mail" : "cal"} size={11} stroke={2.4} /></span>}
          </span>
          <span className="hb-up-day">{day.getDate()}</span>
        </span>
        <EventArt kind={item.kind} size={compact ? 36 : 56} />
      </span>
      <span className="hb-up-title">{item.title}</span>
      {item.state && item.stateText && (
        <span className={`hb-up-state hb-up-state-${item.state}`}>{item.stateText}</span>)}
      {(item.time || item.amount) && <span className="hb-up-meta">{item.time ?? item.amount}</span>}
    </button>
  );
}

export function UpNext({ title, items, compact }: UpNextBlock) {
  return (
    <div className="hb-up">
      {title && <div className="hb-up-heading">{title}</div>}
      <div className={compact ? "hb-up-row hb-up-compact" : "hb-up-row"}>
        {items.map((item, i) => <Card key={i} item={item} compact={compact} />)}
      </div>
    </div>
  );
}
