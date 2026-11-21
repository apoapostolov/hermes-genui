import { describe, expect, it } from "vitest";
import { readBlocks } from "../../core/readBlocks";

describe("source", () => {
  it("drops non-http links but keeps the text", () => {
    const b = readBlocks([{ type: "source", text: "x", url: "javascript:alert(1)" }]);
    expect(b[0]).toEqual({ type: "source", text: "x" });
  });
  it("joins a list of named sources", () => {
    const b = readBlocks([{ type: "source", sources: [{ name: "ixigo", url: "https://www.ixigo.com/x" }, { name: "Wikipedia" }] }]);
    expect(b[0]).toEqual({ type: "source", text: "ixigo · Wikipedia", url: "https://www.ixigo.com/x" });
  });
  it("reads a structured source list with kind, date and note", () => {
    const b = readBlocks([{ type: "source", title: "Sources", items: [
      { label: "Screener", url: "https://screener.in/x", kind: "web", accessed: "2026-11-17T14:32Z", note: "Quarterly results" },
      { label: "Local export", kind: "file" },
      { label: "Bad link", url: "javascript:alert(1)", kind: "tool" },
      { label: "Estimate", kind: "derived" },
    ] }]);
    expect(b[0]).toEqual({ type: "source", title: "Sources", items: [
      { label: "Screener", url: "https://screener.in/x", kind: "web", accessed: "2026-11-17", note: "Quarterly results" },
      { label: "Local export", kind: "file" },
      { label: "Bad link", kind: "tool" },
      { label: "Estimate", kind: "derived" },
    ] });
  });
  it("drops unlabelled items and caps the list at 32", () => {
    const items = [{ note: "no label" }, ...Array.from({ length: 40 }, (_, i) => ({ label: `S${i}` }))];
    const b = readBlocks([{ type: "source", items }]);
    const block = b[0] as { items: unknown[] };
    expect(block.items.length).toBe(32);
    expect(block.items[0]).toEqual({ label: "S0" });
  });
  it("ignores an unknown kind", () => {
    const b = readBlocks([{ type: "source", items: [{ label: "Odd", kind: "magic" }] }]);
    expect(b[0]).toEqual({ type: "source", items: [{ label: "Odd" }] });
  });
  it("falls back to the line when items keep nothing", () => {
    const b = readBlocks([{ type: "source", text: "screener.in", url: "https://screener.in/x", items: [{ note: "no label" }] }]);
    expect(b[0]).toEqual({ type: "source", text: "screener.in", url: "https://screener.in/x" });
    expect(readBlocks([{ type: "source", text: "screener.in", items: [] }])[0]).toEqual({ type: "source", text: "screener.in" });
  });
  it("reads only label, url, kind, accessed and note", () => {
    const b = readBlocks([{ type: "source", items: [
      { name: "Screener", src: "https://screener.in/x", accessed_at: "2026-11-17" },
      { label: "Screener", src: "https://screener.in/x", href: "https://screener.in/y", accessed_at: "2026-11-17T09:00Z" },
    ] }]);
    expect(b[0]).toEqual({ type: "source", items: [{ label: "Screener" }] });
  });
});
