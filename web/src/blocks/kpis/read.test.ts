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
  it("keeps a trend's finite numbers, the last 60 at most", () => {
    const read = (trend: unknown) => (readBlocks([{ type: "kpis", items: [{ label: "Close", value: 80, trend }] }])[0] as any).items[0];
    expect(read([100, "90", null, 85, Infinity, 80]).trend).toEqual([100, 85, 80]);
    expect(read(Array.from({ length: 80 }, (_, i) => i)).trend).toEqual(Array.from({ length: 60 }, (_, i) => i + 20));
    expect("trend" in read([5, "6"])).toBe(false);
    expect("trend" in read("1,2,3")).toBe(false);
  });
  it("reads a stat's trend too", () => {
    expect((readBlocks([{ type: "stat", label: "Saved", value: 3, trend: [1, 2, 3] }])[0] as any).trend).toEqual([1, 2, 3]);
  });
});

describe("a kpis group name", () => {
  const read = (raw: object) => readBlocks([{ type: "kpis", ...raw }])[0] as any;
  it("keeps the model's heading, trimmed", () => {
    expect(read({ name: "  This week ", items: [{ label: "Steps", value: 8200 }] }).name).toBe("This week");
  });
  it("leaves the field off when it is blank or not text", () => {
    for (const name of ["", "   ", 7, null, { title: "x" }]) {
      expect("name" in read({ name, items: [{ label: "Steps", value: 8200 }] })).toBe(false);
    }
  });
  it("reads a name on kpis only, not on stat", () => {
    expect(readBlocks([{ type: "stat", name: "This week", label: "Steps", value: 8200 }])[0]).not.toHaveProperty("name");
  });
});
