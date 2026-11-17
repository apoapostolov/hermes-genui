// tabs: a bar of labelled tabs, each holding its own blocks; the reader switches views by clicking. Top level only.
import { firstList, firstText, keepFirst, type Trail } from "../../core/fields";
import type { ReadChild } from "../../core/types";
import type { Block } from "../../registry";

export type Tab = { label: string; children: Block[]; badge?: number };
export type TabsBlock = { type: "tabs"; tabs: Tab[] };

const MAX_TABS = 6;
const MAX_LABEL = 30;
const MAX_BADGE = 999;

/**
 * tabs → the tabs block, or one tab's children in its place, or nothing.
 * - tabs (also `items`): [{label (also `title`; cut to 30), children (also `items`, `blocks`, `content`), badge}]. A
 *   tab's children are read as if at the top level, so columns and sections work inside one. `badge` is an optional
 *   count shown beside the label: a whole number from 1 to 999, else left off.
 * - A tab without a label, or with no child that can be drawn, is dropped (noted). At most 6 tabs (the rest noted).
 * - One usable tab left: its children are drawn in place. None: the tabs are dropped.
 * - Not at the top level (inside a container, or inside another tab): flattened, drawing the first usable tab's
 *   children in place.
 * Example at the top level:
 *   {type: "tabs", tabs: [{label: "Rent", children: [table]}, {label: "", children: [x]}, {label: "Buy", children: [chart]}]}
 *   → [{type: "tabs", tabs: [{label: "Rent", children: [table]}, {label: "Buy", children: [chart]}]}], noting tabs.1
 *   The same inside a section → [table], noted "tabs go at the top level only; first tab drawn in place".
 */
export function readTabs(raw: any, here: Trail, depth: number, readChild: ReadChild, inTab = false): Block[] {
  const list = firstList([raw.tabs, raw.items]) ?? [];
  const flatten = depth > 0 || inTab;
  const tabs: Tab[] = [];
  for (let i = 0; i < list.length; i++) {
    const tab = readTab(list[i], here.at("tabs").at(i), depth, readChild);
    if (!tab) continue;
    tabs.push(tab);
    if (flatten) break;  // only the first is drawn, so the rest aren't read
  }
  if (!tabs.length) {
    here.drop("tabs has no tab it can draw");
    return [];
  }
  if (flatten) {
    here.drop("tabs go at the top level only; first tab drawn in place");
    return tabs[0].children;
  }
  if (tabs.length === 1) {
    here.drop("tabs has only one tab; drawn in place");
    return tabs[0].children;
  }
  return [{ type: "tabs", tabs: keepFirst(tabs, MAX_TABS, here, "tabs") }];
}

/** One tab; null (noted) when it has no label or nothing to draw.
 *  {label: "Rent", children: [{type: "text", text: "x"}]} → {label: "Rent", children: [text]};  {label: "Rent", children: []} → null */
function readTab(item: any, here: Trail, depth: number, readChild: ReadChild): Tab | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return here.drop("tab is not an object");
  const label = firstText([item.label, item.title], MAX_LABEL);
  if (!label) return here.drop("tab needs a label");
  const children = readTabChildren(firstList([item.children, item.items, item.blocks, item.content]) ?? [], here, depth, readChild);
  if (!children.length) return here.drop("tab has no children it can draw");
  const badge = item.badge;
  return Number.isInteger(badge) && badge >= 1 && badge <= MAX_BADGE ? { label, children, badge } : { label, children };
}

/** A tab's children, read at the tab's depth (0 at the top level, so columns and sections are drawn). A tabs block
 *  sitting directly in a top-level tab is flattened like any nested tabs, its own children still read at depth 0.
 *  [text, {type: "tabs", tabs: [{label: "A", children: [columns]}, …]}] at depth 0 → [text, columns] */
function readTabChildren(list: unknown[], here: Trail, depth: number, readChild: ReadChild): Block[] {
  const out: Block[] = [];
  list.forEach((child, i) => {
    const at = here.at("children").at(i);
    if (depth === 0 && (child as any)?.type === "tabs") out.push(...readTabs(child, at, 0, readChild, true));
    else out.push(...readChild(child, at, depth));
  });
  return out;
}
