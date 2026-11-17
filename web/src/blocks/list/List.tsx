// Rich rows: a rank number, then an icon or photo (or, with neither, the title's first letter in a coloured circle), a
// title with a line under it, and a value on the right. A row with `run` sends that message when tapped; a row with a
// url is a plain link that opens in the browser.
import { useContext, useState } from "react";
import { BlockActions } from "../../host/actions";
import type { ListBlock, ListItem } from "./read";
import { InlineText } from "../../lib/InlineText";
import { Icon } from "../../lib/Icon";
import { avatarColour, initialOf, rowLead } from "./rowAvatar";
import { useNamed } from "../../core/a11y";

export function List({ title, ranked, items }: ListBlock) {
  const named = useNamed("list", title);
  return (
    <div className="hb-card hb-list" role="group" {...named.root}>
      {title && <div id={named.title.id} className="hb-list-heading"><InlineText text={title} /></div>}
      {items.map((item, i) => <ListRow key={i} item={item} rank={ranked ? i + 1 : null} />)}
    </div>
  );
}

function ListRow({ item, rank }: { item: ListItem; rank: number | null }) {
  const { send } = useContext(BlockActions);
  const [photoFailed, setPhotoFailed] = useState(false);
  const lead = rowLead(item, rank !== null, photoFailed);
  const body = (
    <>
      {rank !== null && <span className="hb-list-rank">{rank}</span>}
      {lead === "image" && (
        <img className="hb-list-photo" src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} />
      )}
      {lead === "icon" && item.icon && <span className="hb-list-icon"><Icon name={item.icon} size={17} stroke={2.2} /></span>}
      {lead === "initial" && (
        <span className="hb-list-initial" style={{ background: avatarColour(item.title) }} aria-hidden="true">{initialOf(item.title)}</span>
      )}
      <span className="hb-list-body">
        <span className="hb-list-title"><InlineText text={item.title} /></span>
        {item.subtitle && <span className="hb-list-subtitle"><InlineText text={item.subtitle} /></span>}
      </span>
      {item.value && <span className="hb-list-value"><InlineText text={item.value} /></span>}
      {(item.run || item.url) && <Chevron />}
    </>
  );
  if (item.run) {
    const run = item.run;
    return <button type="button" className="hb-list-row hb-list-link hb-list-button" title={run} onClick={() => send(run)}>{body}</button>;
  }
  if (item.url) {
    return <a className="hb-list-row hb-list-link" href={item.url} target="_blank" rel="noreferrer">{body}</a>;
  }
  return <div className="hb-list-row">{body}</div>;
}

function Chevron() {
  return (
    <svg className="hb-list-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
