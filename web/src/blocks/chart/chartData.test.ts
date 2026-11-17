import { describe, expect, it } from "vitest";
import { readBlocks } from "../../core/readBlocks";
import { changePct, chartKind, isOrderedLabel, kindToDraw, pieSlices, type ChartKind, type ChartSpec } from "./chartData";

describe("chart reading", () => {
  it("maps kind names and aliases, anything else is a line", () => {
    expect(chartKind("Donut")).toBe("donut");
    expect(chartKind("stacked_bar")).toBe("stacked");
    expect(chartKind("scatter")).toBe("line");
    expect(chartKind(undefined)).toBe("line");
  });
  it("keeps positive pie slices and merges past 8 into Other", () => {
    expect(pieSlices(["Rent", "Food", "Fun"], [30000, 12000, 0])).toEqual({ x: ["Rent", "Food"], data: [30000, 12000] });
    const ten = pieSlices(Array.from({ length: 10 }, (_, i) => `s${i}`), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(ten.x.at(-1)).toBe("Other");
    expect(ten.data.at(-1)).toBe(6);
  });
  it("turns non-numbers into gaps and drops a chart with no numbers", () => {
    const c = readBlocks([{ type: "chart", x: ["a", "b"], series: [{ name: "s", data: [1, "x"] }] }])[0] as any;
    expect(c.spec.series[0].data).toEqual([1, null]);
    expect(readBlocks([{ type: "chart", x: ["a"], series: [{ data: ["x"] }] }])).toEqual([]);
  });
  it("gives a combo's line in another unit the right-hand scale", () => {
    const c = readBlocks([{ type: "chart", kind: "combo", unit: "₹Cr", x: ["Q1", "Q2"], series: [
      { name: "Revenue", data: [65799, 67087] }, { name: "Margin", unit: "%", data: [18.4, 16] }] }])[0] as any;
    expect(c.spec.series.map((s: any) => s.right)).toEqual([false, true]);
  });
  it("reads stepped, clamps height and sorts bars descending", () => {
    const stepped = readBlocks([{ type: "chart", kind: "line", stepped: true, height: 900,
      x: ["a", "b"], series: [{ data: [1, 2] }] }])[0] as any;
    expect(stepped.spec.stepped).toBe(true);
    expect(stepped.spec.height).toBe(480);

    const bars = readBlocks([{ type: "chart", kind: "bar", sortDesc: true, x: ["a", "b", "c"],
      series: [{ data: [2, 9, 5] }, { data: [20, 90, 50] }] }])[0] as any;
    expect(bars.spec.x).toEqual(["b", "c", "a"]);
    expect(bars.spec.series[0].data).toEqual([9, 5, 2]);
    expect(bars.spec.series[1].data).toEqual([90, 50, 20]);
  });
});

describe("isOrderedLabel", () => {
  it("knows months, quarters, years, financial years and dates", () => {
    for (const label of ["Jan", "january", "Sept", "Mar 2025", "Jan '25", "Jan-25", "Q1", "Q3 2025", "Q1 FY25",
      "Q4'24", "Q3 FY2024-25", "2025 Q1", "FY25 Q2", "1999", "2024", "2100", "FY24", "FY2024-25", "FY 24-25",
      "2025-11-03", "2025-11", "03/11/2025", "12 Oct", "12 Oct 2025", "Oct 12", "Oct 12, 2025", "Year 3", "Week 12", "Day 1"]) {
      expect(isOrderedLabel(label), label).toBe(true);
    }
  });
  it("leaves names, categories and odd numbers alone", () => {
    for (const label of ["Rent", "Mumbai", "IT", "Q5", "Marketing", "Octopus", "FY", "Stay", "A1", "Mayfair"]) {
      expect(isOrderedLabel(label), label).toBe(false);
    }
  });
  it("counts plain numbers as ordered too (a calculator's x: 0, 0.25, 0.5 …)", () => {
    for (const label of ["0", "7", "0.25", "-3", "1799"]) expect(isOrderedLabel(label), label).toBe(true);
  });
});

describe("kindToDraw (bar or horizontal bars)", () => {
  const spec = (x: string[], seriesCount = 1, type: ChartKind = "bar"): ChartSpec =>
    ({ type, x, series: Array.from({ length: seriesCount }, () => ({ data: x.map((_, i) => i + 1) })) });
  const many = (n: number, name = "Item") => Array.from({ length: n }, (_, i) => `${name} ${String.fromCharCode(65 + i)}`);

  it("keeps time-ordered labels as columns whatever else is true", () => {
    expect(kindToDraw(spec(["Q1", "Q2"]))).toBe("bar");
    expect(kindToDraw(spec(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]))).toBe("bar");
    expect(kindToDraw(spec(["Q1 FY2024-25", "Q2 FY2024-25", "Q3 FY2024-25", "Q4 FY2024-25"]))).toBe("bar");
  });
  it("lies down when a label is longer than 12 characters", () => {
    expect(kindToDraw(spec(["Stay", "Flights", "Food", "Local transport"]))).toBe("hbar");
    expect(kindToDraw(spec(["Stay", "Flights", "Food", "Activities"]))).toBe("bar");
  });
  it("lies down for only 2 or 3 items", () => {
    expect(kindToDraw(spec(["HDFC", "ICICI"]))).toBe("hbar");
    expect(kindToDraw(spec(["A", "B", "C"], 2))).toBe("hbar");
    expect(kindToDraw(spec(["Solo"]))).toBe("bar");
  });
  it("lies down for a single-series ranking of 9 or more", () => {
    expect(kindToDraw(spec(many(9)))).toBe("hbar");
    expect(kindToDraw(spec(many(8)))).toBe("bar");
    expect(kindToDraw(spec(many(9), 2))).toBe("bar");
  });
  it("always draws an asked-for hbar and never changes other kinds", () => {
    expect(kindToDraw(spec(["Q1", "Q2", "Q3", "Q4"], 1, "hbar"))).toBe("hbar");
    expect(kindToDraw(spec(["HDFC", "ICICI"], 1, "line"))).toBe("line");
    expect(kindToDraw(spec(many(10), 1, "stacked"))).toBe("stacked");
  });
});

describe("tone", () => {
  const line = (extra: object) => (readBlocks([{ type: "chart", kind: "line", x: ["a", "b"], series: [{ data: [1, 2] }], ...extra }])[0] as any).spec;
  it("reads only the string change", () => {
    expect(line({ tone: "change" }).tone).toBe("change");
    expect(line({ tone: "Change" }).tone).toBeUndefined();
    expect(line({ tone: true }).tone).toBeUndefined();
    expect(line({}).tone).toBeUndefined();
  });
});

describe("changePct", () => {
  it("compares the first and last values, skipping gaps", () => {
    expect(changePct([100, null, 110])).toBeCloseTo(10);
    expect(changePct([0, 5])).toBeNull();
    expect(changePct([5])).toBeNull();
  });
});
