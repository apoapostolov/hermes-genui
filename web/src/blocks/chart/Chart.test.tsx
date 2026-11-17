import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { readBlocks, readBlocksNoted } from "../../core/readBlocks";
import type { ChartBlock } from "./read";
import { fmt } from "./chartData";
import { Blocks } from "../../core/Blocks";

beforeEach(() => pinLocale("en-US"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const chart = (raw: object) => readBlocks([{ type: "chart", ...raw }]) as ChartBlock[];

describe("Chart", () => {
  it("draws a line per series and writes the x labels that fit", () => {
    const blocks = chart({ kind: "line", title: "NIFTY 50 · 1mo", x: ["1 Oct", "2 Oct", "3 Oct"], series: [
      { name: "Close", data: [24000, 24150, 24310] }, { name: "Avg", data: [24050, 24100, 24200] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect(container.querySelectorAll("path.hb-chart-line").length).toBe(2);
    const labels = [...container.querySelectorAll("text.hb-chart-axis")].map((t) => t.textContent);
    expect(labels).toEqual(["1 Oct", "2 Oct", "3 Oct"]);
    expect(container.textContent).toContain("NIFTY 50 · 1mo");
  });

  it("shows the line's change from first to last", () => {
    const { container } = render(<Blocks blocks={chart({ kind: "line", x: ["a", "b"], series: [{ data: [100, 110] }] })} />);
    expect(container.textContent).toContain("▲ 10.0%");
  });

  it("draws one slice per pie label", () => {
    const blocks = chart({ kind: "pie", x: ["Rent", "SIP", "Food"], unit: "₹", series: [{ name: "Budget", data: [30000, 25000, 15000] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect(container.querySelectorAll("path.hb-slice").length).toBe(3);
  });

  it("draws a row per hbar label", () => {
    const blocks = chart({ kind: "hbar", x: ["IT", "Pharma", "Realty"], unit: "%", series: [{ data: [18.4, 12.1, -7.8] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect(container.querySelectorAll(".hb-hbar-label").length).toBe(3);
  });

  it("draws bars and stacks without throwing", () => {
    const bar = chart({ kind: "bar", x: ["Q1", "Q2"], series: [{ data: [1, 2] }] });
    const stacked = chart({ kind: "stacked", x: ["Jul", "Aug"], series: [{ name: "Rent", data: [3, 3] }, { name: "Food", data: [1, 2] }] });
    const { container } = render(<Blocks blocks={[...bar, ...stacked]} />);
    expect(container.querySelectorAll("path.hb-chart-bar, rect").length).toBe(6);
  });
});

describe("bar charts", () => {
  const twoSeries = () => chart({ kind: "bar", x: ["Q1", "Q2", "Q3", "Q4"], unit: "$M",
    series: [{ name: "Revenue", data: [182, 190, 201, 215] }, { name: "Profit", data: [20, 24, 22, 30] }] });

  it("labels every column when they fit", () => {
    const { container } = render(<Blocks blocks={twoSeries()} />);
    const labels = [...container.querySelectorAll("text.hb-chart-axis")].map((t) => t.textContent);
    expect(labels).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });

  it("gives each series its own colour", () => {
    const { container } = render(<Blocks blocks={twoSeries()} />);
    const fills = new Set([...container.querySelectorAll("path.hb-chart-bar")].map((b) => b.getAttribute("fill")));
    expect([...fills]).toEqual(["var(--hb-chart-1)", "var(--hb-chart-2)"]);
  });

  it("draws one series in one flat colour, with no grey bars or gradient", () => {
    const { container } = render(<Blocks blocks={chart({ kind: "bar", x: ["Jan", "Feb", "Mar", "Apr"], series: [{ data: [3, 9, 4, 5] }] })} />);
    const fills = [...container.querySelectorAll("path.hb-chart-bar")].map((b) => b.getAttribute("fill"));
    expect(fills).toEqual(Array(4).fill("var(--hb-chart-1)"));
    expect(container.querySelector("linearGradient")).toBeNull();
  });

  it("prints values on top of 12 bars or fewer, not more", () => {
    const few = chart({ kind: "bar", x: ["Jan", "Feb", "Mar", "Apr", "May"], series: [{ data: [18000, 14500, 7200, 5400, 3000] }] });
    const { container } = render(<Blocks blocks={few} />);
    expect([...container.querySelectorAll("text.hb-chart-value")].map((t) => t.textContent)).toEqual(["18,000", "14,500", "7,200", "5,400", "3,000"]);
    cleanup();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    const many = chart({ kind: "bar", x: months, series: [{ name: "A", data: months.map((_, i) => i) }, { name: "B", data: months.map((_, i) => i) }] });
    expect(render(<Blocks blocks={many} />).container.querySelector("text.hb-chart-value")).toBeNull();
  });

  it("fades the other columns and shows a hover card with the full value", () => {
    const { container } = render(<Blocks blocks={chart({ kind: "bar", title: "Revenue", x: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Revenue", data: [4213500000, 1, 1, 1] }] })} />);
    expect(container.querySelector("text.hb-chart-value")!.textContent).toBe("4.21B");
    fireEvent.keyDown(container.querySelector("svg.hb-chart-svg")!, { key: "ArrowRight" });
    const tip = container.querySelector(".hb-tip-on")!;
    expect(tip.querySelector(".hb-tip-title")!.textContent).toBe("Q1");
    expect(tip.querySelector(".hb-tip-value")!.textContent).toBe("4,213,500,000");
    expect(tip.querySelector(".hb-tip-note")).toBeNull();
    const shades = [...container.querySelectorAll("path.hb-chart-bar")].map((b) => b.parentElement!.getAttribute("opacity"));
    expect(shades).toEqual(["1", "0.55", "0.55", "0.55"]);
    fireEvent.keyDown(container.querySelector("svg.hb-chart-svg")!, { key: "Escape" });
    expect(container.querySelector(".hb-tip-on")).toBeNull();
  });

  it("names each series in a legend when there are several", () => {
    const { container } = render(<Blocks blocks={twoSeries()} />);
    const names = [...container.querySelectorAll(".hb-legend-item")].map((i) => i.textContent);
    expect(names).toEqual(["Revenue", "Profit"]);
  });
});

describe("line charts with several series", () => {
  it("name each series at its line's end", () => {
    const blocks = chart({ kind: "line", unit: "%", x: ["a", "b"], series: [{ name: "HDFC Bank", data: [0, -20] }, { name: "ICICI Bank", data: [0, 5] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    const ends = [...container.querySelectorAll("text.hb-chart-end")];
    expect(ends.map((t) => t.textContent)).toEqual(["HDFC Bank", "ICICI Bank"]);
    expect((ends[1] as SVGElement).style.fill).toBe("var(--hb-chart-2)");
  });

  it("colour each series and name them in a legend", () => {
    const blocks = chart({ kind: "line", unit: "%", x: ["a", "b"], series: [{ name: "GOOGL", data: [0, -20] }, { name: "MSFT", data: [0, 5] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect([...container.querySelectorAll(".hb-legend-item")].map((i) => i.textContent)).toEqual(["GOOGL", "MSFT"]);
    const strokes = [...container.querySelectorAll("path.hb-chart-line")].map((p) => p.getAttribute("stroke"));
    expect(strokes[1]).toBe("var(--hb-chart-2)");
  });
});

describe("line charts", () => {
  const line = (extra: object = {}) => chart({ kind: "line", unit: "pts", x: ["a", "b", "c"], series: [{ name: "NIFTY 50", data: [23440, 22500, 24100] }], ...extra });

  it("draw one series without a fill, ending in a dot and its last value", () => {
    const { container } = render(<Blocks blocks={line()} />);
    expect(container.querySelectorAll("path").length).toBe(1);
    expect(container.querySelector("path.hb-chart-line")!.getAttribute("stroke")).toBe("var(--hb-chart-1)");
    expect(container.querySelector("path.hb-chart-line")!.getAttribute("d")).not.toContain("C");
    expect([...container.querySelectorAll("text.hb-chart-end")].map((t) => t.textContent)).toEqual(["24,100"]);
  });

  it("with tone change, turn green above the start and orange below, and mark the start", () => {
    const { container } = render(<Blocks blocks={line({ tone: "change" })} />);
    const stroke = container.querySelector("path.hb-chart-line")!.getAttribute("stroke")!;
    const gradient = container.querySelector(`linearGradient#${stroke.slice(5, -1)}`)!;
    expect(gradient.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    const stops = [...gradient.querySelectorAll("stop")];
    expect(stops.map((s) => (s as SVGElement).style.stopColor)).toEqual(["var(--hb-good)", "var(--hb-warn)"]);
    expect(stops[0].getAttribute("offset")).toBe(stops[1].getAttribute("offset"));
    expect(container.textContent).toContain("Start 23,440");
    expect(container.querySelector("line[stroke-dasharray]")).not.toBeNull();
  });

  it("with tone change, write the Start label with a halo on the side the line leaves free", () => {
    const startLabel = (data: number[]) => {
      const { container } = render(<Blocks blocks={line({ tone: "change", series: [{ data }] })} />);
      const label = [...container.querySelectorAll("text")].find((t) => t.textContent!.startsWith("Start"))!;
      const dashed = Number(container.querySelector("line[stroke-dasharray]")!.getAttribute("y1"));
      cleanup();
      return { halo: label.classList.contains("hb-chart-halo"), side: Number(label.getAttribute("y")) < dashed ? "above" : "below" };
    };
    expect(startLabel([23440, 22500, 24100])).toEqual({ halo: true, side: "above" });
    expect(startLabel([23440, 24500, 24100])).toEqual({ halo: true, side: "below" });
  });

  it("with several series, draw faint gridlines with their values on the left", () => {
    const blocks = chart({ kind: "line", unit: "%", figure: false, x: ["a", "b", "c"],
      series: [{ name: "NIFTY 50", data: [0, 4.2, 18.5] }, { name: "S&P 500", data: [0, -4.2, 9] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect([...container.querySelectorAll("text.hb-chart-tick")].map((t) => t.textContent)).toEqual(["-10%", "0%", "10%", "20%"]);
    expect(container.querySelectorAll("line.hb-chart-rule").length).toBe(4);
    cleanup();
    expect(render(<Blocks blocks={line()} />).container.querySelector(".hb-chart-tick")).toBeNull();
  });

  it("ignore tone change with several series", () => {
    const { container } = render(<Blocks blocks={chart({ kind: "line", tone: "change", x: ["a", "b"], series: [{ data: [1, 2] }, { data: [2, 1] }] })} />);
    expect(container.querySelector("linearGradient")).toBeNull();
    expect(container.textContent).not.toContain("Start");
  });

  it("show the change since the start in the hover card", () => {
    const { container } = render(<Blocks blocks={line()} />);
    const svg = container.querySelector("svg.hb-chart-svg")!;
    fireEvent.keyDown(svg, { key: "ArrowLeft" });
    expect(container.querySelector(".hb-tip-on .hb-tip-title")!.textContent).toBe("c");
    expect(container.querySelector(".hb-tip-on .hb-tip-note")!.textContent).toBe("▲ 2.8% since start");
    expect(container.querySelector(".hb-chart-big")!.textContent).toBe("24,100");
    fireEvent.blur(svg);
    expect(container.querySelector(".hb-tip-on")).toBeNull();
  });

  it("may grow wider than the usual cap from 60 points", () => {
    const x = Array.from({ length: 60 }, (_, i) => `d${i}`);
    const { container } = render(<Blocks blocks={chart({ kind: "line", x, series: [{ data: x.map((_, i) => i) }] })} />);
    expect(container.querySelector(".hb-chart-wide")).not.toBeNull();
  });
});

describe("horizontal bars", () => {
  it("are chosen for long labels, and show label, bar and value on each row in one colour", () => {
    const blocks = chart({ kind: "bar", unit: "₹", x: ["Stay", "Flights", "Local transport", "Food"], series: [{ data: [18000, 14500, 3000, 7200] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect(container.querySelector("svg.hb-chart-svg")).toBeNull();
    expect([...container.querySelectorAll(".hb-hbar-label")].map((l) => l.textContent)).toEqual(["Stay", "Flights", "Local transport", "Food"]);
    const bars = [...container.querySelectorAll(".hb-hbar-bar")] as HTMLElement[];
    expect(new Set(bars.map((b) => b.style.background))).toEqual(new Set(["var(--hb-chart-1)"]));
    expect(container.querySelector(".hb-hbar-value")!.textContent).toBe("₹18,000");
    fireEvent.keyDown(container.querySelector(".hb-hbar-grid")!, { key: "ArrowDown" });
    expect(container.querySelector(".hb-tip-on .hb-tip-value")!.textContent).toBe("₹18,000");
    expect(container.querySelector(".hb-tip-on .hb-tip-note")).toBeNull();
  });

  it("draw signed values from a zero line, gains green and falls orange", () => {
    const blocks = chart({ kind: "hbar", unit: "%", x: ["IT", "Pharma", "Realty"], series: [{ data: [18.4, 12.1, -7.8] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect(container.querySelector(".hb-hbar-zero")).not.toBeNull();
    const bars = [...container.querySelectorAll(".hb-hbar-bar")] as HTMLElement[];
    expect(bars.map((b) => b.style.background)).toEqual(["var(--hb-good)", "var(--hb-good)", "var(--hb-warn)"]);
    expect(container.querySelectorAll(".hb-hbar-down").length).toBe(1);
  });

  it("keep a bar per series in its own colour, named in a legend", () => {
    const blocks = chart({ kind: "hbar", x: ["HDFC", "ICICI"], series: [{ name: "2025", data: [10, 12] }, { name: "2026", data: [11, 9] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect(container.querySelectorAll(".hb-hbar-bar").length).toBe(4);
    expect([...container.querySelectorAll(".hb-legend-item")].map((i) => i.textContent)).toEqual(["2025", "2026"]);
    fireEvent.keyDown(container.querySelector(".hb-hbar-grid")!, { key: "ArrowDown" });
    expect([...container.querySelectorAll(".hb-tip-on .hb-tip-name")].map((n) => n.textContent)).toEqual(["2025", "2026"]);
  });
});

describe("donuts", () => {
  it("show the total in the middle and a legend with value and share", () => {
    const blocks = chart({ kind: "donut", unit: "₹", x: ["Stay", "Flights"], series: [{ name: "Amount", data: [18000, 2000] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect(container.querySelector(".hb-pie-total")!.textContent).toBe("₹20,000");
    const row = container.querySelector(".hb-pie-legend tr")!;
    expect(row.querySelector(".hb-pie-value")!.textContent).toBe("₹18,000");
    expect(row.querySelector(".hb-pie-share")!.textContent).toBe("90%");
    fireEvent.keyDown(container.querySelector("svg.hb-pie-svg")!, { key: "ArrowRight" });
    expect(container.querySelector(".hb-tip-on .hb-tip-title")!.textContent).toBe("Stay");
    expect(container.querySelector(".hb-tip-on .hb-tip-note")!.textContent).toBe("90% of total");
  });
});

describe("scatter charts", () => {
  const cars = (extra: object = {}) => chart({ kind: "scatter", title: "Price against mileage", unit: "₹L",
    series: [{ name: "Listed cars", points: [
      { x: 62, y: 1.2, label: "Maruti 800" }, { x: 9, y: 24.6, label: "Fortuner" },
      { x: 40, y: 8, label: "City" }] }], ...extra });

  it("draws a dot per point that has two numbers", () => {
    const { container } = render(<Blocks blocks={cars()} />);
    expect(container.querySelectorAll("circle.hb-chart-dot").length).toBe(3);
    expect(container.querySelectorAll("path.hb-chart-line").length).toBe(0);
  });

  it("keeps a point with an unknown y out of the drawing and says nothing about it", () => {
    const blocks = chart({ kind: "scatter", series: [{ points: [{ x: 1, y: 2 }, { x: 3, y: null }] }] });
    expect(blocks[0].spec.series[0].points).toEqual([{ x: 1, y: 2 }, { x: 3, y: null }]);
    expect(render(<Blocks blocks={blocks} />).container.querySelectorAll("circle.hb-chart-dot").length).toBe(1);
  });

  it("drops a point with no x, and the whole chart when no point is left", () => {
    const noted = readBlocksNoted([{ type: "chart", kind: "scatter", series: [{ points: [{ x: 2, y: 3 }, { y: 4 }] }] }]);
    expect(noted.blocks.length).toBe(1);
    expect(noted.dropped.map((d) => d.why)).toEqual(["a point needs a number on both scales"]);
    const empty = readBlocksNoted([{ type: "chart", kind: "scatter", series: [{ points: [{ y: 4 }] }] }]);
    expect(empty.blocks).toEqual([]);
    expect(empty.dropped.map((d) => d.why).at(-1)).toBe("scatter needs a point with a number on both scales");
  });

  it("names the drawing with both scales and their ranges", () => {
    const { container } = render(<Blocks blocks={cars()} />);
    expect(container.querySelector("svg.hb-chart-svg")!.getAttribute("aria-label"))
      .toBe("Price against mileage: mileage 9 to 62, price 1.2 to 24.6, 3 points");
  });

  it("titles each dot with its place on both scales", () => {
    const { container } = render(<Blocks blocks={cars()} />);
    expect([...container.querySelectorAll("circle.hb-chart-dot title")].map((t) => t.textContent))
      .toEqual(["mileage 9, price 24.6, Fortuner", "mileage 40, price 8, City", "mileage 62, price 1.2, Maruti 800"]);
  });

  it("walks the keys left to right and shows the point in the hover card", () => {
    const { container } = render(<Blocks blocks={cars()} />);
    const svg = container.querySelector("svg.hb-chart-svg")!;
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(container.querySelector(".hb-tip-on .hb-tip-title")!.textContent).toBe("Fortuner");
    expect(container.querySelector(".hb-tip-on .hb-tip-name")!.textContent).toBe("mileage 9");
    expect(container.querySelector(".hb-tip-on .hb-tip-value")!.textContent).toBe("price ₹24.6L");
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(container.querySelector(".hb-tip-on .hb-tip-title")!.textContent).toBe("City");
    fireEvent.keyDown(svg, { key: "Escape" });
    expect(container.querySelector(".hb-tip-on")).toBeNull();
  });

  it("gives two groups of points their own colours and a legend", () => {
    const blocks = chart({ kind: "scatter", series: [
      { name: "Petrol", points: [{ x: 610, y: 8.2 }, { x: 540, y: 9.1 }] },
      { name: "Diesel", points: [{ x: 690, y: 9.4 }] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    const fills = [...container.querySelectorAll("circle.hb-chart-dot")].map((c) => c.getAttribute("fill"));
    expect(fills).toEqual(["var(--hb-chart-1)", "var(--hb-chart-1)", "var(--hb-chart-2)"]);
    expect([...container.querySelectorAll(".hb-legend-item")].map((i) => i.textContent)).toEqual(["Petrol", "Diesel"]);
  });
});

describe("waterfall charts", () => {
  const bridge = (extra: object = {}) => chart({ kind: "waterfall", title: "Revenue to net profit", unit: "₹Cr",
    series: [{ name: "Bridge", points: [
      { label: "Gross revenue", value: 120, total: true }, { label: "Returns", value: -8 },
      { label: "Discounts", value: -5 }, { label: "Net profit", total: true }] }], ...extra });

  it("draws a bar per point, a total from zero and a step between its balances", () => {
    const { container } = render(<Blocks blocks={bridge()} />);
    expect(container.querySelectorAll("path.hb-chart-bar").length).toBe(4);
    expect(container.querySelectorAll("line.hb-waterfall-link").length).toBe(3);  // one per join
    expect(container.querySelector("svg.hb-chart-svg")!.getAttribute("aria-label"))
      .toBe("Revenue to net profit: 4 of 4 bars, balance ₹107 Cr");
  });

  it("colours a total with the first colour and a step by its direction", () => {
    const { container } = render(<Blocks blocks={bridge()} />);
    expect([...container.querySelectorAll("path.hb-chart-bar")].map((b) => b.getAttribute("fill")))
      .toEqual(["var(--hb-chart-1)", "var(--hb-warn)", "var(--hb-warn)", "var(--hb-chart-1)"]);
  });

  it("writes each value with its sign on the bars", () => {
    const { container } = render(<Blocks blocks={bridge()} />);
    expect([...container.querySelectorAll("text.hb-chart-value")].map((t) => t.textContent))
      .toEqual(["₹120 Cr", "-₹8 Cr", "-₹5 Cr", "₹107 Cr"]);
    expect([...container.querySelectorAll("text.hb-chart-axis")].map((t) => t.textContent))
      .toEqual(["Gross revenue", "Returns", "Discounts", "Net profit"]);
  });

  it("shows the closing balance, then the picked bar's", () => {
    const { container } = render(<Blocks blocks={bridge()} />);
    expect(container.querySelector(".hb-chart-big")!.textContent).toBe("₹107 Cr");
    fireEvent.keyDown(container.querySelector("svg.hb-chart-svg")!, { key: "ArrowRight" });
    expect(container.querySelector(".hb-chart-big")!.textContent).toBe("₹120 Cr");
    expect(container.querySelector(".hb-chart-at")!.textContent).toBe("Gross revenue");
  });

  it("names the step and the balance it produced in the hover card", () => {
    const { container } = render(<Blocks blocks={bridge()} />);
    const svg = container.querySelector("svg.hb-chart-svg")!;
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    const tip = container.querySelector(".hb-tip-on")!;
    expect(tip.querySelector(".hb-tip-title")!.textContent).toBe("Returns");
    expect(tip.querySelector(".hb-tip-name")!.textContent).toBe("▼ decrease");
    expect(tip.querySelector(".hb-tip-value")!.textContent).toBe("-₹8 Cr");
    expect(tip.querySelector(".hb-tip-note")!.textContent).toBe("balance ₹112 Cr");
  });

  it("draws nothing after an unknown step, and keeps its label and the closing total unstated", () => {
    const blocks = chart({ kind: "waterfall", x: ["Rent", "Card", "Close"],
      series: [{ points: [{ label: "Rent", value: -2 }, { label: "Card", value: null }, { label: "Close", total: true }] }] });
    const { container } = render(<Blocks blocks={blocks} />);
    expect(container.querySelectorAll("path.hb-chart-bar").length).toBe(1);
    expect([...container.querySelectorAll("text.hb-chart-axis")].map((t) => t.textContent)).toEqual(["Rent", "Card", "Close"]);
    expect(container.querySelector(".hb-chart-big")).toBeNull();
  });

  it("hides the headline balance with figure: false", () => {
    const { container } = render(<Blocks blocks={bridge({ figure: false })} />);
    expect(container.querySelector(".hb-chart-big")).toBeNull();
    expect(container.querySelectorAll("path.hb-chart-bar").length).toBe(4);
  });

  it("draws a step with a value written as total: true as a step", () => {
    const blocks = chart({ kind: "waterfall", series: [{ points: [{ label: "Opening", value: 40, total: "true" }] }] });
    expect(blocks[0].spec.series[0].points).toEqual([{ label: "Opening", value: 40 }]);
  });
});

describe("fmt", () => {
  it("formats crore amounts in rupees", () => {
    expect(fmt(72275, "₹Cr")).toBe("₹72,275 Cr");
  });
  it("puts % after the number and keeps points plain", () => {
    expect(fmt(18.6, "%")).toBe("18.6%");
    expect(fmt(24310.5, "pts")).toBe("24,311");
  });
});

describe("chart figure from block JSON", () => {
  const raw = { kind: "line", unit: "%", x: ["a", "b"], series: [{ name: "GOOGL", data: [100, 80] }, { name: "MSFT", data: [100, 105] }] };
  it("hides the headline number and change chip with figure: false", () => {
    const { container } = render(<Blocks blocks={chart({ ...raw, figure: false })} />);
    expect(container.querySelector(".hb-chip")).toBeNull();
    expect(container.querySelector(".hb-chart-big")).toBeNull();
  });
  it("keeps them by default, and ignores a figure that isn't a boolean", () => {
    for (const extra of [{}, { figure: "false" }, { figure: 0 }]) {
      const { container } = render(<Blocks blocks={chart({ ...raw, ...extra })} />);
      expect(container.querySelector(".hb-chip")).not.toBeNull();
      expect(container.querySelector(".hb-chart-big")).not.toBeNull();
      cleanup();
    }
  });
  it("reads figure as a boolean only", () => {
    expect(chart({ ...raw, figure: false })[0].spec.figure).toBe(false);
    expect(chart({ ...raw, figure: true })[0].spec.figure).toBe(true);
    expect(chart({ ...raw, figure: "no" })[0].spec.figure).toBeUndefined();
  });
});
