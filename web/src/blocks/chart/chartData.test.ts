import { describe, expect, it } from "vitest";
import { readBlocks } from "../../core/readBlocks";
import { axisNames, binTotals, changePct, chartKind, chartLabel, chartScales, fmtSpan, isOrderedLabel, kindToDraw,
  maxSeries, pieSlices, scatterPoints, waterfallBars, type ChartKind, type ChartSpec } from "./chartData";

describe("chart reading", () => {
  it("maps kind names and aliases, anything else is a line", () => {
    expect(chartKind("Donut")).toBe("donut");
    expect(chartKind("stacked_bar")).toBe("stacked");
    expect(chartKind("scatter")).toBe("scatter");
    expect(chartKind("Waterfall")).toBe("waterfall");
    expect(chartKind("ridge")).toBe("line");
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
  it("reads the caveat and axis captions, trims and caps them, and drops captions without an axis", () => {
    const raw = { type: "chart", kind: "line", x: ["a", "b", "c"], series: [{ data: [1, 2, 3] }],
      caveat: "  Q3 onward is a projection.  ", xLabel: " Quarter ", yLabel: "Revenue" };
    const spec = (readBlocks([raw])[0] as any).spec;
    expect(spec.caveat).toBe("Q3 onward is a projection.");
    expect(spec.xLabel).toBe("Quarter");
    expect(spec.yLabel).toBe("Revenue");
    const long = (readBlocks([{ ...raw, caveat: "x".repeat(200), xLabel: "y".repeat(60) }])[0] as any).spec;
    expect(long.caveat.length).toBe(120);
    expect(long.xLabel.length).toBe(40);
    expect(long.xLabel.endsWith("…")).toBe(true);
    const pie = (readBlocks([{ ...raw, kind: "pie", series: [{ data: [1, 2, 3] }] }])[0] as any).spec;
    expect(pie.caveat).toBe("Q3 onward is a projection.");
    expect(pie.xLabel).toBeUndefined();
    expect(pie.yLabel).toBeUndefined();
    const hbar = (readBlocks([{ ...raw, kind: "hbar" }])[0] as any).spec;
    expect(hbar.xLabel).toBe("Quarter");
    expect(hbar.yLabel).toBeUndefined();
  });
  it("builds the accessible name from the title, axes, ends and caveat", () => {
    const spec = (readBlocks([{ type: "chart", kind: "line", unit: "₹Cr", title: "Revenue",
      x: ["Q1", "Q4"], series: [{ data: [67087, 74010] }], xLabel: "Quarter", yLabel: "Revenue",
      caveat: "Q4 is a projection." }])[0] as any).spec as ChartSpec;
    expect(chartLabel(spec)).toBe(
      "Revenue. line chart. Quarter along the bottom. Revenue up the side. ₹67,087 Cr to ₹74,010 Cr, up 10.3%. Q4 is a projection.");
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

    const ranked = readBlocks([{ type: "chart", kind: "hbar", sortDesc: true, x: ["Pune", "Mumbai", "Bengaluru"],
      series: [{ data: [38, 52, 61] }] }])[0] as any;
    expect(ranked.spec.x).toEqual(["Bengaluru", "Mumbai", "Pune"]);
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

describe("scatter and waterfall caps", () => {
  it("keep two groups of points for a scatter and one set of bars for a waterfall", () => {
    expect(maxSeries("scatter")).toBe(2);
    expect(maxSeries("waterfall")).toBe(1);
    expect(maxSeries("bar")).toBe(3);
    expect(maxSeries("stacked")).toBe(6);
  });
});

describe("scatterPoints", () => {
  const series = (points: object[], name = "Cars") => [{ name, data: [], points: points as never }];

  it("keeps the points with two numbers, in reading order left to right", () => {
    const drawn = scatterPoints(series([{ x: 62, y: 1.2 }, { x: 9, y: 24.6 }, { x: 30, y: null }, { y: 5 }]));
    expect(drawn.map((d) => [d.x, d.y])).toEqual([[9, 24.6], [62, 1.2]]);
  });

  it("orders points at the same x by their y, so the keys walk top to bottom", () => {
    expect(scatterPoints(series([{ x: 5, y: 9 }, { x: 5, y: 2 }])).map((d) => d.y)).toEqual([2, 9]);
  });

  it("numbers the series it took each point from", () => {
    const drawn = scatterPoints([...series([{ x: 2, y: 2 }]), ...series([{ x: 1, y: 1 }], "Bikes")]);
    expect(drawn.map((d) => d.series)).toEqual([1, 0]);
  });
});

describe("waterfallBars", () => {
  const bars = (points: object[]) => waterfallBars(points as never);

  it("pins a total from zero to the balance so far and moves the balance by each step", () => {
    expect(bars([{ label: "Revenue", value: 120, total: true }, { label: "Returns", value: -8 },
      { label: "Discounts", value: -5 }, { label: "Net profit", value: 47, total: true }]))
      .toEqual([{ label: "Revenue", from: 0, to: 120, total: true },
        { label: "Returns", from: 120, to: 112, total: false },
        { label: "Discounts", from: 112, to: 107, total: false },
        { label: "Net profit", from: 0, to: 107, total: true }]);
  });

  it("draws steps from the running balance with no opening anchor and no closing bar", () => {
    expect(bars([{ label: "Salary", value: 5 }, { label: "Rent", value: -2 }]))
      .toEqual([{ label: "Salary", from: 0, to: 5, total: false }, { label: "Rent", from: 5, to: 3, total: false }]);
  });

  it("draws nothing at an unknown step, and nothing after it", () => {
    expect(bars([{ label: "Rent", value: -2 }, { label: "Card", value: null }, { label: "Close", value: 4, total: true }]))
      .toEqual([{ label: "Rent", from: 0, to: -2, total: false }, null, null]);
  });

  it("reads only total: true as a total", () => {
    expect(bars([{ label: "Opening", value: 40, total: "true" }])[0]).toEqual({ label: "Opening", from: 0, to: 40, total: false });
  });
});

describe("axisNames", () => {
  it("reads the measure up the side and the one along the bottom from the title", () => {
    expect(axisNames("Price against mileage")).toEqual({ x: "mileage", y: "price" });
    expect(axisNames("Range by price")).toEqual({ x: "price", y: "range" });
    expect(axisNames("Battery life vs. weight")).toEqual({ x: "weight", y: "battery life" });
  });
  it("leaves the axes unnamed when the title names neither", () => {
    expect(axisNames("Revenue")).toEqual({});
    expect(axisNames(undefined)).toEqual({});
    expect(axisNames("Against the odds")).toEqual({});
  });
});

describe("chartScales for a scatter", () => {
  it("gives the numbers up the side and the numbers along the bottom", () => {
    const spec: ChartSpec = { type: "scatter", title: "Price against mileage", x: [],
      series: [{ data: [], points: [{ x: 9, y: 24.6 }, { x: 62, y: 1.2 }] }] };
    const scales = chartScales(spec, null);
    expect(scales.x!.min).toBeLessThan(9);
    expect(scales.x!.max).toBeGreaterThan(62);
    expect(scales.left.min).toBeLessThan(1.2);
    expect(scales.left.max).toBeGreaterThan(24.6);
    expect(scales.right).toBeNull();
  });
});

describe("histogram and range", () => {
  const read = (raw: object) => readBlocks([{ type: "chart", ...raw }]) as any[];
  const hist = (data: (number | null)[]) => read({ kind: "histogram", x: ["0-15", "15-30", "30-45"], series: [{ data }] })[0].spec;
  const range = (series: object) => read({ kind: "range", x: ["Mon", "Tue"], series: [series] })[0]?.spec;

  it("maps the new kind names and their aliases", () => {
    expect(chartKind("Histogram")).toBe("histogram");
    expect(chartKind("hist")).toBe("histogram");
    expect(chartKind("range_bar")).toBe("range");
    expect(chartKind("floating bar")).toBe("range");
    expect(chartKind("boxplot")).toBe("line");
  });

  it("takes one series each, and a histogram's counts grow from zero", () => {
    expect(maxSeries("histogram")).toBe(1);
    expect(maxSeries("range")).toBe(1);
    expect(chartScales(hist([4, 12, 0]), null).left.min).toBe(0);
    expect(chartScales(hist([4, 12, 0]), null).left.max).toBeGreaterThan(12);
  });

  it("reads a histogram's counts, a negative one and a gap alike", () => {
    expect(hist([4, null, 9]).series[0].data).toEqual([4, null, 9]);
    expect(hist([4, -2, 9]).series[0].data).toEqual([4, null, 9]);
    expect(hist([0, 0, 0]).series[0].data).toEqual([0, 0, 0]);
    expect(read({ kind: "histogram", x: ["a"], series: [{ data: [null] }] })).toEqual([]);
  });

  it("reads a range's low, high and now, lower end first, with the window's middle as its value", () => {
    const spec = range({ name: "Delivery", low: [34, 19], high: [18, 36], now: [26, 31] })!;
    expect(spec.series[0].span).toEqual([{ low: 18, high: 34, now: 26 }, { low: 19, high: 36, now: 31 }]);
    expect(spec.series[0].data).toEqual([26, 27.5]);
  });

  it("keeps a window missing one end as no window, and drops a chart with no window at all", () => {
    const spec = range({ low: [18, null], high: [34, 36], now: [null, 31] })!;
    expect(spec.series[0].span).toEqual([{ low: 18, high: 34, now: null }, { low: null, high: null, now: 31 }]);
    expect(range({ low: [null], high: [null], now: [null] })).toBeUndefined();
  });

  it("hugs a range's own values instead of running to zero", () => {
    const spec = range({ low: [18], high: [34], now: [26] })!;
    expect(chartScales(spec, null).left.min).toBeGreaterThan(0);
    expect(chartScales(spec, null).left.max).toBeGreaterThan(34);
  });

  it("reads a range written as points", () => {
    const spec = read({ kind: "range", series: [{ name: "Delivery", points: [
      { label: "Mon", low: 18, high: 34, now: 26 },
      { label: "Tue", low: 19, high: 36, now: 31 },
    ] }] })[0]?.spec;
    expect(spec?.x).toEqual(["Mon", "Tue"]);
    expect(spec?.series[0].span).toEqual([{ low: 18, high: 34, now: 26 }, { low: 19, high: 36, now: 31 }]);
    expect(spec?.series[0].data).toEqual([26, 27.5]);
  });

  it("writes a window's ends with the unit on each, and a dash when neither is known", () => {
    expect(fmtSpan(18, 34, "min")).toBe("18 min–34 min");
    expect(fmtSpan(18, 34, "%")).toBe("18%–34%");
    expect(fmtSpan(null, 34, "min")).toBe("34 min");
    expect(fmtSpan(null, null)).toBe("–");
  });

  it("counts a histogram and finds its tallest bin", () => {
    expect(binTotals([4, 12, null, 9])).toEqual({ total: 25, tallest: 1 });
    expect(binTotals([null, null])).toEqual({ total: 0, tallest: -1 });
  });
});
