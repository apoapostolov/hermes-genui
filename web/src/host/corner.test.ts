// The export corner's geometry, which the real-Chrome suite (tests/test_export_chrome.py) proves on a laid-out
// board and this file pins as pure numbers: a block's control belongs to ITS OWN top-right corner, clear of the
// tag's global control stack (expand, board menu), and never outside the block that owns it.
import { describe, expect, it } from "vitest";
import { cornerOf, EXPORT_BTN, EXPORT_INSET, GLOBAL_BAND, GLOBAL_GAP, GLOBAL_GUTTER, type Box } from "./ExportChrome";

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

describe("cornerOf: where one block's export control sits", () => {
  it("sits in the block's own top-right corner, inset from its edges", () => {
    const tag = box(0, 0, 640, 500);
    const block = box(40, 100, 640, 400);
    expect(cornerOf(block, tag)).toEqual({ left: 640 - EXPORT_INSET - EXPORT_BTN, top: 100 + EXPORT_INSET });
  });

  it("is measured from the tag, not the viewport", () => {
    const tag = box(300, 200, 940, 700);
    const block = box(340, 300, 940, 600);
    // same relative geometry as the case above
    expect(cornerOf(block, tag)).toEqual({ left: 640 - EXPORT_INSET - EXPORT_BTN, top: 100 + EXPORT_INSET });
  });

  it("slides left of the tag's global stack instead of sitting on it", () => {
    const tag = box(0, 0, 640, 500);
    const block = box(0, 0, 640, 120);          // a full-width block at the very top: the stack's own corner
    const at = cornerOf(block, tag);
    expect(at.left).toBe(640 - GLOBAL_GUTTER - EXPORT_BTN - GLOBAL_GAP);
    expect(at.left + EXPORT_BTN).toBeLessThan(640 - GLOBAL_GUTTER);   // clear of the stack, not under it
    expect(at.top).toBe(EXPORT_INSET);
  });

  it("keeps its own corner when the block is below the stack's band", () => {
    const tag = box(0, 0, 640, 500);
    const block = box(0, GLOBAL_BAND + 10, 640, 400);
    expect(cornerOf(block, tag).left).toBe(640 - EXPORT_INSET - EXPORT_BTN);
  });

  it("never leaves the block it exports: a narrow chart keeps its control inside", () => {
    const tag = box(0, 0, 640, 500);
    const block = box(0, 300, 90, 420);         // narrower than the stack clearance
    const at = cornerOf(block, tag);
    expect(at.left).toBeGreaterThanOrEqual(2);
    expect(at.left + EXPORT_BTN).toBeLessThanOrEqual(90 - 2);
  });

  it("a block narrower than the control still keeps it on the board", () => {
    const tag = box(0, 0, 640, 500);
    const block = box(600, 300, 620, 360);      // 20px wide
    const at = cornerOf(block, tag);
    expect(at.left).toBeGreaterThanOrEqual(600);
    expect(at.left).toBeLessThanOrEqual(620);
  });

  it("never reports a negative position, whatever the tag's own origin is", () => {
    const tag = box(0, 0, 200, 200);
    const block = box(0, 0, 60, 60);
    const at = cornerOf(block, tag);
    expect(at.left).toBeGreaterThanOrEqual(0);
    expect(at.top).toBeGreaterThanOrEqual(0);
  });
});
