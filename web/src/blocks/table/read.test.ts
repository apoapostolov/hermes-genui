import { describe, expect, it } from "vitest";
import { readBlocksNoted } from "../../core/readBlocks";
import { cellNumber, isNumberColumn, nextSort, sortedOrder } from "./sort";

describe("table reader", () => {
  it("takes headers, object rows and a bare-number highlight", () => {
    const r = readBlocksNoted([{ type: "table", headers: ["Phone", "Price"], data: [["Pixel", 44999], { phone: "Galaxy", Price: "₹42,999" }], highlight: 0 }]);
    expect(r.blocks[0]).toEqual({ type: "table", columns: ["Phone", "Price"], rows: [["Pixel", "44999"], ["Galaxy", "₹42,999"]], highlight: { row: 0 } });
  });
  it("pads short rows and drops rows wider than the columns", () => {
    const r = readBlocksNoted([{ type: "table", columns: ["A", "B"], rows: [["1"], ["1", "2", "3"]] }]);
    expect((r.blocks[0] as any).rows).toEqual([["1", ""]]);
    expect(r.dropped).toEqual([{ path: "0.rows.1", why: "row has 3 cells, table has 2 columns" }]);
  });
  it("picks a highlight by name and ignores one outside the table", () => {
    const named = readBlocksNoted([{ type: "table", columns: ["Stock", "1mo"], rows: [["GOOGL", "-18%"], ["MSFT", "+2%"]], highlight: "MSFT" }]);
    expect((named.blocks[0] as any).highlight).toEqual({ row: 1 });
    const outside = readBlocksNoted([{ type: "table", columns: ["A"], rows: [["x"]], highlight: { row: 5 } }]);
    expect((outside.blocks[0] as any).highlight).toBeUndefined();
  });
  it("is dropped without columns", () => {
    expect(readBlocksNoted([{ type: "table", rows: [] }]).blocks).toEqual([]);
  });
  it("keeps its columns when no row is usable, so it can say so", () => {
    const r = readBlocksNoted([{ type: "table", columns: ["A", "B"], rows: [5, "x"] }]);
    expect(r.blocks[0]).toEqual({ type: "table", columns: ["A", "B"], rows: [] });
    expect(r.dropped.map((d) => d.why)).toContain("table has no rows");
  });
  it("writes a null cell as a dash and leaves a column an object row doesn't carry blank", () => {
    const r = readBlocksNoted([{ type: "table", columns: ["Shop", "Price", "Change"],
      rows: [["Shop A", 12, null], { Shop: "Shop B", Price: 0 }] }]);
    expect((r.blocks[0] as any).rows).toEqual([["Shop A", "12", "–"], ["Shop B", "0", ""]]);
  });
  it("keeps a number column numeric and sortable through a null cell", () => {
    const r = readBlocksNoted([{ type: "table", columns: ["Shop", "Sales"],
      rows: [["A", 31000], ["B", null], ["C", 18000]] }]);
    const { rows } = r.blocks[0] as any;
    expect(rows).toEqual([["A", "31000"], ["B", "–"], ["C", "18000"]]);
    // "–" is a value written as unknown, not a filled cell: the column still reads as numbers and sorts with it last.
    expect(isNumberColumn(rows, 1)).toBe(true);
    expect(sortedOrder(rows, { column: 1, direction: "up" })).toEqual([2, 0, 1]);
    expect(sortedOrder(rows, { column: 1, direction: "down" })).toEqual([0, 2, 1]);
  });
});

describe("table sorting", () => {
  it("reads the number a cell starts with", () => {
    expect(cellNumber("₹44,999")).toBe(44999);
    expect(cellNumber("4,800 mAh")).toBe(4800);
    expect(cellNumber("-18.67%")).toBe(-18.67);
    expect(cellNumber("−4.1%")).toBe(-4.1); // a typeset minus
    expect(cellNumber("-$279.84")).toBe(-279.84); // the sign before the currency
    expect(cellNumber("+₹1,200")).toBe(1200);
    expect(cellNumber("Pixel 10a")).toBeNull();
  });
  it("sorts numbers as numbers with blanks last, and cycles up, down, off", () => {
    const rows = [["A", "₹300"], ["B", ""], ["C", "₹50"]];
    expect(sortedOrder(rows, { column: 1, direction: "up" })).toEqual([2, 0, 1]);
    expect(sortedOrder(rows, null)).toEqual([0, 1, 2]);
    expect(nextSort(null, 1)).toEqual({ column: 1, direction: "up" });
    expect(nextSort({ column: 1, direction: "up" }, 1)).toEqual({ column: 1, direction: "down" });
    expect(nextSort({ column: 1, direction: "down" }, 1)).toBeNull();
  });
  it("calls a column numeric when every filled cell starts with a number", () => {
    expect(isNumberColumn([["a", "₹1"], ["b", ""]], 1)).toBe(true);
    expect(isNumberColumn([["a", "₹1"], ["b", "n/a"]], 1)).toBe(false);
  });
});
