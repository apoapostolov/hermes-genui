// The living-board words on the door's envelope: version, updated_at, links. And the rule that an
// unsaid board — a plain list, or a lone block whose children field happens to be named `blocks` —
// answers with NO living words at all.
import { describe, expect, it } from "vitest";
import { readBlocksNoted } from "./readBlocks";

const HEADING = { type: "heading", text: "Portfolio · Q4" };
const TEXT = { type: "text", text: "three holdings" };

describe("living-board envelope words", () => {
  it("a plain list says nothing living", () => {
    const noted = readBlocksNoted([HEADING, TEXT]);
    expect(noted.blocks).toHaveLength(2);
    expect(noted.version).toBeUndefined();
    expect(noted.updatedAt).toBeUndefined();
    expect(noted.links).toBeUndefined();
  });

  it("an envelope answers its blocks plus its version words", () => {
    const noted = readBlocksNoted({ blocks: [HEADING], version: 2, updated_at: "2026-11-19T21:00:00+00:00" });
    expect(noted.blocks).toHaveLength(1);
    expect(noted.version).toBe(2);
    expect(noted.updatedAt).toBe("2026-11-19T21:00:00+00:00");
  });

  it("a version word that isn't a whole number says nothing", () => {
    expect(readBlocksNoted({ blocks: [HEADING], version: "2" }).version).toBeUndefined();
    expect(readBlocksNoted({ blocks: [HEADING], version: 0 }).version).toBeUndefined();
    expect(readBlocksNoted({ blocks: [HEADING], version: 2.5 }).version).toBeUndefined();
  });

  it("links ride by address, with their notes", () => {
    const noted = readBlocksNoted({ blocks: [HEADING], links: [{ id: "aabbccdd", note: "last quarter" }, "1234abcd"] });
    expect(noted.links).toEqual([{ id: "aabbccdd", note: "last quarter" }, { id: "1234abcd" }]);
  });

  it("a link that names no address is dropped with a note, the rest survive", () => {
    const noted = readBlocksNoted({ blocks: [HEADING], links: [{ id: "not-hex" }, { id: "aabbccdd" }] });
    expect(noted.links).toEqual([{ id: "aabbccdd" }]);
    expect(noted.dropped.some((d) => d.why.includes("address"))).toBe(true);
  });

  it("at most three links are kept", () => {
    const four = ["aabbccdd", "1234abcd", "5678abcd", "9abcabcd"].map((id) => ({ id }));
    const noted = readBlocksNoted({ blocks: [HEADING], links: four });
    expect(noted.links).toHaveLength(3);
  });

  it("a lone block that spells its children `blocks` is not an envelope and says no living words", () => {
    // Pre-existing unwrap: {type, blocks:[...]} at the top flattens to its children. That shape must not
    // grow a version reading — a block's field names, not a board's words.
    const noted = readBlocksNoted({ type: "heading", blocks: [TEXT], version: 2 });
    expect(noted.version).toBeUndefined();
  });

  it("an empty links list says nothing", () => {
    expect(readBlocksNoted({ blocks: [HEADING], links: [] }).links).toBeUndefined();
  });
});
