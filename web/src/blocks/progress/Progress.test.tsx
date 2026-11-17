import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";
import { amountOf, trackShare } from "./Progress";

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
    expect(amountOf(95, null, "XP")).toBe("95 / no data");
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
