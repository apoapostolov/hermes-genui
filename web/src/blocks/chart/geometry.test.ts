import { describe, expect, it } from "vitest";
import { barPath, columnLayout, linePath, niceTicks, spreadLabels, xLabelsShown } from "./geometry";

describe("xLabelsShown", () => {
  it("writes every label when they are far enough apart", () => {
    expect(xLabelsShown(4, 150, 80)).toEqual([0, 1, 2, 3]);
  });
  it("keeps labels at least the gap apart, not just the first and last", () => {
    expect(xLabelsShown(12, 50, 80)).toEqual([0, 2, 4, 6, 8, 10]);
    const year = xLabelsShown(53, 600 / 52, 80);
    expect(year.length).toBeGreaterThan(2);
    for (let k = 1; k < year.length; k++) expect((year[k] - year[k - 1]) * (600 / 52)).toBeGreaterThanOrEqual(80);
  });
  it("handles one point and no room", () => {
    expect(xLabelsShown(1, 0, 80)).toEqual([0]);
    expect(xLabelsShown(3, 0, 80)).toEqual([0]);
  });
});

describe("columnLayout", () => {
  it("caps a slot at 96px and centres the group", () => {
    const { slot, bar, start } = columnLayout(600, 5, 1);
    expect(slot).toBe(96);
    expect(bar).toBe(56);
    expect(start).toBe(60);
  });
  it("keeps a bar at least 14px and shares the slot among series", () => {
    expect(columnLayout(300, 12, 1).bar).toBe(15);
    expect(columnLayout(600, 30, 1).bar).toBe(14);
    expect(columnLayout(600, 4, 2).bar).toBeCloseTo(28.8);
  });
  it("never lets a group overflow its slot", () => {
    const { slot, bar } = columnLayout(600, 30, 3);
    expect(bar * 3).toBeLessThanOrEqual(slot);
  });
});

describe("barPath", () => {
  it("rounds only the top corners of a bar above its base", () => {
    expect(barPath(10, 20, 100, 40)).toBe("M10,100V44Q10,40 14,40H26Q30,40 30,44V100Z");
  });
  it("rounds the bottom corners of a bar below its base", () => {
    expect(barPath(10, 20, 100, 160)).toBe("M10,100V156Q10,160 14,160H26Q30,160 30,156V100Z");
  });
  it("shrinks the radius for a short bar", () => {
    expect(barPath(0, 20, 100, 98)).toBe("M0,100V100Q0,98 2,98H18Q20,98 20,100V100Z");
  });
});

describe("linePath", () => {
  it("draws straight segments for 12 points or fewer", () => {
    expect(linePath([[0, 10], [5, 20], [10, 15]])).toBe("M0,10L5,20L10,15");
  });
  it("draws a smooth curve above 12 points", () => {
    const pts = Array.from({ length: 13 }, (_, i) => [i * 10, i % 2 ? 5 : 15] as [number, number]);
    expect(linePath(pts)).toContain("C");
  });
  it("holds each value until the next label when stepped", () => {
    expect(linePath([[0, 10], [5, 20], [10, 15]], true)).toBe("M0,10L5,10L5,20L10,20L10,15");
  });
});

describe("spreadLabels", () => {
  it("pushes labels at least 14px apart, keeping their order", () => {
    expect(spreadLabels([50, 55, 120])).toEqual([50, 64, 120]);
    expect(spreadLabels([55, 50])).toEqual([64, 50]);
  });
  it("pulls them back up when the lowest would pass the bottom", () => {
    expect(spreadLabels([100, 100], 14, 105)).toEqual([91, 105]);
  });
});

describe("niceTicks", () => {
  it("covers the values in about three round steps", () => {
    expect(niceTicks(-4.2, 18.5)).toEqual([-10, 0, 10, 20]);
    expect(niceTicks(0, 30)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(0.12, 0.31)).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(niceTicks(-12, 7)).toEqual([-20, -10, 0, 10]);
    expect(niceTicks(23440, 24100)).toEqual([23250, 23500, 23750, 24000, 24250]);
  });
  it("opens out a single value", () => {
    expect(niceTicks(5, 5)).toEqual([4, 5, 6]);
  });
});
