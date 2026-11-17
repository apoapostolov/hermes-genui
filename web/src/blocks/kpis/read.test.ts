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
  it("reads the change from a previous number, as a share of it", () => {
    const item = (kpi: any) => (readBlocks([{ type: "kpis", items: [{ label: "Close", ...kpi }] }])[0] as any).items[0];
    expect(item({ value: 80, previous: 100 })).toMatchObject({ change: -20, change_unit: "%" });
    expect(item({ value: 120, previous: 100 }).change).toBeCloseTo(20, 10);
    expect(item({ value: 72275, unit: "₹Cr", previous: 70223 }).change).toBeCloseTo(2.9221, 3);
  });
  it("counts points when the card's unit is %", () => {
    const stat = readBlocks([{ type: "stat", label: "Margin", value: 18.6, unit: "%", previous: 19.5 }])[0] as any;
    expect(stat.change).toBeCloseTo(-0.9, 10);
    expect(stat.change_unit).toBe("pt");
  });
  it("lets previous win over a written change", () => {
    const stat = readBlocks([{ type: "stat", label: "Close", value: 80, previous: 100, change: 2 }])[0] as any;
    expect(stat.change).toBe(-20);
  });
  it("has no change when one side is unknown, or a share of zero is asked for", () => {
    const stat = (kpi: any) => readBlocks([{ type: "stat", label: "Close", ...kpi }])[0] as any;
    expect("change" in stat({ value: 80, previous: null, change: 2 })).toBe(false);
    expect("change" in stat({ value: "Leeds (H)", previous: 2 })).toBe(false);
    expect("change" in stat({ value: 70, previous: 0 })).toBe(false);
    expect(stat({ value: 70, previous: 0, change_unit: "pt" }).change).toBe(70);
  });
  it("keeps an explicit change_unit on a change it computed", () => {
    expect((readBlocks([{ type: "stat", label: "Close", value: 120, previous: 100, change_unit: "pt" }])[0] as any))
      .toMatchObject({ change: 20, change_unit: "pt" });
  });
  it("keeps a written change in its own unit on a % card", () => {
    const stat = (kpi: any) => readBlocks([{ type: "stat", label: "Margin", ...kpi }])[0] as any;
    expect(stat({ value: 18.6, unit: "%", change: -0.9 })).toMatchObject({ change: -0.9, change_unit: "%" });
    expect(stat({ value: 18.6, unit: "%", change: 5 })).toMatchObject({ change: 5, change_unit: "%" });
    expect(stat({ value: 18.6, unit: "%", change: 5, change_unit: "pt" })).toMatchObject({ change_unit: "pt" });
  });
  it("drops a change no chip can print", () => {
    const stat = (kpi: any) => readBlocks([{ type: "stat", label: "Close", ...kpi }])[0] as any;
    expect("change" in stat({ value: 80, change: 1e308 })).toBe(false);
    expect("change" in stat({ value: 1e308, previous: 1e-300 })).toBe(false);
  });
  it("keeps invert_tone only when it is true", () => {
    const read = (kpi: any) => readBlocks([{ type: "stat", label: "Churn", ...kpi }])[0] as any;
    expect(read({ value: 2.4, previous: 3.1, invert_tone: true }).invert_tone).toBe(true);
    expect("invert_tone" in read({ value: 2.4, previous: 3.1 })).toBe(false);
    expect("invert_tone" in read({ value: 2.4, previous: 3.1, invert_tone: "yes" })).toBe(false);
    expect("invert_tone" in read({ value: 2.4, previous: 3.1, invert_tone: 0 })).toBe(false);
    expect("invert_tone" in read({ value: 2.4, previous: 3.1, invert_tone: null })).toBe(false);
  });
  it("ignores a previous or change it cannot use", () => {
    const stat = (kpi: any) => readBlocks([{ type: "stat", label: "Close", ...kpi }])[0] as any;
    expect("change" in stat({ value: 80, previous: "100" })).toBe(false);
    expect("change" in stat({ value: 80, previous: "n/a" })).toBe(false);
    expect("change" in stat({ value: 80, change: "2" })).toBe(false);
  });
});
