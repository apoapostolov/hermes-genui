import { describe, expect, it } from "vitest";
import { readBlocks } from "../../core/readBlocks";

describe("kpis and stat", () => {
  it("keeps short text values", () => {
    const b = readBlocks([{ type: "kpis", items: [{ label: "Opponent", value: "Leeds United (H)" }, { label: "Goals", value: 2 }] }]);
    expect((b[0] as any).items.map((i: any) => i.value)).toEqual(["Leeds United (H)", 2]);
  });
  it("keeps at most 4 items", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ label: `k${i}`, value: i }));
    expect((readBlocks([{ type: "kpis", items }])[0] as any).items.length).toBe(4);
  });
  it("reads a stat with its title as label", () => {
    expect(readBlocks([{ type: "stat", title: "Saved", value: 42000, unit: "₹", change: 12 }])[0]).toEqual({
      type: "stat", label: "Saved", value: 42000, unit: "₹", change: 12, change_unit: "%",
    });
  });
  it("keeps a trend's slots, a gap left where the model gave none, the last 60 at most", () => {
    const read = (trend: unknown) => (readBlocks([{ type: "kpis", items: [{ label: "Close", value: 80, trend }] }])[0] as any).items[0];
    expect(read([100, "90", null, 85, Infinity, 80]).trend).toEqual([100, null, null, 85, null, 80]);
    expect(read([100, null, 80]).trend).toEqual([100, null, 80]);
    expect(read(Array.from({ length: 80 }, (_, i) => i)).trend).toEqual(Array.from({ length: 60 }, (_, i) => i + 20));
    expect("trend" in read([5, "6"])).toBe(false);
    expect("trend" in read([5, null])).toBe(false);
    expect("trend" in read("1,2,3")).toBe(false);
  });
  it("keeps a null value as unknown, and keeps a written zero as the number it is", () => {
    const items = (readBlocks([{ type: "kpis", items: [{ label: "Chargebacks", value: null }, { label: "Returns", value: 0 }] }])[0] as any).items;
    expect(items.map((i: any) => i.value)).toEqual([null, 0]);
  });
  it("reads a stat's trend too", () => {
    expect((readBlocks([{ type: "stat", label: "Saved", value: 3, trend: [1, 2, 3] }])[0] as any).trend).toEqual([1, 2, 3]);
  });
});
