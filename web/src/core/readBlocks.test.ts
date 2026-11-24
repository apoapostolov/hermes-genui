import { describe, expect, it } from "vitest";
import catalog from "../../../core/catalog.json";
import { alignOf, readBlocks, readBlocksNoted, textAlignOf } from "./readBlocks";

describe("readBlocks", () => {
  it("reads chart, kpis and source; skips unknown types", () => {
    const b = readBlocks([
      { type: "chart", kind: "bar", title: "Rev", x: ["Q1", "Q2"], series: [{ name: "R", data: [1, 2] }], unit: "$M" },
      { type: "kpis", items: [{ label: "Revenue", value: 182.2, unit: "$M", change: 3.8, change_unit: "%" }] },
      { type: "sundial", foo: 1 },
      { type: "source", text: "SEC filings", url: "https://www.sec.gov/x" },
    ]);
    expect(b.map((x) => x.type)).toEqual(["chart", "kpis", "source"]);
    expect(b[0].type === "chart" && b[0].spec.type).toBe("bar");
  });
  it("takes a lone block object, and gives nothing for anything that isn't blocks", () => {
    expect(readBlocks({ type: "heading", text: "Day 1" })).toEqual([{ type: "heading", text: "Day 1" }]);
    expect(readBlocks("just text")).toEqual([]);
    expect(readBlocks(null)).toEqual([]);
    expect(readBlocks({ blocks: [{ type: "heading", text: "Wrapped" }] })).toEqual([{ type: "heading", text: "Wrapped" }]);
  });
  it("notes what it dropped and why", () => {
    const r = readBlocksNoted([{ type: "sundial" }, "x"]);
    expect(r.blocks).toEqual([]);
    expect(r.dropped).toEqual([{ path: "0", why: 'unknown type "sundial"' }, { path: "1", why: "not a block object" }]);
  });
});

describe("catalog parity", () => {
  it("reads every catalog example as exactly one block, with nothing dropped", () => {
    for (const entry of catalog.blocks.filter((b) => b.kind !== "include")) {  // include is resolved before storing
      const read = readBlocksNoted([entry.example]);
      expect([entry.kind, read.blocks.length, read.dropped]).toEqual([entry.kind, 1, []]);
    }
  });
});

describe("long prose", () => {
  // "word0 word1 word2 …", long enough to pass every limit below.
  const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
  const endsCut = (text: string, max: number) => {
    expect(text.length).toBeLessThanOrEqual(max);
    expect(text.length).toBeGreaterThan(max - 12);
    expect(text).toMatch(/ word\d+…$/);
  };

  it("is cut between words with an ellipsis, at each reader's own limit", () => {
    const [text, callout, list, timeline] = readBlocks([
      { type: "text", text: long },
      { type: "callout", text: long },
      { type: "list", items: [{ title: "MTR", subtitle: long }] },
      { type: "timeline", groups: [{ label: "Day 1", items: [{ title: "Lake", note: long }] }] },
    ]) as any[];
    endsCut(text.text, 600);
    endsCut(callout.text, 400);
    endsCut(list.items[0].subtitle, 160);
    endsCut(timeline.groups[0].items[0].note, 160);
  });
});

describe("placement words", () => {
  it("reads the board's own words from the stored envelope", () => {
    const r = readBlocksNoted({ align: "center", text_align: "right", blocks: [{ type: "heading", text: "A" }] });
    expect(r.align).toBe("center");
    expect(r.textAlign).toBe("right");
    expect(r.blocks.map((b) => b.type)).toEqual(["heading"]);
  });

  it("reads a junk board word as nothing said", () => {
    const r = readBlocksNoted({ align: "middle", blocks: [{ type: "heading", text: "A" }] });
    expect(r.align).toBeUndefined();
    expect(r.textAlign).toBeUndefined();
  });

  it("says nothing about the board for a plain list, or a lone block that spells its children blocks", () => {
    expect(readBlocksNoted([{ type: "heading", text: "A" }]).align).toBeUndefined();
    const section = readBlocksNoted({ type: "section", title: "T", blocks: [{ type: "heading", text: "A", align: "center" }] });
    expect(section.align).toBeUndefined(); // the word belongs to the block, not to the board
    expect(alignOf(section.blocks[0])).toBe("center");
  });

  it("carries a block's own asks, and a junk word reads as nothing said", () => {
    const r = readBlocksNoted([
      { type: "heading", text: "A", align: "center", text_align: "right" },
      { type: "text", text: "b", align: "middle", text_align: 7 },
    ]);
    expect(alignOf(r.blocks[0])).toBe("center");
    expect(textAlignOf(r.blocks[0])).toBe("right");
    expect(alignOf(r.blocks[1])).toBeUndefined();
    expect(textAlignOf(r.blocks[1])).toBeUndefined();
  });

  it("reaches each block of a row drawn as a stack, at the row's ask", () => {
    const r = readBlocksNoted([
      { type: "row", align: "center", children: [
        { type: "list", items: [{ title: "x" }] },
        { type: "text", text: "b" },
      ] },
    ]);
    expect(r.blocks.map((b) => b.type)).toEqual(["list", "text"]); // a list can't sit in a row: drawn as a stack
    for (const b of r.blocks) expect(alignOf(b)).toBe("center");
  });

  it("keeps a child's own ask when its flattened container asks too", () => {
    const r = readBlocksNoted([
      { type: "row", align: "center", children: [
        { type: "list", items: [{ title: "x" }] },
        { type: "text", text: "b", align: "right" },
      ] },
    ]);
    expect(alignOf(r.blocks[0])).toBe("center");
    expect(alignOf(r.blocks[1])).toBe("right");
  });
});
