import { afterEach, describe, expect, it, vi } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { bigNumber, changeOf, isChangeColumn, miniBar } from "./cells";

describe("change columns", () => {
  it("are number columns with a sign written somewhere", () => {
    expect(isChangeColumn([["A", "+5%"], ["B", "-3%"]], 1)).toBe(true);
    expect(isChangeColumn([["A", "4.1%"], ["B", "−2.0%"]], 1)).toBe(true);
    expect(isChangeColumn([["A", "₹300"], ["B", "₹50"]], 1)).toBe(false);
    expect(isChangeColumn([["A", "+5%"], ["B", "n/a"]], 1)).toBe(false);
    expect(isChangeColumn([["A", ""], ["B", ""]], 1)).toBe(false);
    // a cell written as unknown ("–") is skipped the way a blank one is, so the column still reads as changes
    expect(isChangeColumn([["A", "+5%"], ["B", "–"], ["C", "-3%"]], 1)).toBe(true);
    expect(isChangeColumn([["A", "+5%"], ["B", "–"]], 1)).toBe(true);
  });
  it("read each cell as a rise, a fall or neither", () => {
    expect(changeOf("+1.76%")).toBe("up");
    expect(changeOf("−18.67%")).toBe("down");
    expect(changeOf("0.00%")).toBeNull();
    expect(changeOf("")).toBeNull();
  });
});

describe("mini bars", () => {
  it("grow from the middle, right for a rise and left for a fall", () => {
    expect(miniBar(5, 10)).toEqual({ left: 50, width: 25 });
    expect(miniBar(-10, 10)).toEqual({ left: 0, width: 50 });
    expect(miniBar(0, 0)).toEqual({ left: 50, width: 0 });
  });
});

describe("big numbers in cells", () => {
  afterEach(() => vi.restoreAllMocks());
  it("shorten a written-out amount from 100,000 up and keep every digit for the hover", () => {
    pinLocale("en-US");
    expect(bigNumber("1,250,000")).toEqual({ short: "1.25M", full: "1,250,000" });
    expect(bigNumber("-$4,213,500,000")).toEqual({ short: "-$4.21B", full: "-$4,213,500,000" });
    expect(bigNumber("₹18,40,000")).toEqual({ short: "₹18.4L", full: "₹18,40,000" });
    expect(bigNumber("+1,250,000")).toEqual({ short: "+1.25M", full: "+1,250,000" }); // a rise keeps its sign
  });
  it("leave codes, small numbers and numbers with words alone", () => {
    pinLocale("en-US");
    expect(bigNumber("560001")).toBeNull(); // a PIN code or an id: no grouping, no currency
    expect(bigNumber("99,999")).toBeNull();
    expect(bigNumber("4,800 mAh")).toBeNull();
    expect(bigNumber("Pixel 10a")).toBeNull();
  });
});

describe("a column of mixed metrics is not a change column", () => {
  it("needs every non-zero number to carry its sign, so P/E 13.3 beside +4.7% stays plain", () => {
    const metricsByRow = [["1-year price change", "-26.77%"], ["P/E", "13.3"], ["P/B", "1.83"], ["PAT growth YoY", "+4.7%"]];
    expect(isChangeColumn(metricsByRow, 1)).toBe(false);
    const changes = [["TCS", "+1.76%"], ["Infosys", "−18.67%"], ["Wipro", "0.00%"]];
    expect(isChangeColumn(changes, 1)).toBe(true);
  });
});
