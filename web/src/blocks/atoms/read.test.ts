// For each, a good input, a sloppy one written the way models write, and a broken one that is dropped with a
// note saying why.
import { describe, expect, it } from "vitest";
import { readBlocks, readBlocksNoted } from "../../core/readBlocks";

describe("callout, heading, text", () => {
  it("maps tone aliases and body", () => {
    expect(readBlocks([{ type: "callout", variant: "warning", body: "Carry cash." }])[0]).toEqual({ type: "callout", tone: "warn", text: "Carry cash." });
  });
  it("reads heading from title and text from content", () => {
    expect(readBlocks([{ type: "heading", title: "Day 1" }, { type: "text", content: "Best before 9am" }])).toEqual([
      { type: "heading", text: "Day 1" }, { type: "text", text: "Best before 9am" },
    ]);
  });
  it("reads a divider", () => {
    expect(readBlocks([{ type: "divider" }])).toEqual([{ type: "divider" }]);
  });
});

describe("atoms", () => {
  it("reads each atom from its canonical fields", () => {
    const r = readBlocksNoted([
      { type: "badge", text: "New", tone: "good" },
      { type: "link", text: "IRCTC", url: "https://www.irctc.co.in" },
      { type: "image", url: "https://x.example/a.jpg", caption: "Ooty lake" },
      { type: "bar", label: "Packed", value: 6, max: 9, unit: "items" },
    ]);
    expect(r.dropped).toEqual([]);
    expect(r.blocks).toEqual([
      { type: "badge", text: "New", tone: "good" },
      { type: "link", text: "IRCTC", url: "https://www.irctc.co.in" },
      { type: "image", url: "https://x.example/a.jpg", caption: "Ooty lake" },
      { type: "bar", label: "Packed", value: 6, max: 9, unit: "items" },
    ]);
  });
  it("takes the aliases models write", () => {
    const r = readBlocksNoted([
      { type: "badge", label: "Sold out", tone: "warning" },
      { type: "badge", text: "Plain", tone: "blue" },
      { type: "link", href: "https://www.irctc.co.in/nget" },
      { type: "image", src: "https://x.example/b.jpg", alt: "Tea gardens" },
      { type: "bar", title: "Budget used", value: 62 },
      { type: "bar", label: "Spent", value: 3, goal: 0 },
    ]);
    expect(r.blocks).toEqual([
      { type: "badge", text: "Sold out", tone: "warn" },
      { type: "badge", text: "Plain" },
      { type: "link", text: "irctc.co.in", url: "https://www.irctc.co.in/nget" },
      { type: "image", url: "https://x.example/b.jpg", caption: "Tea gardens" },
      { type: "bar", label: "Budget used", value: 62, max: 100 },
      { type: "bar", label: "Spent", value: 3, max: 100 },
    ]);
  });
  it("keeps a bar whose value is a written null, and drops one with no value at all", () => {
    const r = readBlocksNoted([
      { type: "bar", label: "Spent", value: null, max: 500, unit: "₹" },
      { type: "bar", label: "Nowhere" },
    ]);
    expect(r.blocks).toEqual([{ type: "bar", label: "Spent", value: null, max: 500, unit: "₹" }]);
    expect(r.dropped.map((d) => d.why)).toEqual(["bar needs a numeric value"]);
  });
  it("drops broken atoms, each with a note", () => {
    const r = readBlocksNoted([
      { type: "badge" }, { type: "link", url: "javascript:alert(1)" }, { type: "image", url: "data:x" },
      { type: "bar", value: 3 }, { type: "bar", label: "x" },
    ]);
    expect(r.blocks).toEqual([]);
    expect(r.dropped.map((d) => d.why)).toEqual([
      "badge needs text", "link needs an https url", "image needs an https url", "bar needs a label", "bar needs a numeric value",
    ]);
  });
});

describe("badge text", () => {
  it("cuts a long badge at a word with an ellipsis instead of mid-word", () => {
    const [badge] = readBlocks([{ type: "badge", text: "Level: technical — linear algebra and probability" }]) as any[];
    expect(badge.text.endsWith("…")).toBe(true);
    expect(badge.text.length).toBeLessThanOrEqual(40);
    expect(badge.text).not.toMatch(/alge…$/);
  });
});
