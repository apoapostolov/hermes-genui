import { describe, expect, it } from "vitest";
import catalog from "../../../core/catalog.json";
import { NO_SEND } from "./fields";
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

describe("follow-ups read", () => {
  // The envelope's `follow_ups`: quiet tappable prompts under the board, each {label, run}. Read like every
  // board word — only the envelope may say it (a block that spells its children `blocks` is not one) — and
  // dropped leniently item by item: both halves are needed, a message Hermes acts on is never offered, and
  // the strip keeps at most four.
  const ups = (data: unknown) => readBlocksNoted(data).followUps;
  const board = (follow_ups: unknown) => ({ blocks: [{ type: "text", text: "Hi" }], follow_ups });

  it("reads well-said follow-ups beside the blocks", () => {
    expect(ups(board([{ label: "Plan day 2", run: "Plan the second day" }]))).toEqual([
      { label: "Plan day 2", run: "Plan the second day" },
    ]);
  });

  it("takes the aliases a reader of buttons already knows", () => {
    expect(ups(board([{ text: "More", ask: "Tell me more" }, { label: "Deeper", message: "Go deeper" }]))).toEqual([
      { label: "More", run: "Tell me more" },
      { label: "Deeper", run: "Go deeper" },
    ]);
  });

  it("says nothing when the board says nothing, or says it any other way", () => {
    expect(ups({ blocks: [{ type: "text", text: "Hi" }] })).toBeUndefined();
    for (const junk of ["keep going", 5, null, true, {}, []]) expect(ups(board(junk))).toBeUndefined();
    for (const junk of ["x", 5, null, {}, { label: "Go" }, { run: "Go on" }]) {
      expect(ups(board([junk]))).toBeUndefined();
    }
  });

  it("keeps an envelope's follow-ups only from an envelope", () => {
    // A lone block, or a section spelling its children `blocks`: its follow_ups is none of the board's business.
    expect(ups({ type: "section", title: "S", blocks: [], follow_ups: [{ label: "Go", run: "More" }] })).toBeUndefined();
    expect(ups({ type: "text", text: "Hi", follow_ups: [{ label: "Go", run: "More" }] })).toBeUndefined();
  });

  it("drops a follow-up whose message Hermes would act on, and notes why", () => {
    const r = readBlocksNoted(board([{ label: "Reset", run: "/reset" }, { label: "Notes", run: "Open @file:notes.md" }, { label: "Good", run: "Tell me more" }]));
    expect(r.followUps).toEqual([{ label: "Good", run: "Tell me more" }]);
    expect(r.dropped.filter((d) => d.why === NO_SEND).map((d) => d.path)).toEqual(["follow_ups.0", "follow_ups.1"]);
  });

  it("keeps the first four and notes the rest", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ label: `Go ${i}`, run: `Continue ${i}` }));
    const r = readBlocksNoted(board(five));
    expect(r.followUps?.length).toBe(4);
    expect(r.dropped.some((d) => d.why.includes("follow-ups"))).toBe(true);
  });

  it("trims the words and keeps them WHOLE — the caps no one asked for would send a different message", () => {
    const r = readBlocksNoted(board([{ label: "  Plan day 2  ", run: "  Plan the second day of my itinerary  " }]));
    expect(r.followUps).toEqual([{ label: "Plan day 2", run: "Plan the second day of my itinerary" }]);
    // The writer stores the entire prompt (blocks/common.py keeps messages whole) and the schema declares no
    // length. A tap must therefore carry exactly what was stored, and a long label must reach the row whole
    // so it WRAPS there — reading them cut (the round-2 defect: a silent slice at 40/300 from the generic
    // caps) sends a different message than the board said and clips a label written to be read.
    const label = "Compare the three days and tell me which evening walk to cut or keep";
    const run = ("Expand every line of this Kyoto plan into a detailed day-by-day itinerary with train " +
      "times, booking links and costs for every hop between the cities. ").repeat(4).trim();
    expect([label.length > 40, run.length > 300]).toEqual([true, true]);
    const whole = readBlocksNoted(board([{ label, run }])).followUps![0];
    expect(whole.label).toBe(label);
    expect(whole.run).toBe(run);
    // aliases carry the same truth — the whole word, however it was named
    const aliased = readBlocksNoted(board([{ text: label, message: run }])).followUps![0];
    expect([aliased.label, aliased.run]).toEqual([label, run]);
  });

  it("drops a blank label or message but keeps its neighbours", () => {
    const r = readBlocksNoted(board([{ label: "Go", run: "More" }, { label: "   ", run: "Next" }, { label: "And", run: "" }]));
    expect(r.followUps).toEqual([{ label: "Go", run: "More" }]);
    expect(r.dropped.map((d) => d.path)).toEqual(["follow_ups.1", "follow_ups.2"]);
  });

  it("rides beside the living words without disturbing them", () => {
    const r = readBlocksNoted({ blocks: [{ type: "text", text: "Hi" }], version: 2, updated_at: "x",
      links: ["7f3a09bc"], follow_ups: [{ label: "Go", run: "More" }] });
    expect([r.version, r.updatedAt, r.links]).toEqual([2, "x", [{ id: "7f3a09bc" }]]);
    expect(r.followUps).toEqual([{ label: "Go", run: "More" }]);
  });
});
