import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readBlocks } from "../../core/readBlocks";
import { Blocks } from "../../core/Blocks";

afterEach(cleanup);

const draw = (block: unknown) => render(<Blocks blocks={readBlocks([block])} />).container;

describe("Heatmap", () => {
  it("prints numbers in the cells when there are few columns, shading a loss warm", () => {
    const c = draw({ type: "heatmap", title: "Banks", rows: ["JPM"], cols: ["Q1", "Q2"], values: [[4.1, -1.2]], unit: "%" });
    expect(screen.getByText("Banks")).toBeTruthy();
    expect(screen.getByText("4.1%")).toBeTruthy();
    expect(screen.getByRole("rowheader").textContent).toBe("JPM");
    const loss = screen.getByRole("button", { name: "JPM, Q2: -1.2%" }) as HTMLElement;
    expect(loss.getAttribute("style")).toContain("var(--hb-warn)");
    expect(c.querySelectorAll('[role="columnheader"]').length).toBe(2);
  });

  it("leaves the cells blank when there are many columns, and shows a cell's number when it is tapped", () => {
    const cols = Array.from({ length: 8 }, (_, i) => `M${i + 1}`);
    draw({ type: "heatmap", rows: ["JPM"], cols, values: [cols.map((_, i) => i)] });
    expect(screen.queryByText("7")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "JPM, M8: 7" }));
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText(/JPM · M8/)).toBeTruthy();
  });
});

describe("the heat map as a table", () => {
  const draw = (block: unknown) => render(<Blocks blocks={readBlocks([block])} />).container;

  it("is a table named by its title, with a row per row and a cell per value", () => {
    const c = draw({ type: "heatmap", title: "Banks", rows: ["JPM", "GS"], cols: ["Q1", "Q2"], values: [[4.1, -1.2], [7.5, 2.2]], unit: "%" });
    expect(screen.getByRole("table", { name: "Banks" })).toBeTruthy();
    expect(c.querySelectorAll('[role="row"]').length).toBe(3);          // the column headers and the two rows
    expect(c.querySelectorAll('[role="cell"]').length).toBe(5);         // one corner, four values
    expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["JPM", "GS"]);
  });

  it("keeps every cell a button in the same tab order, so a tap still shows its number", () => {
    const c = draw({ type: "heatmap", title: "Banks", rows: ["JPM"], cols: ["Q1", "Q2"], values: [[4.1, -1.2]], unit: "%" });
    expect(c.querySelectorAll("button.hb-heat-cell").length).toBe(2);
    expect(screen.getByRole("button", { name: "JPM, Q2: -1.2%" })).toBeTruthy();
  });

  it("names a heat map that has no title after what it is", () => {
    draw({ type: "heatmap", rows: ["JPM"], cols: ["Q1"], values: [[1]] });
    expect(screen.getByRole("table", { name: "Heat map" })).toBeTruthy();
  });
});
