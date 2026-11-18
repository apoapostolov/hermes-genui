// checklist: things to do or pack, or steps to follow; the user ticks them off and the ticks are saved with the board.
// An item can also say where the work stands (state), who holds it (owner) and why it waits (note).
import { clean, firstList, firstText, keepFirst, type Trail } from "../../core/fields";

/** The words a model may write for an item's state. "done" is read as a tick, so a read item never carries it. */
export const CHECKLIST_STATES = ["pending", "active", "done", "blocked", "skipped"] as const;
export type ChecklistState = (typeof CHECKLIST_STATES)[number];
export type ItemState = Exclude<ChecklistState, "done">;
export const STATE_RULE = "item state is pending, active, done, blocked or skipped";

/** text: what to do. group: the heading its items share. id: a short stable name for the item.
 *  state: where the work stands. owner: who holds it, up to 40 characters. note: one line under the text, up to 120. */
export type ChecklistItem = { text: string; group?: string; id?: string; state?: ItemState; owner?: string; note?: string };
/** path: where the checklist sits in the stored board ("2", "0.children.1"): its ticks are saved under that key.
 *  ticked: the items the model said are already done (the starting ticks, before anything is saved). */
export type ChecklistBlock = { type: "checklist"; title?: string; numbered: boolean; items: ChecklistItem[]; ticked: number[]; path: string };

const MAX_ITEMS = 40;

/**
 * checklist: items to tick off.
 * - items (also `tasks`, `steps`), up to 40: a string, or {text (also `title`/`label`/`name`), group (also
 *   `section`/`category`), done: true for one already done, state: pending | active | done | blocked | skipped,
 *   owner (40 characters), note (120 characters)}. Items with the same group are drawn under one heading.
 * - groups: [{label (also `title`/`name`), items: [...]}] works too: each item takes its group's label.
 * - numbered: true numbers the items (also `ordered`). title: optional (also `label`).
 *   {type: "checklist", title: "Archive move", groups: [{label: "Shards", items: [{text: "Copy 2019", state: "active"},
 *   {text: "Freeze writes", state: "done"}, {text: "Verify", state: "blocked", note: "Waiting on storage"}]}], ordered: true}
 *   → {type: "checklist", title: "Archive move", numbered: true, items: [{text: "Copy 2019", group: "Shards", state: "active"},
 *      {text: "Freeze writes", group: "Shards"}, {text: "Verify", group: "Shards", state: "blocked", note: "Waiting on storage"}],
 *      ticked: [1], path: "0"}
 * Dropped: no item with text (and each item without text, with a note); an item state that is not one of the five,
 * with a note, and the item kept without it.
 */
export function readChecklist(raw: any, here: Trail): ChecklistBlock | null {
  const found = collectItems(raw, here);
  if (!found.length) return here.drop("checklist has no item with text");
  const kept = keepFirst(found, MAX_ITEMS, here, "items");
  const items: ChecklistItem[] = [];
  const ticked: number[] = [];
  kept.forEach((item, i) => {
    items.push(clean({ text: item.text, group: item.group, id: item.id, state: item.state, owner: item.owner, note: item.note }));
    if (item.done) ticked.push(i);
  });
  const numbered = raw.numbered === true || raw.ordered === true;
  const title = firstText([raw.title, raw.label], 80);
  return clean({ type: "checklist" as const, title, numbered, items, ticked, path: here.path });
}

type Found = { text: string; group?: string; done: boolean; id?: string; state?: ItemState; owner?: string; note?: string };

/** The items wherever the model put them: a flat list (items, tasks, steps), then lists inside groups.
 *  {items: ["A"], groups: [{label: "G", items: ["B"]}]} → [{text: "A"}, {text: "B", group: "G"}] (each with done: false) */
function collectItems(raw: any, here: Trail): Found[] {
  const found: Found[] = [];
  const flat = firstList([raw.items, raw.tasks, raw.steps]);
  flat?.forEach((item, i) => {
    const read = readItem(item, undefined, here.at("items").at(i));
    if (read) found.push(read);
    else here.at("items").at(i).drop("item has no text");
  });
  const groups = firstList([raw.groups, raw.sections]) ?? [];
  groups.forEach((g: any, gi) => {
    const label = firstText([g?.label, g?.title, g?.name], 60);
    const list = firstList([g?.items, g?.tasks]) ?? [];
    list.forEach((item, i) => {
      const read = readItem(item, label, here.at("groups").at(gi).at("items").at(i));
      if (read) found.push(read);
      else here.at("groups").at(gi).at("items").at(i).drop("item has no text");
    });
  });
  return found;
}

/** One item → its text, group, done flag and the optional state, owner and note; null when it has no text.
 *  "Passport" → {text: "Passport", done: false};  {label: "Socks", category: "Clothes", done: true} → {text: "Socks", group: "Clothes", done: true};
 *  {text: "Copy", state: "active", owner: "Priya"} → {text: "Copy", done: false, state: "active", owner: "Priya"} */
function readItem(item: any, groupLabel: string | undefined, here: Trail): Found | null {
  if (typeof item === "string") {
    const text = firstText([item], 160);
    if (!text) return null;
    return { text, group: groupLabel, done: false };
  }
  if (!item || typeof item !== "object") return null;
  const text = firstText([item.text, item.title, item.label, item.name], 160);
  if (!text) return null;
  const group = firstText([item.group, item.section, item.category], 60) ?? groupLabel;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 40) : undefined;
  const state = readState(item.state, here);
  return {
    text, group, id,
    done: item.done === true || item.checked === true || state === "done",
    state: state === "done" ? undefined : state,
    owner: firstText([item.owner], 40),
    note: firstText([item.note], 120),
  };
}

/** An item's state, one of the five words; undefined when absent. An unknown word is left out with a note at the
 *  item's path (the item is still drawn).
 *  "blocked" → "blocked";  "Active" → undefined, with a note;  undefined → undefined */
function readState(raw: unknown, here: Trail): ChecklistState | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string" && (CHECKLIST_STATES as readonly string[]).includes(raw)) return raw as ChecklistState;
  here.drop(STATE_RULE);
  return undefined;
}
