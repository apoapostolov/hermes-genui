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
});

describe("progress amount in the user's locale", () => {
  afterEach(() => vi.restoreAllMocks());
  it("groups value and goal the local way", () => {
    pinLocale("de-DE");
    const { container } = render(<Blocks blocks={readBlocks([{ type: "progress", title: "Steps", value: 1234, goal: 10000 }])} />);
    expect(container.querySelector(".hb-progress-amount")!.textContent).toBe("1.234 / 10.000");
  });
});

describe("what progress says to a screen reader", () => {
  const bar = (raw: object) => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "progress", ...raw }])} />);
    return container.querySelector('[role="progressbar"]') as HTMLElement;
  };

  it("is a progress bar named by its title, holding the value and the goal", () => {
    const track = bar({ title: "Level 4", value: 95, goal: 120, unit: "XP" });
    expect(track.getAttribute("role")).toBe("progressbar");
    expect(track.getAttribute("aria-valuemin")).toBe("0");
    expect(track.getAttribute("aria-valuemax")).toBe("120");
    expect(track.getAttribute("aria-valuenow")).toBe("95");
    expect(screen.getByRole("progressbar", { name: "Level 4" })).toBe(track);
  });

  it("says the amount in words, so it is not read as one number out of a max", () => {
    expect(bar({ title: "Level 4", value: 95, goal: 120, unit: "XP" }).getAttribute("aria-valuetext"))
      .toBe("95 / 120 XP");
    expect(bar({ title: "Level 4", value: 95, goal: 120, unit: "XP", steps: [{ label: "60 XP", at: 60 }, { label: "120 XP", at: 120 }] })
      .getAttribute("aria-valuetext")).toBe("95 / 120 XP, 1 of 2 checkpoints passed");
  });

  it("keeps the amount beside the title out of the reading, and stays unfocusable", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "progress", title: "Level 4", value: 95, goal: 120, unit: "XP" }])} />);
    expect(container.querySelector(".hb-progress-amount")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('[tabindex]')).toBeNull();
  });

  it("holds a value past the goal inside the bar, and says the real amount", () => {
    const track = bar({ title: "Saved", value: 150, goal: 120 });
    expect(track.getAttribute("aria-valuemax")).toBe("150");
    expect(track.getAttribute("aria-valuenow")).toBe("150");
    expect(track.getAttribute("aria-valuetext")).toBe("150 / 120");
  });
});
