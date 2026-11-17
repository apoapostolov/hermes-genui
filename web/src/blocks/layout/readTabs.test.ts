import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, readBlocksNoted } from "../../core/readBlocks";

const text = (t: string) => ({ type: "text", text: t });
const table = { type: "table", columns: ["A"], rows: [["x"]] };
const tab = (label: unknown, children: unknown[]) => ({ label, children });

describe("tabs", () => {
  it("reads labelled tabs, each holding blocks read as if at the top level", () => {
    const r = readBlocksNoted([{ type: "tabs", tabs: [
      tab("Overview", [text("a"), { type: "columns", children: [table, table] }]),
      tab("Details", [{ type: "section", title: "S", children: [text("b")] }]),
    ] }]);
    expect(r.dropped).toEqual([]);
    expect(r.blocks.length).toBe(1);
    const tabs = r.blocks[0] as any;
    expect(tabs.type).toBe("tabs");
    expect(tabs.tabs.map((t: any) => t.label)).toEqual(["Overview", "Details"]);
    expect(tabs.tabs[0].children.map((b: any) => b.type)).toEqual(["text", "columns"]);
    expect(tabs.tabs[1].children.map((b: any) => b.type)).toEqual(["section"]);
    expect(BLOCK_TYPES).toContain("tabs");
  });
  it("drops unlabelled and empty tabs with notes, and keeps at most 6", () => {
    const r = readBlocksNoted([{ type: "tabs", tabs: [
      tab("A", [text("a")]), tab("", [text("x")]), tab("Empty", []), tab("Broken", [{ type: "text" }]), "nope",
      ...["B", "C", "D", "E", "F", "G"].map((l) => tab(l, [text(l)])),
    ] }]);
    expect((r.blocks[0] as any).tabs.map((t: any) => t.label)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(r.dropped).toEqual([
      { path: "0.tabs.1", why: "tab needs a label" },
      { path: "0.tabs.2", why: "tab has no children it can draw" },
      { path: "0.tabs.3.children.0", why: "text needs text" },
      { path: "0.tabs.3", why: "tab has no children it can draw" },
      { path: "0.tabs.4", why: "tab is not an object" },
      { path: "0", why: "kept the first 6 tabs of 7" },
    ]);
  });
  it("keeps a tab's count badge when it's a whole number from 1 to 999, and quietly leaves any other off", () => {
    const r = readBlocksNoted([{ type: "tabs", tabs: [
      { ...tab("Bills", [text("a")]), badge: 4 }, { ...tab("Orders", [text("b")]), badge: 0 },
      { ...tab("Replies", [text("c")]), badge: "3" }, { ...tab("Done", [text("d")]), badge: 2.5 },
      { ...tab("All", [text("e")]), badge: 1000 },
    ] }]);
    expect((r.blocks[0] as any).tabs.map((t: any) => t.badge)).toEqual([4, undefined, undefined, undefined, undefined]);
    expect(r.dropped).toEqual([]);
  });
  it("cuts a long label to 30 characters", () => {
    const r = readBlocksNoted([{ type: "tabs", tabs: [tab("x".repeat(40), [text("a")]), tab("B", [text("b")])] }]);
    expect((r.blocks[0] as any).tabs[0].label).toBe("x".repeat(30));
  });
  it("draws a lone usable tab's children in place, and drops tabs with none", () => {
    const one = readBlocksNoted([{ type: "tabs", tabs: [tab("A", [text("a"), text("b")]), tab("", [text("c")])] }]);
    expect(one.blocks).toEqual([text("a"), text("b")]);
    expect(one.dropped).toContainEqual({ path: "0", why: "tabs has only one tab; drawn in place" });
    const none = readBlocksNoted([{ type: "tabs", tabs: [tab("A", [])] }, { type: "tabs" }]);
    expect(none.blocks).toEqual([]);
    expect(none.dropped).toContainEqual({ path: "0", why: "tabs has no tab it can draw" });
    expect(none.dropped).toContainEqual({ path: "1", why: "tabs has no tab it can draw" });
  });
  it("flattens tabs that aren't at the top level: the first tab's children are drawn in place", () => {
    const inner = { type: "tabs", tabs: [tab("", [text("skip")]), tab("A", [text("a")]), tab("B", [text("b")])] };
    const inSection = readBlocksNoted([{ type: "section", title: "S", children: [inner] }]);
    expect((inSection.blocks[0] as any).children).toEqual([text("a")]);
    expect(inSection.dropped).toEqual([
      { path: "0.children.0.tabs.0", why: "tab needs a label" },
      { path: "0.children.0", why: "tabs go at the top level only; first tab drawn in place" },
    ]);
    const inTab = readBlocksNoted([{ type: "tabs", tabs: [tab("Outer", [inner]), tab("Two", [text("two")])] }]);
    expect((inTab.blocks[0] as any).tabs[0].children).toEqual([text("a")]);
    expect(inTab.dropped).toEqual([
      { path: "0.tabs.0.children.0.tabs.0", why: "tab needs a label" },
      { path: "0.tabs.0.children.0", why: "tabs go at the top level only; first tab drawn in place" },
    ]);
  });
  it("draws columns inside a tab nested in a tab (still top-level width)", () => {
    const inner = { type: "tabs", tabs: [tab("A", [{ type: "columns", children: [table, table] }]), tab("B", [text("b")])] };
    const r = readBlocksNoted([{ type: "tabs", tabs: [tab("Outer", [inner]), tab("Two", [text("two")])] }]);
    expect((r.blocks[0] as any).tabs[0].children.map((b: any) => b.type)).toEqual(["columns"]);
  });
});
