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

describe("progress drawing", () => {
  it("reads a shape under the words models reach for, and leaves a word it doesn't know out", () => {
    const shape = (v: unknown) => (one({ type: "progress", title: "x", value: 1, goal: 10, shape: v }).blocks[0] as any).shape;
    expect(shape("circle")).toBe("circle");
    expect(shape("ring")).toBe("circle");
    expect(shape("dashboard")).toBe("dashboard");
    expect(shape("gauge")).toBe("dashboard");
    expect(shape("line")).toBe("line");
    expect(shape("pie")).toBeUndefined();
  });
  it("reads show_percent only from true, and a tone from its own words", () => {
    const read = (raw: unknown) => one({ type: "progress", title: "x", value: 1, goal: 10, ...(raw as object) }).blocks[0] as any;
    expect(read({ show_percent: true }).show_percent).toBe(true);
    expect(read({ show_percent: "yes" }).show_percent).toBeUndefined();
    expect(read({ tone: "warn" }).tone).toBe("warn");
    expect(read({ tone: "warning" }).tone).toBe("warn");
    expect(read({ tone: "danger" }).tone).toBe("bad");
    expect(read({ tone: "blue" }).tone).toBeUndefined();
  });
  it("sorts the marks by where they sit and drops one without a number `at`", () => {
    const r = one({ type: "progress", title: "Load", value: 88, goal: 100, shape: "dashboard",
      thresholds: [{ at: 85, tone: "warn", label: "Busy" }, { at: 60, tone: "good" }, { label: "later" }, { at: 100 }] });
    expect((r.blocks[0] as any).thresholds).toEqual([
      { at: 60, tone: "good" }, { at: 85, label: "Busy", tone: "warn" }, { at: 100 },
    ]);
    expect(r.dropped).toEqual([{ path: "0.thresholds.2", why: "threshold needs a number `at`" }]);
  });
  it("lets thresholds replace steps, and says so", () => {
    const r = one({ type: "progress", title: "Both", value: 60, goal: 100,
      steps: [{ label: "Half", at: 50 }], thresholds: [{ at: 80, label: "Pass" }] });
    expect((r.blocks[0] as any).steps).toEqual([]);
    expect((r.blocks[0] as any).thresholds).toEqual([{ at: 80, label: "Pass" }]);
    expect(r.dropped).toEqual([{ path: "0.steps", why: "thresholds replace steps" }]);
  });
  it("keeps the first 6 marks and the first 5 parts, noting what was left out", () => {
    const marks = Array.from({ length: 7 }, (_, i) => ({ at: (i + 1) * 10 }));
    const parts = Array.from({ length: 6 }, () => ({ value: 1 }));
    const r = one({ type: "progress", title: "x", value: 5, goal: 100, thresholds: marks, segments: parts });
    expect((r.blocks[0] as any).thresholds.length).toBe(6);
    expect((r.blocks[0] as any).segments.length).toBe(5);
    expect(r.dropped).toEqual([
      { path: "0", why: "kept the first 6 thresholds of 7" },
      { path: "0", why: "kept the first 5 segments of 6" },
    ]);
  });
  it("drops a part without a value of 0 or more", () => {
    const r = one({ type: "progress", title: "Sprint", value: 60, goal: 100,
      segments: [{ value: 40, label: "Done", tone: "good" }, { value: -1 }, { label: "Left" }] });
    expect((r.blocks[0] as any).segments).toEqual([{ value: 40, label: "Done", tone: "good" }]);
    expect(r.dropped).toEqual([
      { path: "0.segments.1", why: "segment needs a number `value` of 0 or more" },
      { path: "0.segments.2", why: "segment needs a number `value` of 0 or more" },
    ]);
  });
  it("cuts a long label to 28 characters instead of dropping the mark", () => {
    const r = one({ type: "progress", title: "x", value: 5, goal: 100,
      thresholds: [{ at: 10, label: "x".repeat(29) }, { at: 20, label: "x".repeat(30), tone: "danger" }] });
    expect((r.blocks[0] as any).thresholds).toEqual([{ at: 10, label: "x".repeat(28) },
      { at: 20, label: "x".repeat(28), tone: "bad" }]);
    expect(r.dropped).toEqual([]);
  });
  it("adds nothing to a plain bar: no shape, percent, tone, marks or parts", () => {
    const r = one({ type: "progress", title: "Steps", value: 1234, goal: 10000 });
    expect(r.blocks).toEqual([{ type: "progress", title: "Steps", value: 1234, goal: 10000, steps: [] }]);
  });
});
