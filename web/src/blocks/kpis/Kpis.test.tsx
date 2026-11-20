import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { kpiValue, sparkPath } from "./Kpis";
import { fmt } from "../chart/chartData";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";

afterEach(cleanup);

describe("kpi values", () => {
  it("put a unit that starts with / right after the number", () => {
    render(<Blocks blocks={readBlocks([{ type: "kpis", items: [{ label: "Nightlife", value: 9, unit: "/10" }] }])} />);
    expect(screen.getByText("9/10")).toBeTruthy();
  });
  it("write a market price with its currency sign in front, as the chart beside it does", () => {
    expect(kpiValue({ label: "Last", value: 2502.35, unit: "₹" })).toBe("₹2,502");
    expect(fmt(2502.35, "₹")).toBe("₹2,502");
  });
});

describe("kpi values in the user's locale", () => {
  afterEach(() => vi.restoreAllMocks());
  it("marks decimals and groups the local way, rupees still Indian", () => {
    pinLocale("de-DE");
    expect(kpiValue({ label: "Margin", value: 18.6, unit: "%" })).toBe("18,6%");
    expect(kpiValue({ label: "Index", value: 24310.5, unit: "pts" })).toBe("24.311 pts");
    expect(kpiValue({ label: "Revenue", value: 294059, unit: "₹Cr" })).toBe("₹2,94,059 Cr");
  });
});

describe("year-like values", () => {
  it("show a year without a thousands separator", () => {
    expect(kpiValue({ label: "UNESCO listed", value: 1986 })).toBe("1986");
    expect(kpiValue({ label: "Revenue", value: 1986, unit: "₹" })).not.toBe("1986");
  });
});

describe("big values", () => {
  afterEach(() => vi.restoreAllMocks());
  it("shorten from 100,000 up, keeping every digit in the title", () => {
    pinLocale("en-US");
    const { container } = render(<Blocks blocks={readBlocks([{ type: "kpis", items: [
      { label: "Revenue", value: 4213500000, unit: "$" }, { label: "Visitors", value: 250000, unit: "pts" },
      { label: "Small", value: 99999, unit: "$" }] }])} />);
    const values = [...container.querySelectorAll(".hb-kpi-value")];
    expect(values.map((v) => v.textContent)).toEqual(["$4.21B", "250K pts", "$99,999"]);
    expect(values.map((v) => v.getAttribute("title"))).toEqual(["$4,213,500,000", "250,000 pts", null]);
  });
  it("keep crore amounts as written, and rupees short in lakh", () => {
    pinLocale("en-US");
    expect(kpiValue({ label: "Revenue", value: 294059, unit: "₹Cr" })).toBe("₹2,94,059 Cr");
    expect(kpiValue({ label: "Saved", value: 1840000, unit: "₹" })).toBe("₹18.4L");
    expect(kpiValue({ label: "Saved", value: 1840000, unit: "₹" }, { full: true })).toBe("₹18,40,000");
  });
});

describe("kpi card", () => {
  it("writes the change as a coloured line", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "kpis", items: [
      { label: "Close", value: 80, change: -20 }, { label: "MSFT", value: 210, change: 5 }, { label: "Flat", value: 1 }] }])} />);
    const changes = [...container.querySelectorAll(".hb-kpi-change")];
    expect(changes.map((c) => c.textContent)).toEqual(["▼ 20.0%", "▲ 5.0%"]);
    expect(changes.map((c) => c.className)).toEqual(["hb-kpi-change hb-kpi-down", "hb-kpi-change hb-kpi-up"]);
  });
  it("draws a trend as a small hidden-from-readers line, only when there is one", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "kpis", items: [
      { label: "Close", value: 80, trend: [100, 90, 80] }, { label: "Plain", value: 1 }] }])} />);
    const sparks = container.querySelectorAll("svg.hb-kpi-spark");
    expect(sparks.length).toBe(1);
    expect(sparks[0].getAttribute("aria-hidden")).toBe("true");
    expect(sparks[0].querySelector("path")!.getAttribute("d")).toBe(sparkPath([100, 90, 80]));
    expect((sparks[0].querySelector("path") as SVGElement).style.stroke).toBe("");  // the usual first chart colour
  });
  it("colours several trends by their card's place, like the lines of a comparison chart in the same order", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "kpis", items: [
      { label: "NIFTY 50", value: 80, trend: [100, 90, 80] }, { label: "No trend", value: 1 },
      { label: "S&P 500", value: 210, trend: [200, 204, 210] }] }])} />);
    const strokes = [...container.querySelectorAll("svg.hb-kpi-spark path")].map((p) => (p as SVGElement).style.stroke);
    expect(strokes).toEqual(["var(--hb-chart-1)", "var(--hb-chart-3)"]);
  });
});

describe("a change from a previous number", () => {
  it("prints the chip the reader worked out, in one decimal, and marks an inverted tone", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "kpis", items: [
      { label: "Revenue", value: 72275, unit: "₹Cr", previous: 70223 },
      { label: "Churn", value: 2.4, unit: "%", previous: 3.1, invert_tone: true }] }])} />);
    const chips = [...container.querySelectorAll(".hb-kpi-change")];
    expect(chips.map((c) => c.textContent)).toEqual(["▲ 2.9%", "▼ 0.7 pt"]);
    expect(chips.map((c) => c.className)).toEqual([
      "hb-kpi-change hb-kpi-up",
      "hb-kpi-change hb-kpi-down hb-kpi-invert",
    ]);
  });
  it("draws a flat chip for a change of zero, and none when a side is unknown", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "kpis", items: [
      { label: "Flat", value: 5, previous: 5 }, { label: "Unknown", value: 5, previous: null }] }])} />);
    const chips = [...container.querySelectorAll(".hb-kpi-change")];
    expect(chips.map((c) => c.textContent)).toEqual(["0.0%"]);
    expect(chips[0].className).toBe("hb-kpi-change hb-kpi-flat");
  });
  it("gives a stat its chip from previous as well", () => {
    render(<Blocks blocks={readBlocks([{ type: "stat", label: "Margin", value: 18.6, unit: "%", previous: 19.5 }])} />);
    expect(screen.getByText("▼ 0.9 pt")).toBeTruthy();
  });
  it("rounds a tie the way the text fallback does", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "stat", label: "Close", value: 1.25, unit: "%", previous: 1 }])} />);
    expect(container.querySelector(".hb-kpi-change")!.textContent).toBe("▲ 0.3 pt");
  });
  it("keeps a written change in % on a % card, and points only for a computed one", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "kpis", items: [
      { label: "Margin", value: 18.6, unit: "%", change: 5 },
      { label: "Same margin", value: 18.6, unit: "%", previous: 18.1 }] }])} />);
    expect([...container.querySelectorAll(".hb-kpi-change")].map((c) => c.textContent))
      .toEqual(["▲ 5.0%", "▲ 0.5 pt"]);
  });
  it("draws no chip for a change no chip can print", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "stat", label: "Close", value: 80, change: 1e308 }])} />);
    expect(container.querySelector(".hb-kpi-change")).toBeNull();
  });
});

describe("sparkline path", () => {
  it("spans the box, highest at the top, a flat trend across the middle", () => {
    expect(sparkPath([0, 10])).toBe("M0 26L120 2");
    expect(sparkPath([0, 10, 5])).toBe("M0 26L60 2L120 14");
    expect(sparkPath([5, 5])).toBe("M0 14L120 14");
  });
  it("leaves a gap's slot empty, so the line breaks instead of joining across it", () => {
    expect(sparkPath([0, null, 10])).toBe("M0 26M120 2");
    expect(sparkPath([10, null, null, 0])).toBe("M0 2M120 26");
    expect(sparkPath([null, null])).toBe("");
  });
});

describe("kpis with an unknown value", () => {
  it("write no data where the number would be, not a 0 and not a dash", () => {
    expect(kpiValue({ label: "Chargebacks", value: null })).toBe("no data");
    expect(kpiValue({ label: "Chargebacks", value: null }, { full: true })).toBe("no data");
    render(<Blocks blocks={readBlocks([{ type: "kpis", items: [{ label: "Chargebacks", value: null }, { label: "Returns", value: 0 }] }])} />);
    const card = screen.getByText("Chargebacks").parentElement!;
    expect(card.querySelector(".hb-kpi-value")!.textContent).toBe("no data");
    expect(card.querySelector(".hb-kpi-value")!.className).toContain("hb-kpi-value-empty");
    const zeros = document.querySelectorAll(".hb-kpi-value");
    expect(zeros[1].textContent).not.toBe("no data");  // a measured zero stays a figure
    expect(zeros[1].className).not.toContain("hb-kpi-value-empty");
  });
  it("draw a trend's gaps as breaks in its sparkline", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "stat", label: "Close", value: 80, trend: [100, null, 80] }])} />);
    expect(container.querySelector("svg.hb-kpi-spark path")!.getAttribute("d")).toBe(sparkPath([100, null, 80]));
    expect(container.querySelector("svg.hb-kpi-spark path")!.getAttribute("d")).toBe("M0 2M120 26");
  });
  it("read a value the card can't use as no data, not as 0", () => {
    // the checker lets these through, so the card must draw them the way it draws a null
    for (const value of [true, false, [1, 2], Number.NaN, "   "]) {
      const { container, unmount } = render(<Blocks blocks={readBlocks([{ type: "stat", label: "Saved", value, unit: "₹" }])} />);
      expect([...container.querySelectorAll(".hb-kpi-value")].map((v) => v.textContent)).toEqual(["no data"]);
      unmount();
    }
  });
});
