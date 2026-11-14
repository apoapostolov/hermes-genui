// Cover cards to explore: a photo (or a colour wash), an optional icon, a title and a line. A tap on a card with `ask`
// puts its question in the composer for the user to send; one with `run` sends its message at once.
import { useContext, useState } from "react";
import { BlockActions } from "../../host/actions";
import type { TileItem } from "./read";
import { Icon } from "../../lib/Icon";

// Chart colours dark enough for white text (amber, cyan and lime are too light), taken in turn.
const WASHES = [1, 4, 8, 3, 6];

export function Tiles({ items }: { items: TileItem[] }) {
  return <div className="hb-tiles">{items.map((tile, i) => <Tile key={i} tile={tile} wash={WASHES[i % WASHES.length]} />)}</div>;
}

/**
 * What a tap on a tile does: run sends at once, ask fills the composer, neither does nothing (the card is disabled).
 *   {run: "Add a Gion walk"} → send("Add a Gion walk");  {ask: "Add Arashiyama"} → fill("Add Arashiyama")
 */
function tapOf(tile: TileItem, send: (t: string) => void, fill: (t: string) => void): (() => void) | undefined {
  if (tile.run) return () => send(tile.run!);
  if (tile.ask) return () => fill(tile.ask!);
  return undefined;
}

function Tile({ tile, wash }: { tile: TileItem; wash: number }) {
  const { send, fill } = useContext(BlockActions);
  const [photoFailed, setPhotoFailed] = useState(false);
  const tap = tapOf(tile, send, fill);
  const colour = `var(--hb-chart-${wash})`;
  const content = (
    <>
      {tile.image && !photoFailed && (
        <img src={tile.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} />
      )}
      <span className="hb-tile-shade" />
      {tile.icon && <span className="hb-tile-icon"><Icon name={tile.icon} size={18} stroke={2.2} /></span>}
      <span className="hb-tile-text">
        <span className="hb-tile-title">{tile.title}</span>
        {tile.subtitle && <span className="hb-tile-subtitle">{tile.subtitle}</span>}
      </span>
    </>
  );
  const style = { background: `linear-gradient(140deg, ${colour}, color-mix(in srgb, ${colour} 55%, #140c24))` };
  return tap
    ? <button type="button" className="hb-tile" onClick={tap} title={tile.run} style={style}>{content}</button>
    : <div className="hb-tile hb-tile-static" style={style}>{content}</div>;
}
