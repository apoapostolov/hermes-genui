import { actsBeforeTheModel, clean, firstList, firstText, firstTextOrNumber, firstWords, https, icon, keepFirst, NO_SEND, type Trail } from "../../core/fields";
import type { IconName } from "../../lib/icons";

export type ListItem = { title: string; subtitle?: string; value?: string; bar?: number; icon?: IconName; image?: string; run?: string; url?: string };
export type ListBlock = { type: "list"; title?: string; ranked: boolean; max?: number; items: ListItem[] };

const MAX_ITEMS = 12;

/**
 * list: rich rows for rankings, search results, places or a short set of picks.
 * - items (also `rows`), up to 12: {title (also `name`/`label`, else `text`), subtitle (also `description`/`detail`/
 *   `note`/`text`), value: the right-hand text (also `price`/`rating`/`score`/`meta`/`badge`; numbers become text, a
 *   null reads "–"), icon or image (https), run (a tap sends it as the user's message) or url (https, opens in the
 *   browser). A plain string is a title-only row. `ask` isn't read: a row sends, it doesn't fill the composer.
 * - ranked: true numbers the rows (also `numbered`). title: optional heading over the list.
 * - max: a number above 0, what a full bar means; the largest bar is used when absent, zero, negative or not a number.
 *   items[].bar: a number (null or anything else draws no bar) gives that row a track against max; `value` stays the
 *   right-hand text, and a row with no value uses the bar number as text.
 *   {type: "list", max: 100, items: [{title: "Rent", bar: 62, value: "62 of 100"}]}
 *   → {type: "list", max: 100, items: [{title: "Rent", bar: 62, value: "62 of 100"}]}
 *   {type: "list", numbered: true, items: ["Third Wave", {name: "Dyu Art Café", description: "Garden seats", rating: 4.6}]}
 *   → {type: "list", ranked: true, items: [{title: "Third Wave"}, {title: "Dyu Art Café", subtitle: "Garden seats", value: "4.6"}]}
 * A row whose run is a command or an @-reference ({title: "B", run: "/reset"}) is dropped, noted NO_SEND.
 * Dropped: no item with a title.
 */
export function readList(raw: any, here: Trail): ListBlock | null {
  const list = firstList([raw.items, raw.rows]);
  if (!list) return here.drop("list needs items");
  const items: ListItem[] = [];
  list.forEach((item, i) => {
    const row = readListItem(item);
    if (!row) {
      here.at("items").at(i).drop("row has no title");
      return;
    }
    if (actsBeforeTheModel(row.run)) {
      here.at("items").at(i).drop(NO_SEND);
      return;
    }
    items.push(row);
  });
  if (!items.length) return here.drop("list has no row with a title");
  const ranked = raw.ranked === true || raw.numbered === true;
  const max = typeof raw.max === "number" && isFinite(raw.max) && raw.max > 0 ? raw.max : undefined;
  return clean({ type: "list" as const, title: firstText([raw.title], 60), ranked, max,
    items: keepFirst(items, MAX_ITEMS, here, "rows") });
}

/**
 * One row, or null when it has no title. With no title, name or label, the row's `text` is its title (up to 160
 * characters: it is all the row says); otherwise `text` is the line under it (up to 160, cut between words).
 *   {text: "**MTR**, the gold standard", score: 5}  → {title: "**MTR**, the gold standard", value: "5"}
 *   {name: "CTR", text: "Benne dosa", badge: "Iconic"} → {title: "CTR", subtitle: "Benne dosa", value: "Iconic"}
 */
function readListItem(item: any): ListItem | null {
  if (typeof item === "string") {
    const title = firstText([item], 80);
    return title ? { title } : null;
  }
  if (!item || typeof item !== "object") return null;
  const named = firstText([item.title, item.name, item.label], 80);
  const title = named ?? firstText([item.text], 160);
  if (!title) return null;
  const textUnder = named ? item.text : undefined;  // a text already used as the title isn't repeated under it
  const bar = typeof item.bar === "number" && isFinite(item.bar) && item.bar >= 0 ? item.bar : undefined;
  return clean({
    title,
    subtitle: firstWords([item.subtitle, item.description, item.detail, item.note, textUnder], 160),
    value: valueOf(item, bar),
    bar,
    icon: icon(item.icon),
    image: https(item.image),
    run: firstText([item.run], 300),
    url: https(item.url),
  });
}

/**
 * The value slot's text: the first of `value`, `price`, `rating`, `score`, `meta`, `badge` the row carries. A null in
 * that field is a value written down as unknown, so the slot reads "–" and not blank; an unreadable one falls through
 * to the next name. A row with none of those fields falls back to its bar number, as the Python text does.
 *   {price: null} → "–";  {rating: 4.6} → "4.6";  {value: "", badge: "Iconic"} → "Iconic";  {} → undefined
 */
function valueOf(item: any, bar: number | undefined): string | undefined {
  for (const field of ["value", "price", "rating", "score", "meta", "badge"]) {
    if (!(field in item)) continue;
    if (item[field] === null) return "–";
    const text = firstTextOrNumber([item[field]], 30);
    if (text !== undefined) return text;
  }
  return bar === undefined ? undefined : firstTextOrNumber([bar], 30);
}
