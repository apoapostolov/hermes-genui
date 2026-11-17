// For each, a good input, a sloppy one written the way models write, and a broken one that is dropped with a
// note saying why.
import { describe, expect, it } from "vitest";
import { readBlocksNoted } from "../../core/readBlocks";
import { cutAtWord } from "../../core/fields";

const one = (block: unknown) => readBlocksNoted([block]);

describe("tiles", () => {
  it("reads cards, leaving off an unsafe image or an unknown icon", () => {
    const r = one({ type: "tiles", items: [
      { title: "Kyoto", subtitle: "Temples", image: "https://x.example/k.jpg", icon: "walk", ask: "Plan Kyoto" },
      { title: "Nara", image: "javascript:x", icon: "nope", run: "Plan Nara" }] });
    expect(r.dropped).toEqual([]);
    expect(r.blocks).toEqual([{ type: "tiles", items: [
      { title: "Kyoto", subtitle: "Temples", image: "https://x.example/k.jpg", icon: "walk", ask: "Plan Kyoto" },
      { title: "Nara", run: "Plan Nara" }] }]);
  });
  it("takes label/value/note when there is no title or subtitle", () => {
    const r = one({ type: "tiles", tiles: [{ label: "Right now", value: "24°C", note: "0 mm rain", ask: "Weather?" }] });
    expect((r.blocks[0] as any).items).toEqual([{ title: "Right now", subtitle: "24°C · 0 mm rain", ask: "Weather?" }]);
  });

  // The card keeps its cover shape and shows the reason in up to three lines, so the reader cuts it to what three
  // lines hold — about 120 characters — and only ever BETWEEN words (cutAtWord), never mid-word. Behaviour checks
  // only: the exact cut position is the helper's business, not the test's.
  const shortReason = "Take the 08:12 local to Omiya and the Keihin-Tohoku line direct to Tokyo Station — about 85 minutes.";
  const twoSentences = "Take the 08:12 local to Omiya and the Keihin-Tohoku line direct to Tokyo Station — about 85 minutes, and it skips the shinkansen fare. Arriving before nine leaves the whole morning free for the east side, which the later trains cannot give you.";

  it("keeps a reason three lines can hold in full, uncut", () => {
    expect(shortReason.length).toBeLessThanOrEqual(120);
    const r = one({ type: "tiles", items: [{ title: "Local train", subtitle: shortReason, run: "Book the 08:12 local" }] });
    expect((r.blocks[0] as any).items[0].subtitle).toBe(shortReason);
  });
  it("cuts a longer reason to about 120 characters, between words, with an ellipsis", () => {
    expect(twoSentences.length).toBeGreaterThan(200);
    const r = one({ type: "tiles", items: [{ title: "Local train", subtitle: twoSentences, run: "Book the 08:12 local" }] });
    const sub = (r.blocks[0] as any).items[0].subtitle;
    expect(sub.length).toBeLessThanOrEqual(120);   // three lines' worth, no more
    expect(sub.length).toBeGreaterThan(60);        // a real part of the reason, not a stub
    expect(sub.endsWith("…")).toBe(true);
    const kept = sub.slice(0, -1);
    expect(twoSentences.startsWith(kept)).toBe(true);         // the author's own words, in order
    expect(twoSentences[kept.length]).toMatch(/[\s\p{P}]/u);  // stopped at a word boundary, never inside a word
    expect(kept.endsWith(" ")).toBe(false);                   // no dangling space before the ellipsis
  });
  it("cuts between whole words even when the cap lands in the middle of one", () => {
    const uniform = Array.from({ length: 40 }, () => "stationary").join(" ");
    const r = one({ type: "tiles", items: [{ title: "Trains", subtitle: uniform, run: "Compare trains" }] });
    const sub = (r.blocks[0] as any).items[0].subtitle;
    expect(sub.endsWith("…")).toBe(true);
    expect(sub.slice(0, -1).split(" ").every((w: string) => w === "stationary")).toBe(true);  // only whole words survive
  });

  // cutAtWord cuts between words only when a space sits in the back half of the room; when one unbroken run fills
  // it, the helper falls back to slicing the run. A cover must never show half a word, so the tiles cut drops the
  // partial run instead: the whole words that fit stay, and a reason whose very first word cannot fit is left off
  // entirely rather than painted as a slice.
  it("keeps the fitting words whole instead of slicing a too-long unbroken run", () => {
    const r = one({ type: "tiles", items: [{ title: "Trains", subtitle: "short " + "b".repeat(200), run: "Compare trains" }] });
    const sub = (r.blocks[0] as any).items[0].subtitle;
    expect(sub).toBe("short…");   // the word that fits, whole; no partial b's; "…" marks what was dropped
    expect(sub.length).toBeLessThanOrEqual(120);
  });

  // A comma or dash left at the cut is dropped by cutAtWord itself, so the character just past a kept whole word
  // can be punctuation even when nothing was sliced. The tiles cut must read the helper's own boundary condition,
  // not its stripped output: where the helper stopped at a real word boundary its answer stands untouched — a
  // fitting word followed by its comma is content, not a slice to repair.
  it("keeps the helper's boundary cut when it drops a comma after the last whole word", () => {
    const text = "Airport ".repeat(10) + "express, " + "b".repeat(60);
    const r = one({ type: "tiles", items: [{ title: "Flights", subtitle: text, run: "Compare flights" }] });
    const sub = (r.blocks[0] as any).items[0].subtitle;
    expect(sub).toBe("Airport ".repeat(10) + "express…");  // "express" fits whole: it stays
    expect(sub).toBe(cutAtWord(text, 120));                // exactly the helper's own boundary-safe answer
  });
  it("keeps the helper's boundary cut after a dash too", () => {
    const text = "Note ".repeat(16) + "draft— " + "c".repeat(60);
    const r = one({ type: "tiles", items: [{ title: "Hotels", subtitle: text, run: "Compare hotels" }] });
    const sub = (r.blocks[0] as any).items[0].subtitle;
    expect(sub).toBe("Note ".repeat(16) + "draft…");
    expect(sub).toBe(cutAtWord(text, 120));
  });
  it("keeps a first word that fits before its comma instead of dropping the subtitle", () => {
    const text = "x".repeat(80) + ", " + "b".repeat(60);   // the 80-char word ends on a real boundary; the run past it does not fit
    const r = one({ type: "tiles", items: [{ title: "Flights", subtitle: text, run: "Compare flights" }] });
    const sub = (r.blocks[0] as any).items[0].subtitle;
    expect(sub).toBe("x".repeat(80) + "…");                 // kept whole, not dropped with the run
  });
  it("leaves the subtitle off when not even its first word fits", () => {
    const r = one({ type: "tiles", items: [{ title: "Trains", subtitle: "u".repeat(200), run: "Compare trains" }] });
    const item = (r.blocks[0] as any).items[0];
    expect("subtitle" in item).toBe(false);   // graceful: a title-only card, never half a word
    expect(item.title).toBe("Trains");
    expect(item.run).toBe("Compare trains");
  });
  it("never ends a cut reason inside a word, however oddly the text is spaced", () => {
    const shapes = [
      "short " + "b".repeat(200),                                 // long unbroken run after a short word
      "u".repeat(200),                                            // long unbroken run from the first word
      "Pick the local —" + "x".repeat(150),                       // long unbroken run after punctuation
      "Airport ".repeat(10) + "express, " + "b".repeat(60),       // boundary where the helper drops its comma
      "x".repeat(80) + ", " + "b".repeat(60),                     // first word ends on a comma before a long run
      Array.from({ length: 40 }, () => "stationary").join(" "),   // uniform prose the cap must land mid-word on
      "one two three four".repeat(20),                            // ordinary short words
      shortReason,                                                // a reason that fits whole
    ];
    for (const text of shapes) {
      const r = one({ type: "tiles", items: [{ title: "Trains", subtitle: text, run: "Compare trains" }] });
      const sub: string | undefined = (r.blocks[0] as any).items[0].subtitle;
      const kept = sub === undefined ? "" : sub.endsWith("…") ? sub.slice(0, -1) : sub;
      expect(kept.length).toBeLessThanOrEqual(120);
      expect(text.startsWith(kept)).toBe(true);                   // the author's own words, in order
      const word = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
      // Inside a word means word characters on BOTH sides of the cut. A comma, dash or space the helper left
      // (or dropped) at the stop is what separates words — a cut ending "…express" with its comma next is on
      // a boundary, not mid-word; a cut inside "bbb…" has b's on both sides.
      const betweenWords = !(word(text[kept.length - 1]) && word(text[kept.length]));
      expect(betweenWords, `the cut landed inside a word: ${text.slice(0, 24)}…`).toBe(true);
    }
  });

  it("drops tiles without a title, and keeps at most 8", () => {
    const r = one({ type: "tiles", items: [{ subtitle: "no title" }] });
    expect(r.blocks).toEqual([]);
    expect(r.dropped).toEqual([{ path: "0.items.0", why: "tile has no title" }, { path: "0", why: "tiles has no item with a title" }]);
    const many = one({ type: "tiles", items: Array.from({ length: 10 }, (_, i) => ({ title: `t${i}`, ask: "x" })) });
    expect((many.blocks[0] as any).items.length).toBe(8);
  });
});
