import { describe, expect, it } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { readBlocks } from "../../core/readBlocks";
import type { ChartBlock } from "./read";
import { chipWords, describeChart, plainNum } from "./describe";

const spec = (raw: object) => (readBlocks([{ type: "chart", ...raw }]) as ChartBlock[])[0].spec;

describe("the chart's description", () => {
  it("writes each series first → last with its change, as the text fallback does", () => {
    pinLocale("en-US");
    const s = spec({ kind: "bar", title: "Revenue vs profit", unit: "₹Cr", x: ["Dec", "Mar", "Jun"], series: [
      { name: "Revenue", data: [67087, 70698, 72275] }, { name: "Net profit", data: [10720, 13784, 13420] }] });
    expect(describeChart(s)).toBe(
      "Revenue vs profit (₹Cr): Revenue 67,087 → 72,275 (▲ 7.7%); Net profit 10,720 → 13,420 (▲ 25.2%)");
  });
  it("says nothing extra when the first value is 0, and skips the gaps", () => {
    pinLocale("en-US");
    const s = spec({ kind: "line", title: "Signups", x: ["Mon", "Tue", "Wed"], series: [
      { name: "Users", data: [0, null, 40] }] });
    expect(describeChart(s)).toBe("Signups: Users 0 → 40");
  });
  it("gives a pie its biggest slices and their shares", () => {
    pinLocale("en-US");
    const s = spec({ kind: "donut", title: "Mix", x: ["A", "B", "C", "D", "E"],
      series: [{ name: "Share", data: [50, 20, 15, 10, 5] }] });
    expect(describeChart(s)).toBe("Mix: A 50%, B 20%, C 15%, D 10%, +1 more");
  });
  it("names the chart when it has no title of its own", () => {
    pinLocale("en-US");
    expect(describeChart(spec({ kind: "line", x: ["a", "b"], series: [{ name: "Close", data: [1, 2] }] })))
      .toBe("Chart: Close 1 → 2 (▲ 100%)");
  });
  it("writes numbers and chips the way the text fallback does", () => {
    pinLocale("en-US");
    expect(plainNum(72275)).toBe("72,275");
    expect(plainNum(18.6)).toBe("18.6");
    expect(plainNum(1234.5678)).toBe("1,234.57");
    expect(chipWords(-0.9)).toBe("(▼ 0.9%)");
  });
});
