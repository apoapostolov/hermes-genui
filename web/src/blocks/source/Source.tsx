// The small line saying where the data came from, or a numbered list of named sources.
import type { SourceBlock, SourceItem } from "./read";

type SourceProps = Omit<SourceBlock, "type">;

function Row({ item, index }: { item: SourceItem; index: number }) {
  const name = item.url ? (
    <a href={item.url} target="_blank" rel="noreferrer">{item.label}</a>
  ) : (
    <span>{item.label}</span>
  );
  return (
    <li className="hb-source-row">
      <span className="hb-source-n" aria-hidden="true">{index + 1}</span>
      {name}
      {item.kind && <span className={`hb-source-kind hb-source-kind-${item.kind}`}>{item.kind}</span>}
      {item.accessed && <span className="hb-source-accessed">accessed {item.accessed}</span>}
      {item.note && <span className="hb-source-note">{item.note}</span>}
    </li>
  );
}

export function Source({ text, url, title, items }: SourceProps) {
  if (items?.length) {
    return (
      <div className="hb-source hb-source-list">
        {title && <div className="hb-source-head">{title}</div>}
        <ol className="hb-source-rows">
          {items.map((item, i) => <Row key={`${item.label}-${i}`} item={item} index={i} />)}
        </ol>
      </div>
    );
  }
  if (!text) return null;
  if (!url) return <div className="hb-source">{text}</div>;
  return <div className="hb-source"><a href={url} target="_blank" rel="noreferrer">{text}</a></div>;
}
