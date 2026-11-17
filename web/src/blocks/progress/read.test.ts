// For each, a good input, a sloppy one written the way models write, and a broken one that is dropped with a
// note saying why.
import { describe, expect, it } from "vitest";
import { readBlocksNoted } from "../../core/readBlocks";

const one = (block: unknown) => readBlocksNoted([block]);

describe("progress", () => {
  it("reads checkpoints in order and drops a broken one", () => {
    const r = one({ type: "progress", title: "Level 4", value: 95, goal: 120, unit: "XP",
      steps: [{ label: "90 XP", at: 90 }, { label: "30 XP", at: 30 }, { label: "bad" }] });
    expect(r.blocks).toEqual([{ type: "progress", title: "Level 4", value: 95, goal: 120, unit: "XP",
      steps: [{ label: "30 XP", at: 30 }, { label: "90 XP", at: 90 }] }]);
    expect(r.dropped).toEqual([{ path: "0.steps.2", why: "checkpoint needs a label and a number `at`" }]);
  });
  it("keeps a checkpoint label written as a number, for the drawing to write in the unit", () => {
    const r = one({ type: "progress", title: "Car fund", value: 0, goal: 1000000, unit: "₹", steps: [{ label: 250000, at: 250000 }] });
    expect((r.blocks[0] as any).steps).toEqual([{ label: 250000, at: 250000 }]);
  });
  it("is dropped without a title, a numeric value or a goal above 0", () => {
    expect(one({ type: "progress", value: 5, goal: 10 }).dropped).toEqual([{ path: "0", why: "progress needs a title" }]);
    expect(one({ type: "progress", title: "x", value: "5", goal: 10 }).dropped).toEqual([{ path: "0", why: "progress needs a numeric value" }]);
    expect(one({ type: "progress", title: "x", value: 5, goal: 0 }).dropped).toEqual([{ path: "0", why: "progress needs a goal above 0" }]);
  });
  it("keeps a null value or goal as a figure nobody knows", () => {
    const r = one({ type: "progress", title: "Level 5", value: null, goal: 120, unit: "XP" });
    expect(r.dropped).toEqual([]);
    expect(r.blocks[0]).toEqual({ type: "progress", title: "Level 5", value: null, goal: 120, unit: "XP", steps: [] });
    const goal = one({ type: "progress", title: "Level 5", value: 95, goal: null, unit: "XP" });
    expect(goal.dropped).toEqual([]);
    expect((goal.blocks[0] as any).goal).toBeNull();
    // a goal of 0 or less is still a mistake: the track is a share of it.
    expect(one({ type: "progress", title: "x", value: 5, goal: -1 }).dropped).toEqual([{ path: "0", why: "progress needs a goal above 0" }]);
  });
});
