// tiles: cover cards to explore; a tap puts a question in the composer (ask) or sends a message (run).
import { actsBeforeTheModel, clean, cutAtWord, firstList, https, icon, keepFirst, NO_SEND, str, textOrNumber, type Trail } from "../../core/fields";
import type { IconName } from "../../lib/icons";

export type TileItem = { title: string; subtitle?: string; image?: string; icon?: IconName; ask?: string; run?: string };
export type TilesBlock = { type: "tiles"; items: TileItem[] };

const MAX_TILES = 8;
// The subtitle is the tile's readable decision reason, shown in up to three lines on a card that keeps its cover
// shape (the height comes from the aspect-ratio, never from the text). So the reader cuts the reason to what three
// lines hold — about 120 characters — between words, never mid-word; the rest ends in "…". cutAtWord does that
// while a space sits in the back half of the room and otherwise falls back to slicing one long unbroken run, so
// the tiles cut below repairs that slice: a cover never paints half a word. (The catalog asks for a few words;
// this cut is what keeps a two-sentence reason off a cover when a model writes one anyway.)
const SUBTITLE_MAX = 120;
// The fields a tile's title may come in, best first: models often write a `label` (or only a `text`) for a card.
const TITLE_FIELDS = ["title", "label", "name", "caption", "text"];
// The fields that say more about the tile, in the order they're joined under the title.
const MORE_FIELDS = ["subtitle", "value", "text", "caption", "note", "description"];

/**
 * The tiles subtitle cut, built on the shared cutAtWord: at most SUBTITLE_MAX characters, always cut between whole
 * words, "…" marking what was left out. cutAtWord already does this while a space falls in the back half of the
 * room; when one unbroken run takes the room it falls back to slicing the run, and here that partial word is
 * dropped instead — the whole words that fit stay. Which branch the helper took is read from its own condition on
 * the text, never from its answer: the answer has already dropped the comma or dash left at a good boundary, and
 * mistaking that strip for a slice would throw away a fitting word. When not even the first word fits the answer
 * is "": the tile goes without a subtitle rather than paint half a word.
 *   ("short " + "b".repeat(200)) → "short…";  ("…express, " + "b"×60) → "…express…";  ("u".repeat(200)) → ""
 */
function cutSubtitle(text: string): string {
  const cut = cutAtWord(text, SUBTITLE_MAX);
  if (cut === text) return cut;                       // fits whole: nothing to cut
  const room = text.slice(0, SUBTITLE_MAX - 1);       // the same room the helper cut inside
  const lastSpace = room.search(/\s\S*$/);
  if (lastSpace > SUBTITLE_MAX / 2) return cut;       // the helper's real word boundary — even with its comma dropped
  const whole = room.slice(0, Math.max(lastSpace, 0)).replace(/[\s,;:.–—-]+$/, "");
  return whole ? `${whole}…` : "";                    // sliced run: partial word goes; unless it was the first word
}

/**
 * tiles: cover cards, up to 8 (items, also `tiles`). Each needs a title; an image must be https and an icon one of the
 * icon names (otherwise that field is left off and the tile stays).
 *   {type: "tiles", items: [{title: "Kyoto", image: "javascript:x", icon: "nope", run: "Plan Kyoto"}, {subtitle: "no title"}]}
 *   → {type: "tiles", items: [{title: "Kyoto", run: "Plan Kyoto"}]}
 * A tile whose ask or run is a command or an @-reference ({title: "B", ask: "/reset"}) is dropped, noted NO_SEND.
 * Dropped: no item with a title.
 */
export function readTiles(raw: any, here: Trail): TilesBlock | null {
  const list = firstList([raw.items, raw.tiles]);
  if (!list) return here.drop("tiles needs items");
  const items: TileItem[] = [];
  list.forEach((item, i) => {
    const tile = readTile(item);
    if (!tile) {
      here.at("items").at(i).drop("tile has no title");
      return;
    }
    if (actsBeforeTheModel(tile.ask) || actsBeforeTheModel(tile.run)) {
      here.at("items").at(i).drop(NO_SEND);
      return;
    }
    items.push(tile);
  });
  if (!items.length) return here.drop("tiles has no item with a title");
  return { type: "tiles", items: keepFirst(items, MAX_TILES, here, "tiles") };
}

/**
 * One tile, or null when no field can be its title. The first of TITLE_FIELDS is the title; the rest of its text
 * (MORE_FIELDS, minus the one used as the title) goes under it, joined with " · ".
 *   {label: "Right now", value: "24°C", note: "0 mm rain"} → {title: "Right now", subtitle: "24°C · 0 mm rain"}
 *   {subtitle: "no title"} → null
 */
function readTile(item: any): TileItem | null {
  if (!item || typeof item !== "object") return null;
  const titleField = TITLE_FIELDS.find((f) => str(item[f]) !== undefined);
  if (!titleField) return null;
  const more: string[] = [];
  for (const f of MORE_FIELDS) {
    // No per-field cut: the joined subtitle gets the one word-safe cut below (cutSubtitle), so a reason longer
    // than the cap ends in "…" at a word boundary — whole words only, never a slice of one.
    const text = textOrNumber(item[f], Infinity);
    if (f !== titleField && text !== undefined) more.push(text);
  }
  const subtitle = more.length ? cutSubtitle(more.join(" · ")) || undefined : undefined;
  return clean({
    title: str(item[titleField], 40)!, subtitle, image: https(item.image), icon: icon(item.icon),
    ask: str(item.ask, 300), run: str(item.run, 300),
  });
}
