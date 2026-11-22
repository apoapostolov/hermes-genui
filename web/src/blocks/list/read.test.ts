// For each, a good input, a sloppy one written the way models write, and a broken one that is dropped with a
// note saying why.
import { describe, expect, it } from "vitest";
import { readBlocksNoted } from "../../core/readBlocks";

const one = (block: unknown) => readBlocksNoted([block]);

describe("list", () => {
  it("keeps a null value as a dash in the value slot, not as a blank row", () => {
    const r = one({ type: "list", items: [{ title: "Shop A", value: null }, { title: "Shop B", value: null, badge: "Iconic" }, { title: "Shop C" }] });
    expect((r.blocks[0] as any).items).toEqual([{ title: "Shop A", value: "–" }, { title: "Shop B", value: "–" }, { title: "Shop C" }]);
  });
  it("reads rich rows, ranked, with an icon, a photo and a link", () => {
    const r = one({ type: "list", title: "Cafés", ranked: true, items: [
      { title: "Third Wave", subtitle: "Koramangala 5th Block", value: "4.5", icon: "food" },
      { title: "Dyu Art Café", image: "https://x.example/dyu.jpg", url: "https://dyu.example" }] });
    expect(r.dropped).toEqual([]);
    expect(r.blocks).toEqual([{ type: "list", title: "Cafés", ranked: true, items: [
      { title: "Third Wave", subtitle: "Koramangala 5th Block", value: "4.5", icon: "food" },
      { title: "Dyu Art Café", image: "https://x.example/dyu.jpg", url: "https://dyu.example" }] }]);
  });
  it("takes strings, name/description/rating aliases, numbered, and refuses unsafe links and unknown icons", () => {
    const r = one({ type: "list", numbered: true, items: ["Matamaal", { name: "Dyu", description: "Garden seats", rating: 4.6, url: "javascript:x", icon: "nope", image: "http://x.example/a.jpg" }] });
    expect(r.blocks).toEqual([{ type: "list", ranked: true, items: [{ title: "Matamaal" }, { title: "Dyu", subtitle: "Garden seats", value: "4.6" }] }]);
  });
  it("uses text as the title when there is no name, and as the line under it when there is", () => {
    const r = one({ type: "list", rows: [{ text: "**MTR**, the gold standard", score: 5 }, { name: "CTR", text: "Benne dosa", badge: "Iconic" }] });
    expect((r.blocks[0] as any).items).toEqual([
      { title: "**MTR**, the gold standard", value: "5" },
      { title: "CTR", subtitle: "Benne dosa", value: "Iconic" },
    ]);
  });
  it("reads bars and max, using the bar as the right-hand text when no value was written", () => {
    const r = one({ type: "list", max: 100, items: [
      { title: "Rent", bar: 62, value: "62 of 100" },
      { title: "Travel", bar: 128 },
      { title: "Mubi", bar: null, value: "no data" },
      { title: "Broken", bar: -1 }] });
    expect(r.blocks[0]).toEqual({ type: "list", ranked: false, max: 100, items: [
      { title: "Rent", value: "62 of 100", bar: 62 },
      { title: "Travel", value: "128", bar: 128 },
      { title: "Mubi", value: "no data" },
      { title: "Broken" }] });
    const largest = one({ type: "list", items: [{ title: "A", bar: 30 }, { title: "B", bar: 60 }] });
    expect((largest.blocks[0] as any).max).toBeUndefined();
  });
  it("keeps run (a tap sends it) and ignores ask", () => {
    const r = one({ type: "list", items: [{ title: "Third Wave", run: "Directions to Third Wave", ask: "Open?" }] });
    expect((r.blocks[0] as any).items).toEqual([{ title: "Third Wave", run: "Directions to Third Wave" }]);
  });
  it("drops rows without a title, and a list with none left; keeps at most 12", () => {
    const r = one({ type: "list", items: [{ subtitle: "no title" }] });
    expect(r.blocks).toEqual([]);
    expect(r.dropped).toEqual([{ path: "0.items.0", why: "row has no title" }, { path: "0", why: "list has no row with a title" }]);
    const many = one({ type: "list", items: Array.from({ length: 14 }, (_, i) => `Row ${i}`) });
    expect((many.blocks[0] as any).items.length).toBe(12);
    expect(many.dropped).toEqual([{ path: "0", why: "kept the first 12 rows of 14" }]);
  });
});

describe("list rows that run", () => {
  it("keeps run on a row; ask isn't read (rows send, they don't fill the composer)", () => {
    const r = one({ type: "list", items: [{ title: "Third Wave", run: "Directions to Third Wave" }, { title: "Dyu", ask: "Open?" }] });
    expect((r.blocks[0] as any).items).toEqual([{ title: "Third Wave", run: "Directions to Third Wave" }, { title: "Dyu" }]);
  });
});
