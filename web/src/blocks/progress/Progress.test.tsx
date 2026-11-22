import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";
import { amountOf, percentOf, trackShare, zoneTone } from "./Progress";

afterEach(cleanup);

describe("Progress", () => {
  it("fills the plain track by value over goal, held between 0 and 1", () => {
    expect(trackShare(30, 120, [])).toBe(0.25);
    expect(trackShare(150, 120, [])).toBe(1);
    expect(trackShare(-5, 120, [])).toBe(0);
  });
  it("fills nothing when the value is unknown, and writes no data in its place", () => {
    expect(trackShare(null, 120, [])).toBe(0);
    expect(trackShare(null, 120, [{ label: "60", at: 60 }])).toBe(0);
    expect(trackShare(95, null, [])).toBe(0);  // no goal to be a share of
    expect(amountOf(null, 120, "XP")).toBe("no data / 120 XP");
    expect(amountOf(null, 1000000, "₹")).toBe("no data / ₹10L");
    // a goal nobody knows keeps the value's unit: the one number left still says what it counts
    expect(amountOf(95, null, "₹")).toBe("₹95 / no data");
    expect(amountOf(95, null, "XP")).toBe("95 XP / no data");
    expect(amountOf(null, null)).toBe("no data / no data");
  });
  it("fills a checkpoint track between the evenly spaced checkpoints", () => {
    const steps = [{ label: "30", at: 30 }, { label: "60", at: 60 }, { label: "120", at: 120 }];
    expect(trackShare(20, 120, steps)).toBe(0);
    expect(trackShare(45, 120, steps)).toBe(0.25);
    expect(trackShare(90, 120, steps)).toBe(0.75);
    expect(trackShare(130, 120, steps)).toBe(1);
  });
  it("draws the title, the amount and each checkpoint ticked or locked", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "progress", title: "Level 4", value: 95, goal: 120, unit: "XP",
      steps: [{ label: "60 XP", at: 60 }, { label: "120 XP", at: 120 }] }])} />);
    expect(screen.getByText("Level 4")).toBeTruthy();
    expect(screen.getByText("95 / 120 XP")).toBeTruthy();
    expect(screen.getByText("60 XP")).toBeTruthy();
    expect(container.querySelectorAll(".hb-progress-node-done").length).toBe(1);
    expect(container.querySelectorAll(".hb-progress-node").length).toBe(2);
  });
  it("writes value / goal with the unit where fmt puts it: joined to each number, or once at the end", () => {
    expect(amountOf(0, 1000000, "₹")).toBe("₹0 / ₹10L");
    expect(amountOf(0, 1000000, "INR")).toBe("₹0 / ₹10L");
    expect(amountOf(40, 100, "%")).toBe("40% / 100%");
    expect(amountOf(95, 120, "XP")).toBe("95 / 120 XP");
    expect(amountOf(300, 500, "pts")).toBe("300 / 500 pts");
    expect(amountOf(3, 10)).toBe("3 / 10");
  });
  it("writes money with its sign in front and big amounts short, checkpoints given as numbers too", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "progress", title: "Car fund", value: 0, goal: 1000000, unit: "₹",
      steps: [{ label: 250000, at: 250000 }, { label: "Halfway", at: 500000 }, { label: 1000000, at: 1000000 }] }])} />);
    expect(container.querySelector(".hb-progress-amount")!.textContent).toBe("₹0 / ₹10L");
    expect(Array.from(container.querySelectorAll(".hb-progress-labels span"), (s) => s.textContent)).toEqual(["₹2.5L", "Halfway", "₹10L"]);
  });
  it("reads an unknown value as no data over an empty track, with no checkpoint ticked off", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "progress", title: "Level 5", value: null, goal: 120, unit: "XP",
      steps: [{ label: "60 XP", at: 60 }, { label: "120 XP", at: 120 }] }])} />);
    expect(container.querySelector(".hb-progress-amount")!.textContent).toBe("no data / 120 XP");
    expect((container.querySelector(".hb-progress-fill") as HTMLElement).style.width).toBe("0%");
    expect(container.querySelectorAll(".hb-progress-node-done").length).toBe(0);
    expect(container.querySelectorAll(".hb-progress-node").length).toBe(2);
  });
});

describe("progress amount in the user's locale", () => {
  afterEach(() => vi.restoreAllMocks());
  it("groups value and goal the local way", () => {
    pinLocale("de-DE");
    const { container } = render(<Blocks blocks={readBlocks([{ type: "progress", title: "Steps", value: 1234, goal: 10000 }])} />);
    expect(container.querySelector(".hb-progress-amount")!.textContent).toBe("1.234 / 10.000");
  });
});

const card = (block: Record<string, unknown>) => render(<Blocks blocks={readBlocks([block])} />).container;

describe("progress shapes, bands and parts", () => {
  it("holds the percent between 0 and 100 and reads the band the value falls in", () => {
    expect(percentOf(14, 21.1)).toBe(66);
    expect(percentOf(150, 120)).toBe(100);
    expect(percentOf(-5, 120)).toBe(0);
    const marks = [{ at: 60, tone: "good" as const }, { at: 85, tone: "warn" as const }, { at: 100, tone: "bad" as const }];
    expect(zoneTone(50, marks)).toBe("good");
    expect(zoneTone(70, marks)).toBe("warn");
    expect(zoneTone(88, marks)).toBe("bad");
    expect(zoneTone(50, [])).toBe("good");
    expect(zoneTone(50, [], "warn")).toBe("warn");
  });
  it("draws a ring with the percent in the middle", () => {
    const c = card({ type: "progress", title: "Savings goal", value: 7200, goal: 10000, unit: "₹", shape: "circle", show_percent: true });
    expect(c.querySelector(".hb-progress-ring circle.hb-progress-ring-track")).toBeTruthy();
    expect(c.querySelector(".hb-progress-ring-pct")!.textContent).toBe("72%");
    expect(c.querySelectorAll(".hb-progress-ring-fill").length).toBe(1);
    expect(c.querySelector(".hb-progress")!.className).toContain("hb-progress-tone-good");
  });
  it("leaves a ring bare when the percent is not asked for, and draws a gauge as an open arc", () => {
    expect(card({ type: "progress", title: "Load", value: 88, goal: 100, shape: "dashboard" }).querySelector(".hb-progress-ring-pct")).toBeNull();
    const c = card({ type: "progress", title: "Load", value: 88, goal: 100, shape: "dashboard" });
    expect(c.querySelector(".hb-progress-ring-dash")).toBeTruthy();
    expect(c.querySelector(".hb-progress-ring-track")!.tagName.toLowerCase()).toBe("path");
  });
  it("fills in the tone of the band, tints the bands and ticks every mark", () => {
    const c = card({ type: "progress", title: "Server load", value: 88, goal: 100, unit: "%",
      thresholds: [{ at: 60, tone: "good" }, { at: 85, tone: "warn", label: "Busy" }, { at: 100, tone: "bad" }] });
    expect(c.querySelector(".hb-progress")!.className).toContain("hb-progress-tone-bad");
    expect(c.querySelectorAll(".hb-progress-band").length).toBe(3);
    expect(c.querySelectorAll(".hb-progress-mark").length).toBe(3);
    expect(Array.from(c.querySelectorAll(".hb-progress-mark-labels span"), (s) => s.textContent)).toEqual(["Busy"]);
    expect((c.querySelector(".hb-progress-fill") as HTMLElement).style.width).toBe("88%");
  });
  it("keeps the real amount while the fill stops at full", () => {
    const c = card({ type: "progress", title: "Overspent", value: 150, goal: 120 });
    expect((c.querySelector(".hb-progress-fill") as HTMLElement).style.width).toBe("100%");
    expect(c.querySelector(".hb-progress-amount")!.textContent).toBe("150 / 120");
  });
  it("writes the percent beside a line only when asked", () => {
    expect(card({ type: "progress", title: "Steps", value: 8000, goal: 10000, show_percent: true }).querySelector(".hb-progress-pct")!.textContent).toBe("80%");
    expect(card({ type: "progress", title: "Steps", value: 8000, goal: 10000 }).querySelector(".hb-progress-pct")).toBeNull();
  });
  it("takes the block's own tone when no mark is toned", () => {
    const c = card({ type: "progress", title: "Fees", value: 90, goal: 100, tone: "warn" });
    expect(c.querySelector(".hb-progress")!.className).toContain("hb-progress-tone-warn");
  });
  it("draws parts end to end and leaves the rest of the track empty", () => {
    const c = card({ type: "progress", title: "Sprint work", value: 60, goal: 100,
      segments: [{ value: 40, label: "Done", tone: "good" }, { value: 20, label: "In review", tone: "warn" }] });
    const parts = Array.from(c.querySelectorAll(".hb-progress-seg"), (s) => ({ left: (s as HTMLElement).style.left, width: (s as HTMLElement).style.width }));
    expect(parts).toEqual([{ left: "0%", width: "40%" }, { left: "40%", width: "20%" }]);
    expect(c.querySelector(".hb-progress-fill")).toBeNull();
    expect(Array.from(c.querySelectorAll(".hb-legend-item > :last-child"), (s) => s.textContent)).toEqual(["40", "20"]);
    expect(c.textContent).toContain("In review");
  });
  it("drops what is past the goal rather than drawing a part wider than the track", () => {
    const c = card({ type: "progress", title: "Over", value: 60, goal: 100,
      segments: [{ value: 60 }, { value: 50 }] });
    const widths = Array.from(c.querySelectorAll(".hb-progress-seg"), (s) => (s as HTMLElement).style.width);
    expect(widths).toEqual(["60%", "40%"]);
  });
  it("draws marks instead of checkpoints when both are given", () => {
    const c = card({ type: "progress", title: "Both", value: 60, goal: 100,
      steps: [{ label: "Half", at: 50 }], thresholds: [{ at: 80, label: "Pass" }] });
    expect(c.querySelectorAll(".hb-progress-node").length).toBe(0);
    expect(c.querySelectorAll(".hb-progress-mark").length).toBe(1);
    expect(c.textContent).toContain("Pass");
  });
  it("keeps a plain bar to one track and one fill", () => {
    const c = card({ type: "progress", title: "Trip fund", value: 5, goal: 10 });
    expect(c.querySelectorAll(".hb-progress-line").length).toBe(0);
    expect(c.querySelectorAll(".hb-progress-band").length).toBe(0);
    expect(c.querySelectorAll(".hb-progress-mark").length).toBe(0);
    expect((c.querySelector(".hb-progress-fill") as HTMLElement).style.width).toBe("50%");
  });
  it("fills a ring by value over goal even when checkpoints are given", () => {
    const c = card({ type: "progress", title: "Level 4", value: 60, goal: 120, shape: "circle",
      steps: [{ label: "60", at: 60 }, { label: "120", at: 120 }] });
    const [filled, length] = c.querySelector(".hb-progress-ring-fill")!.getAttribute("stroke-dasharray")!.split(" ").map(Number);
    expect(filled / length).toBeCloseTo(0.5, 5);
    expect(c.querySelectorAll(".hb-progress-node").length).toBe(0);
  });
  it("puts a tick on the gauge for each mark", () => {
    const c = card({ type: "progress", title: "Load", value: 88, goal: 100, shape: "gauge",
      thresholds: [{ at: 60 }, { at: 85 }, { at: 100 }] });
    expect(c.querySelectorAll(".hb-progress-ring-mark").length).toBe(3);
  });
  it("starts a gauge's fill and its parts on the track's lower left, never through the bottom gap", () => {
    const gauge = card({ type: "progress", title: "Speed", value: 72, goal: 120, shape: "dashboard" });
    const fill = gauge.querySelector(".hb-progress-ring-fill")!;
    expect(fill.getAttribute("transform")).toBe("rotate(135 60 60)");
    // 270° of a 50 radius circle: the filled dash can run from the lower left round the top to the lower right, no more.
    expect(Number(fill.getAttribute("stroke-dasharray")!.split(" ")[1])).toBeCloseTo(2 * Math.PI * 50 * 0.75, 5);
    const parts = card({ type: "progress", title: "Budget used", value: 32000, goal: 50000, shape: "dashboard",
      segments: [{ value: 20000, label: "Rent" }, { value: 12000, label: "Food" }] });
    const turns = Array.from(parts.querySelectorAll(".hb-progress-ring-fill"), (c) => c.getAttribute("transform"));
    expect(turns).toEqual(["rotate(135 60 60)", "rotate(135 60 60)"]);
    const ring = card({ type: "progress", title: "Savings", value: 50, goal: 100, shape: "circle" });
    expect(ring.querySelector(".hb-progress-ring-fill")!.getAttribute("transform")).toBe("rotate(-90 60 60)");
  });
  it("holds a mark past the goal at the goal, as the text does", () => {
    const marks = [{ at: 60, tone: "good" as const }, { at: 100, tone: "warn" as const }, { at: 150, tone: "bad" as const }];
    expect(zoneTone(120, marks, "good", 100)).toBe("warn");
    const c = card({ type: "progress", title: "Load", value: 120, goal: 100, thresholds: marks });
    expect(c.querySelector(".hb-progress")!.className).toContain("hb-progress-tone-warn");
  });
});
