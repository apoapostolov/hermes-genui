// Who a block IS across an update: the canonical form, the identity hash, the carry, and the slot chain.
import { describe, expect, it } from "vitest";
import {
  canonicalize, carriedKey, carryBlocks, carrySource, eachSlot, identityOf, kkey, mintKey, noteMounted,
} from "./living-identity";

const HEADING = { type: "heading", text: "Day 1" };
const TEXT = { type: "text", text: "hello" };
const STAT = { type: "stat", value: "400", label: "sail" };

describe("canonicalization", () => {
  it("key order does not change the identity", () => {
    expect(identityOf({ type: "heading", text: "x" })).toBe(identityOf({ text: "x", type: "heading" }));
  });

  it("the door's positional path is skipped, other words count", () => {
    expect(identityOf({ ...HEADING, path: "3.children.0" })).toBe(identityOf(HEADING));
    expect(identityOf({ ...HEADING, text: "Day 2" })).not.toBe(identityOf(HEADING));
  });

  it("a container's identity excludes what it holds", () => {
    const left = { type: "section", title: "left", children: [TEXT] };
    const right = { type: "section", title: "left", children: [STAT] };
    expect(identityOf(left)).toBe(identityOf(right));  // same own words; the children name themselves
  });

  it("a value holding blocks collapses, a plain value is spelled", () => {
    expect(canonicalize([TEXT], false)).toBe("◇");
    expect(canonicalize(7, false)).toBe("7");
  });
});

describe("the carry", () => {
  it("an insertion keeps every surviving block's mounted key (and the moved one rides it)", () => {
    const prev = [{ ...HEADING }, { ...TEXT }];
    prev.forEach((b, i) => noteMounted(b, String(i)));
    const inserted = { type: "divider" };
    const next = [{ ...HEADING }, inserted, { ...TEXT }];
    carryBlocks(prev as never[], next as never[]);
    expect(next[0]).not.toBe(prev[0]);  // fresh objects from the door — the carry is by words, not identity
    expect(mintKey(next[1])).toContain(":~");  // the divider gets its own mint
  });

  it("a retained block inherits the key it was mounted under", () => {
    const prev = [{ ...STAT }];
    noteMounted(prev[0], "0");
    const next = [{ ...STAT }];
    carryBlocks(prev as never[], next as never[]);
    expect(carriedKey(next[0])).toBe("0");
    expect(carrySource(next[0])).toBe(prev[0]);
  });

  it("a block whose own words changed is honestly replaced: no carry", () => {
    const prev = [{ type: "stat", value: "400", label: "sail" }];
    noteMounted(prev[0], "0");
    const next = [{ type: "stat", value: "500", label: "sail" }];
    carryBlocks(prev as never[], next as never[]);
    expect(carriedKey(next[0])).toBeDefined();   // it has SOME key (a mint)
    expect(carriedKey(next[0])).not.toBe("0");   // and not the vacated one
  });

  it("same-worded twins are told apart by what they hold, never by the slot", () => {
    const twinA = { type: "section", title: "left", children: [{ ...TEXT }] };
    const twinB = { type: "section", title: "left", children: [{ ...STAT }] };
    const prev = [twinA, twinB];
    noteMounted(twinA, "0");
    noteMounted(twinB, "1");
    // The update SWAPS their places: the text-holder now sits right, the stat-holder left.
    const nextA = { type: "section", title: "left", children: [{ ...STAT }] };
    const nextB = { type: "section", title: "left", children: [{ ...TEXT }] };
    const next = [nextA, nextB];
    carryBlocks(prev as never[], next as never[]);
    expect(carriedKey(nextA)).toBe("1");  // it is twinB's successor — its old mounted key, not slot 0
    expect(carriedKey(nextB)).toBe("0");
  });
});

describe("the slot chain", () => {
  it("top-level blocks chain from their own identity", () => {
    const seen: [string, string][] = [];
    eachSlot([HEADING, TEXT], (_b, full, flat) => seen.push([full, flat]));
    expect(seen[0][0]).toBe(seen[0][1]);
    expect(seen[0][0]).not.toBe(seen[1][0]);
  });

  it("two literal twins in one list differ only by occurrence", () => {
    const seen: string[] = [];
    eachSlot([TEXT, { ...TEXT }], (_b, full) => seen.push(full));
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen[1]).toBe(seen[0].replace(/:0$/, ":1"));
  });

  it("children chain under their container, and a moved block changes its chain", () => {
    const container = { type: "section", title: "A", children: [TEXT] };
    const seen: string[] = [];
    eachSlot([container], (_b, full) => seen.push(full));
    expect(seen).toHaveLength(2);                 // the section, then its child
    expect(seen[1].startsWith(seen[0])).toBe(true); // the child chains under it
    const flat = seen[1].split("/").pop();
    const alone: string[] = [];
    eachSlot([{ ...TEXT }], (_b, full) => alone.push(full));
    expect(alone[0]).toBe(flat);                   // same flat identity wherever it sits
  });

  it("kkey marks the filing key", () => {
    expect(kkey("abc:0")).toBe("k:abc:0");
  });
});
