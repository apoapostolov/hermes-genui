import { describe, expect, it } from "vitest";
import { blockName, seriesWords } from "./a11y";

describe("the name ladder", () => {
  it("takes the block's own words first, then what it draws, then the type in words", () => {
    expect(blockName("chart", ["Revenue vs profit", "Revenue, Net profit"])).toBe("Revenue vs profit");
    expect(blockName("chart", [undefined, "Revenue, Net profit"])).toBe("Revenue, Net profit");
    expect(blockName("chart", [undefined, undefined])).toBe("Chart");
  });
  it("reads the model's group name before the type in words", () => {
    expect(blockName("kpis", [undefined, "This week"])).toBe("This week");
    expect(blockName("kpis", [undefined, undefined])).toBe("Figures");
    expect(blockName("tiles", [undefined])).toBe("Choices");
    expect(blockName("actions", [undefined])).toBe("Actions");
  });
  it("skips words that are blank or not text", () => {
    expect(blockName("progress", ["  ", "Level 4"])).toBe("Level 4");
    expect(blockName("heatmap", [undefined])).toBe("Heat map");
  });
  it("names a chart without a title after its series", () => {
    expect(seriesWords([{ name: "Revenue" }, { name: "Net profit" }])).toBe("Revenue, Net profit");
    expect(seriesWords([{ name: "Revenue" }, {}])).toBe("Revenue");
    expect(seriesWords([{}])).toBeUndefined();
  });
});
