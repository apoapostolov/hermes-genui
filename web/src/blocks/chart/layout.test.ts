import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chartScales, type ChartSpec } from "./chartData";
import { pinLocale } from "../../lib/locale.testing";
import { scatterLayout, scatterTip, startLabelY, waterfallLayout, waterfallTip, waterfallValue, xyLayout, xyTip } from "./layout";

beforeEach(() => pinLocale("en-US"));
afterEach(() => vi.restoreAllMocks());

const layoutOf = (spec: ChartSpec, width = 600) => xyLayout(spec, width, chartScales(spec, null));
const months = (n: number) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"].slice(0, n);
const bars = (n: number, series = 1): ChartSpec => ({ type: "bar", x: months(n),
  series: Array.from({ length: series }, (_, k) => ({ name: `S${k}`, data: months(n).map((_, i) => 100 + i + k) })) });

describe("xyLayout", () => {
  it("draws at the width it is given, columns 210px and lines 220px high", () => {
    expect(layoutOf(bars(4)).W).toBe(600);
    expect(layoutOf(bars(4)).H).toBe(210);
    expect(layoutOf({ type: "line", x: ["a", "b"], series: [{ data: [1, 2] }] }).H).toBe(220);
  });

  it("prints values on the bars only when there are 12 or fewer", () => {
    expect(layoutOf(bars(5)).valueLabels).toBe(true);
    expect(layoutOf(bars(6, 2)).valueLabels).toBe(true);
    expect(layoutOf(bars(13)).valueLabels).toBe(false);
    expect(layoutOf(bars(7, 2)).valueLabels).toBe(false);
  });

  it("drops the values when they wouldn't fit over their bars", () => {
    expect(layoutOf(bars(12), 200).valueLabels).toBe(false);
  });

  it("centres a few columns instead of spreading them out", () => {
    const l = layoutOf(bars(3));
    expect(l.xAt(1) - l.xAt(0)).toBe(96);
    expect(l.xAt(1)).toBeCloseTo(300);
  });

  it("writes as many x labels as fit 80px apart on a line", () => {
    const x = Array.from({ length: 53 }, (_, i) => `W${i}`);
    const l = layoutOf({ type: "line", x, series: [{ data: x.map((_, i) => i) }] });
    expect(l.xLabels.length).toBeGreaterThan(2);
    for (let k = 1; k < l.xLabels.length; k++) expect(l.xAt(l.xLabels[k]) - l.xAt(l.xLabels[k - 1])).toBeGreaterThanOrEqual(80);
  });

  it("ends a one-series line with its last value", () => {
    const l = layoutOf({ type: "line", x: ["a", "b", "c"], unit: "$", series: [{ data: [10, 12, null] }] });
    expect(l.ends.map((e) => e.text)).toEqual(["$12"]);
  });

  it("names each of several lines at its end, at least 14px apart", () => {
    const l = layoutOf({ type: "line", unit: "%", x: ["a", "b"], series: [{ name: "HDFC Bank", data: [0, 10] }, { name: "ICICI Bank", data: [0, 10.1] }] });
    expect(l.ends.map((e) => e.text)).toEqual(["HDFC Bank", "ICICI Bank"]);
    expect(Math.abs(l.ends[0].y - l.ends[1].y)).toBeGreaterThan(13.99);
    expect(l.ends[1].ink).toBe("var(--hb-chart-2)");
  });
});

describe("gridlines", () => {
  const rebased: ChartSpec = { type: "line", unit: "%", x: ["a", "b", "c"],
    series: [{ name: "NIFTY 50", data: [0, 4.2, 18.5] }, { name: "S&P 500", data: [0, -4.2, 9] }] };

  it("give several lines round values on the left, the scale running from the lowest to the highest", () => {
    const l = layoutOf(rebased);
    expect(l.ticks).toEqual([-10, 0, 10, 20]);
    expect(l.yAt(-10)).toBeCloseTo(l.base);
    expect(l.yAt(20)).toBeCloseTo(l.top);
    expect(l.left).toBeGreaterThan(30);  // room for "-10%"
  });
  it("leave one line, and bars, without them", () => {
    expect(layoutOf({ ...rebased, series: rebased.series.slice(0, 1) }).ticks).toEqual([]);
    expect(layoutOf(bars(4, 2)).ticks).toEqual([]);
  });
});

describe("xyTip", () => {
  it("shows a bar's full value and no share (bars are not parts of a whole)", () => {
    const spec: ChartSpec = { type: "bar", x: ["Q1", "Q2"], series: [{ name: "Revenue", data: [4213500000, 6320250000] }] };
    const tip = xyTip(spec, 0, layoutOf(spec));
    expect(tip.title).toBe("Q1");
    expect(tip.rows).toEqual([{ colour: "var(--hb-chart-1)", name: "Revenue", value: "4,213,500,000" }]);
    expect(tip.note).toBeUndefined();
  });

  it("gives a one-series line its change since the start", () => {
    const spec: ChartSpec = { type: "line", x: ["a", "b"], series: [{ data: [100, 104.2] }] };
    const tip = xyTip(spec, 1, layoutOf(spec));
    expect(tip.rows[0].name).toBe("Value");
    expect(tip.note).toBe("▲ 4.2% since start");
    expect(xyTip(spec, 0, layoutOf(spec)).note).toBeUndefined();
  });

  it("lists every series with its own colour and leaves out gaps", () => {
    const spec: ChartSpec = { type: "line", x: ["a", "b"], series: [{ name: "A", data: [1, 2] }, { name: "B", data: [null, 3] }] };
    expect(xyTip(spec, 0, layoutOf(spec)).rows.map((r) => r.name)).toEqual(["A"]);
    expect(xyTip(spec, 1, layoutOf(spec)).rows.map((r) => r.colour)).toEqual(["var(--hb-chart-1)", "var(--hb-chart-2)"]);
  });

  it("colours a change line's row green above the start and orange below", () => {
    const spec: ChartSpec = { type: "line", tone: "change", x: ["a", "b", "c"], series: [{ data: [100, 90, 110] }] };
    expect(xyTip(spec, 1, layoutOf(spec)).rows[0].colour).toBe("var(--hb-warn)");
    expect(xyTip(spec, 2, layoutOf(spec)).rows[0].colour).toBe("var(--hb-good)");
  });
});

describe("startLabelY (the Start label beside a change line's dashed start)", () => {
  // The label spans x 10-80; the dashed line is at y 100; the plot's bottom is at 194.
  const place = (points: [number, number][], y = 100) => startLabelY(points, 10, 80, y, 194);

  it("goes below the dashed line when the series climbs under the label", () => {
    expect(place([[8, 100], [60, 40], [120, 30]])).toBe(114);
  });
  it("goes above when the series falls, or stays flat", () => {
    expect(place([[8, 100], [60, 160], [120, 170]])).toBe(94);
    expect(place([[8, 100], [300, 100]])).toBe(94);
  });
  it("reads the series between its points, so a sparse line still counts", () => {
    // Points at 8 and 400 only: under the label the line has already climbed a little.
    expect(place([[8, 100], [400, 20]])).toBe(114);
  });
  it("follows the bigger move when the series goes both ways under the label", () => {
    expect(place([[8, 100], [30, 90], [60, 150]])).toBe(94);
    expect(place([[8, 100], [30, 110], [60, 50]])).toBe(114);
  });
  it("stays on the drawing: below near the top, above near the bottom", () => {
    expect(place([[8, 12], [60, 80]], 12)).toBe(26);
    expect(place([[8, 190], [60, 120]], 190)).toBe(184);
  });
});

const cars: ChartSpec = { type: "scatter", title: "Price against mileage", x: [],
  unit: "₹L", series: [{ name: "Listed cars", data: [], points: [
    { x: 62, y: 1.2, label: "Maruti 800" }, { x: 9, y: 24.6, label: "Fortuner" },
    { x: 40, y: 8, label: "City" }, { x: 30, y: null, label: "Unknown" }] }] };
const scatter = (spec = cars, width = 600) => scatterLayout(spec, width, chartScales(spec, null));

describe("scatterLayout", () => {
  it("draws both scales with round values, and only the points with two numbers", () => {
    const l = scatter();
    expect(l.H).toBe(230);
    expect(l.dots.map((d) => d.x)).toEqual([9, 40, 62]);
    expect(l.xTicks).toEqual([0, 25, 50, 75]);
    expect(l.yTicks[0]).toBeLessThanOrEqual(1.2);
    expect(l.yTicks.at(-1)).toBeGreaterThanOrEqual(24.6);
  });

  it("leaves room for the values up the side and puts the dots inside the plot", () => {
    const l = scatter();
    expect(l.left).toBeGreaterThan(20);
    for (const d of l.dots) {
      expect(d.cx).toBeGreaterThanOrEqual(l.left);
      expect(d.cx).toBeLessThanOrEqual(l.right);
      expect(d.cy).toBeGreaterThanOrEqual(l.top);
      expect(d.cy).toBeLessThanOrEqual(l.base);
    }
  });

  it("puts a higher value higher up and a bigger one further right", () => {
    const [fortuner, city, maruti] = scatter().dots;
    expect(fortuner.cy).toBeLessThan(maruti.cy);
    expect(city.cx).toBeLessThan(maruti.cx);
  });
});

describe("scatterTip", () => {
  it("names the point and where it sits on each axis", () => {
    const tip = scatterTip(cars, 2, scatter());
    expect(tip.title).toBe("Maruti 800");
    expect(tip.rows).toEqual([{ colour: "var(--hb-chart-1)", name: "mileage 62", value: "price ₹1.2L" }]);
  });

  it("falls back to the series name and to x and y when the title names no axes", () => {
    const plain: ChartSpec = { type: "scatter", x: [], series: [{ name: "Cars", data: [], points: [{ x: 5, y: 7 }] }] };
    const tip = scatterTip(plain, 0, scatter(plain));
    expect(tip.title).toBe("Cars");
    expect(tip.rows[0].name).toBe("x 5");
    expect(tip.rows[0].value).toBe("y 7");
  });
});

const bridge: ChartSpec = { type: "waterfall", title: "Revenue to net profit", unit: "₹Cr",
  x: ["Gross revenue", "Returns", "Discounts", "Net profit"], series: [{ name: "Bridge", data: [], points: [
    { label: "Gross revenue", value: 120, total: true }, { label: "Returns", value: -8 },
    { label: "Discounts", value: -5 }, { label: "Net profit", total: true }] }] };

describe("waterfallLayout", () => {
  it("keeps zero in view and works the scale out from the bars", () => {
    const l = waterfallLayout(bridge, 600);
    expect(l.ticks[0]).toBeLessThanOrEqual(0);
    expect(l.ticks.at(-1)).toBeGreaterThanOrEqual(120);
    expect(l.bars.map((b) => (b ? [b.from, b.to] : null))).toEqual([[0, 120], [120, 112], [112, 107], [0, 107]]);
  });

  it("centres the columns and writes eight values at most", () => {
    const l = waterfallLayout(bridge, 600);
    expect(l.slot).toBe(96);
    expect(l.xAt(1) - l.xAt(0)).toBe(96);
    expect(l.xAt(1) + l.xAt(2)).toBeCloseTo(l.left + l.right);
    expect(l.valueLabels).toBe(true);
    const many: ChartSpec = { ...bridge, x: bridge.x.flatMap((label) => [label, label]),
      series: [{ data: [], points: Array.from({ length: 8 }, (_, i) => ({ label: `s${i}`, value: i + 1 })) }] };
    expect(waterfallLayout(many, 600).valueLabels).toBe(true);
    const more: ChartSpec = { ...many, x: Array.from({ length: 9 }, (_, i) => `s${i}`),
      series: [{ data: [], points: Array.from({ length: 9 }, (_, i) => ({ label: `s${i}`, value: i + 1 })) }] };
    expect(waterfallLayout(more, 600).valueLabels).toBe(false);
  });

  it("cuts a long label to the room under its column", () => {
    const l = waterfallLayout({ ...bridge, x: ["cost of goods", "b", "c", "d"] }, 200);
    expect(l.labels[0].endsWith("…")).toBe(true);
    expect(l.labels[0].length).toBeLessThan("cost of goods".length);
  });
});

describe("waterfallValue", () => {
  it("writes a step with its sign and a total as its balance", () => {
    expect(waterfallValue({ from: 120, to: 112, total: false }, "₹Cr")).toBe("-₹8 Cr");
    expect(waterfallValue({ from: 112, to: 117, total: false }, "₹Cr")).toBe("+₹5 Cr");
    expect(waterfallValue({ from: 0, to: 2140, total: true }, "€")).toBe("€2,140");
  });
});

describe("waterfallTip", () => {
  it("names the step, its direction and the balance it produced", () => {
    const tip = waterfallTip(bridge, 1, waterfallLayout(bridge, 600));
    expect(tip.title).toBe("Returns");
    expect(tip.rows).toEqual([{ colour: "var(--hb-warn)", name: "▼ decrease", value: "-₹8 Cr" }]);
    expect(tip.note).toBe("balance ₹112 Cr");
  });

  it("gives a total its own colour and no direction", () => {
    const tip = waterfallTip(bridge, 3, waterfallLayout(bridge, 600));
    expect(tip.rows[0].name).toBe("Total");
    expect(tip.rows[0].colour).toBe("var(--hb-chart-1)");
  });
});
