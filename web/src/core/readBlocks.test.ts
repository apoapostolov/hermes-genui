import { describe, expect, it } from "vitest";
import catalog from "../../../core/catalog.json";
import { readBlocks, readBlocksNoted } from "./readBlocks";

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
