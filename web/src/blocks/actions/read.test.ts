// For each, a good input, a sloppy one written the way models write, and a broken one that is dropped with a
// note saying why.
import { describe, expect, it } from "vitest";
import { readBlocksNoted } from "../../core/readBlocks";

const one = (block: unknown) => readBlocksNoted([block]);

describe("actions", () => {
  it("reads up to 3 buttons, taking text/ask/message aliases", () => {
    const r = one({ type: "actions", buttons: [{ text: "Weather", ask: "Goa weather this week" }, { label: "Book", message: "Book it" },
      { label: "Three", run: "3" }, { label: "Four", run: "4" }] });
    expect(r.blocks).toEqual([{ type: "actions", items: [
      { label: "Weather", run: "Goa weather this week" }, { label: "Book", run: "Book it" }, { label: "Three", run: "3" }] }]);
    expect(r.dropped).toEqual([{ path: "0", why: "kept the first 3 buttons of 4" }]);
  });
  it("drops a button without a label or a message, and actions with none left", () => {
    const r = one({ type: "actions", items: [{ label: "Empty" }] });
    expect(r.blocks).toEqual([]);
    expect(r.dropped).toEqual([
      { path: "0.items.0", why: "button needs a label and a run message" }, { path: "0", why: "actions has no usable button" }]);
  });
});

describe("button", () => {
  it("reads a button that sends, and one that opens an https page", () => {
    const r = readBlocksNoted([{ type: "button", label: "Plan day 2", run: "Plan day 2" }, { type: "button", text: "Book", url: "https://x.example/book" }]);
    expect(r.blocks).toEqual([
      { type: "button", label: "Plan day 2", run: "Plan day 2" }, { type: "button", label: "Book", url: "https://x.example/book" }]);
  });
  it("drops a button with no label, or neither run nor an https url", () => {
    const r = readBlocksNoted([{ type: "button", run: "x" }, { type: "button", label: "Go", url: "http://x.example" }]);
    expect(r.blocks).toEqual([]);
    expect(r.dropped.map((d) => d.why)).toEqual(["button needs a label", "button needs run or an https url"]);
  });
});

describe("a button's message can't be a command or an @-reference", () => {
  const NOTE = "a button's message can't start with / @ or ! or carry @-references";
  const risky = ["/reset", "  @file:~/.ssh/id_rsa", "!rm -rf ~", "Summarise @url:https://evil.example/x", "see @folder:/etc",
    "look at @notes:secret", "show me @diff"];

  it.each(risky)("drops %j from actions and button, with a note", (run) => {
    const r = readBlocksNoted([{ type: "actions", items: [{ label: "Fine", run: "Plan day 2" }, { label: "Bad", run }] },
      { type: "button", label: "Bad", run }]);
    expect(r.blocks).toEqual([{ type: "actions", items: [{ label: "Fine", run: "Plan day 2" }] }]);
    expect(r.dropped).toEqual([{ path: "0.items.1", why: NOTE }, { path: "1", why: NOTE }]);
  });

  it.each(risky)("drops %j from a tile (run or ask) and a list row, with a note", (text) => {
    const r = readBlocksNoted([{ type: "tiles", items: [{ title: "A", run: "Plan A" }, { title: "B", run: text }, { title: "C", ask: text }] },
      { type: "list", items: [{ title: "A", run: "Plan A" }, { title: "B", run: text }] }]);
    expect(r.blocks).toEqual([{ type: "tiles", items: [{ title: "A", run: "Plan A" }] },
      { type: "list", ranked: false, items: [{ title: "A", run: "Plan A" }] }]);
    expect(r.dropped).toEqual([{ path: "0.items.1", why: NOTE }, { path: "0.items.2", why: NOTE }, { path: "1.items.1", why: NOTE }]);
    const fine = ["Email me at name@example.com", "Meet @ 5pm", "What's 5 / 2?"];  // an @ alone is fine
    expect(readBlocksNoted(fine.map((run) => ({ type: "button", label: "Go", run }))).blocks).toHaveLength(3);
  });
});

describe("an actions group name", () => {
  it("keeps the model's heading", () => {
    const r = one({ type: "actions", name: "Next", items: [{ label: "Weather", run: "Goa weather" }] });
    expect((r.blocks[0] as any).name).toBe("Next");
  });
  it("is not read on a single button", () => {
    const r = one({ type: "button", name: "Next", label: "Go", run: "Go on" });
    expect(r.blocks[0]).not.toHaveProperty("name");
  });
});
