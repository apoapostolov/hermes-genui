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

  it("reads a cell with no number as no data, so it isn't heard as a zero", () => {
    draw({ type: "heatmap", title: "Banks", rows: ["JPM"], cols: ["Q1", "Q2"], values: [[4.1, null]], unit: "%" });
    const cell = screen.getByRole("button", { name: "JPM, Q2: no data" });
    expect(cell.textContent).toBe("");
    expect(cell.getAttribute("style")).toContain("var(--hb-well)");
    expect(screen.getByRole("button", { name: "JPM, Q1: 4.1%" })).toBeTruthy();
  });
});
