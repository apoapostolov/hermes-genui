// For each, a good input, a sloppy one written the way models write, and a broken one that is dropped with a
// note saying why.
import { describe, expect, it } from "vitest";
import { readBlocksNoted } from "../../core/readBlocks";

const one = (block: unknown) => readBlocksNoted([block]);

describe("checklist", () => {
  it("reads a title, numbered items and groups, and remembers where it sits", () => {
    const r = one({ type: "checklist", title: "Ooty", numbered: true,
      items: [{ text: "Jacket", group: "Clothes" }, { text: "Passport", group: "Papers" }] });
    expect(r.dropped).toEqual([]);
    expect(r.blocks).toEqual([{ type: "checklist", title: "Ooty", numbered: true, ticked: [], path: "0",
      items: [{ text: "Jacket", group: "Clothes" }, { text: "Passport", group: "Papers" }] }]);
  });
  it("takes plain strings, tasks, title/label aliases, done items and groups of items", () => {
    expect(one({ type: "checklist", tasks: ["Book cab", { title: "Pay rent", done: true }], ordered: true }).blocks[0]).toEqual(
      { type: "checklist", numbered: true, ticked: [1], path: "0", items: [{ text: "Book cab" }, { text: "Pay rent" }] });
    expect(one({ type: "checklist", label: "Packing", groups: [{ title: "Clothes", items: ["Jacket", { label: "Socks", checked: true }] }] }).blocks[0]).toEqual(
      { type: "checklist", title: "Packing", numbered: false, ticked: [1], path: "0",
        items: [{ text: "Jacket", group: "Clothes" }, { text: "Socks", group: "Clothes" }] });
  });
  it("knows its path inside a container", () => {
    const r = readBlocksNoted([{ type: "text", text: "Hi" }, { type: "section", title: "Trip", children: [{ type: "badge", text: "New" }, { type: "checklist", items: ["Tickets"] }] }]);
    expect((r.blocks[1] as any).children[1]).toMatchObject({ type: "checklist", path: "1.children.1" });
  });
  it("drops items without text and keeps 40, with notes; drops a checklist with nothing to tick", () => {
    const r = one({ type: "checklist", items: ["Ok", { done: true }, 7, ...Array.from({ length: 41 }, (_, i) => `Item ${i}`)] });
    expect((r.blocks[0] as any).items.length).toBe(40);
    expect(r.dropped).toEqual([
      { path: "0.items.1", why: "item has no text" }, { path: "0.items.2", why: "item has no text" },
      { path: "0", why: "kept the first 40 items of 42" }]);
    expect(one({ type: "checklist", items: [] }).dropped).toEqual([{ path: "0", why: "checklist has no item with text" }]);
  });
});

describe("checklist item ids", () => {
  it("keeps an item's id, so a tick can follow the item", () => {
    const read = one({ type: "checklist", items: [{ text: "Pay Xfinity", id: "a1b2" }, "Reply to Emma"] }).blocks[0];
    expect((read as { items: unknown[] }).items).toEqual([{ text: "Pay Xfinity", id: "a1b2" }, { text: "Reply to Emma" }]);
  });
});

describe("checklist item state, owner and note", () => {
  it("keeps the state, owner and note an item carries", () => {
    const r = one({ type: "checklist", title: "Archive move", items: [
      { text: "Copy the 2019 shard", state: "active", owner: "Priya" },
      { text: "Verify checksums", state: "blocked", note: "Waiting on the storage team" },
      { text: "Backfill the 2020 shard", state: "skipped" },
      { text: "Announce the cutover", state: "pending" },
      "Freeze writes",
    ] });
    expect(r.dropped).toEqual([]);
    expect(r.blocks[0]).toEqual({ type: "checklist", title: "Archive move", numbered: false, ticked: [], path: "0", items: [
      { text: "Copy the 2019 shard", state: "active", owner: "Priya" },
      { text: "Verify checksums", state: "blocked", note: "Waiting on the storage team" },
      { text: "Backfill the 2020 shard", state: "skipped" },
      { text: "Announce the cutover", state: "pending" },
      { text: "Freeze writes" },
    ] });
  });
  it("reads state done as a starting tick, like done: true, and keeps no state on it", () => {
    const r = one({ type: "checklist", items: [{ text: "Bump the manifest", state: "done" }, { text: "Publish", done: true }, "Post"] });
    expect(r.dropped).toEqual([]);
    expect(r.blocks[0]).toEqual({ type: "checklist", numbered: false, ticked: [0, 1], path: "0",
      items: [{ text: "Bump the manifest" }, { text: "Publish" }, { text: "Post" }] });
  });
  it("leaves an unknown state out with a note at the item's path, and keeps the item", () => {
    const r = one({ type: "checklist", groups: [{ label: "Move", items: [{ text: "Ship", state: "waiting" }, { text: "Tell Priya", state: "Active" }] }] });
    expect(r.blocks[0]).toMatchObject({ items: [{ text: "Ship", group: "Move" }, { text: "Tell Priya", group: "Move" }] });
    expect(r.dropped).toEqual([
      { path: "0.groups.0.items.0", why: "item state is pending, active, done, blocked or skipped" },
      { path: "0.groups.0.items.1", why: "item state is pending, active, done, blocked or skipped" }]);
  });
  it("trims an owner at 40 characters and a note at 120, and drops an empty one", () => {
    const r = one({ type: "checklist", items: [
      { text: "One", owner: `  ${"o".repeat(60)}  `, note: "n".repeat(200) },
      { text: "Two", owner: "   ", note: "" },
    ] });
    const items = (r.blocks[0] as { items: { owner?: string; note?: string }[] }).items;
    expect(items[0].owner).toBe("o".repeat(40));
    expect(items[0].note).toBe("n".repeat(120));
    expect(items[1]).toEqual({ text: "Two" });
  });
});
