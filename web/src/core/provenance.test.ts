// One rule, one place: what a board's origins ARE — which top-level source line the exports cite, which words
// the charts add, in draw order, deduped — feeds every export (lib/export.ts: the CSV comment, the Markdown
// footer, the PNG caption) from this one reading, so no file can ever disagree with another about where a
// board's data came from. On this base the reading moves NOTHING: a source line stays drawn where the board put
// it (the footer that absorbs it is a different, unmerged feature) — this file pins the reading, not a drawing.
import { describe, expect, it } from "vitest";
import type { Block } from "../registry";
import { provenanceLine, provenanceOf } from "./provenance";

const heading = { type: "heading", text: "Kyoto" } as Block;
const source = (text: string) => ({ type: "source", text } as Block);
const chart = (src?: string) => ({ type: "chart", spec: { type: "line", x: ["a"], series: [{ data: [1] }], ...(src ? { source: src } : {}) } } as Block);

describe("provenanceOf", () => {
  it("the FIRST top-level source line is the one cited; nothing is moved anywhere", () => {
    const p = provenanceOf([heading, source("First"), source("Second")]);
    expect(p.source?.text).toBe("First");
  });
  it("an ordinary board says nothing of its own: no source, no chart words, no line", () => {
    const p = provenanceOf([heading, chart()]);
    expect(p.source).toBeUndefined();
    expect(p.chartSources).toEqual([]);
    expect(provenanceLine(p)).toBe("");
  });
  it("the charts add their sources once each, in draw order, and never repeat the board's own", () => {
    const p = provenanceOf([source("OpenWeather"), chart("OpenWeather"), chart("Yahoo"), heading, chart("Yahoo"), chart()]);
    expect(p.chartSources).toEqual(["Yahoo"]);
  });
  it("a blank chart source says nothing and is not a line", () => {
    expect(provenanceOf([chart("   "), chart("")]).chartSources).toEqual([]);
  });
  it("a source block carrying only a LIST (#38) still counts as the board's source — its items speak in the body", () => {
    const listed = { type: "source", title: "Where this came from", items: [{ label: "BLS", url: "https://bls.gov" }] } as Block;
    const p = provenanceOf([listed, chart("Yahoo")]);
    expect(p.source).toBeDefined();
    expect(provenanceLine(p)).toBe("Yahoo");  // the one-line word quotes no list; the files' bodies do
  });
});

describe("provenanceLine", () => {
  it("joins exactly the parts the board gave, in its order", () => {
    const p = provenanceOf([source("Kyoto Tourist Board"), chart("OpenWeather"), chart("Yahoo")]);
    expect(provenanceLine(p)).toBe("Kyoto Tourist Board · OpenWeather · Yahoo");
  });
  it("a board with only a source line says just that", () => {
    expect(provenanceLine(provenanceOf([source("Ledger"), heading]))).toBe("Ledger");
  });
  it("nothing said at all is no line — the exports carry no provenance the board did not have", () => {
    expect(provenanceLine(provenanceOf([heading]))).toBe("");
  });
});
