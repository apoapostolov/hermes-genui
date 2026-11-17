import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import catalog from "../../../core/catalog.json";
import type { Block } from "../registry";
import { Blocks } from "./Blocks";
import { readBlocks } from "./readBlocks";

afterEach(cleanup);

const example = (kind: string) => catalog.blocks.find((b) => b.kind === kind)!.example;

describe("Blocks", () => {
  it("draws the timeline example: day labels, times and titles", () => {
    render(<Blocks blocks={readBlocks([example("timeline")])} />);
    expect(screen.getByText("Day 1 · Fri 9 Oct")).toBeTruthy();
    expect(screen.getByText("Day 2 · Sat 10 Oct")).toBeTruthy();
    expect(screen.getByText("07:00")).toBeTruthy();
    expect(screen.getByText("Fushimi Inari")).toBeTruthy();
  });

  it("keeps a collapsed section's children hidden until its header is clicked", () => {
    render(<Blocks blocks={readBlocks([example("section")])} />);
    expect(screen.queryByText(/Fly to Coimbatore/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Getting there/ }));
    expect(screen.getByText(/Fly to Coimbatore/)).toBeTruthy();
  });

  it("shows a kpi's change as a chip", () => {
    render(<Blocks blocks={readBlocks([{ type: "kpis", items: [{ label: "Revenue", value: 72275, unit: "₹Cr", change: 2.2 }] }])} />);
    expect(screen.getByText("▲ 2.2%")).toBeTruthy();
    expect(screen.getByText("₹72,275 Cr")).toBeTruthy();
  });

  it("draws nothing for an unknown type", () => {
    const { container } = render(<Blocks blocks={[{ type: "sundial" } as unknown as Block]} />);
    expect(container.querySelector(".hb-blocks")!.textContent).toBe("");
  });

  it("draws **bold** in text as bold", () => {
    const { container } = render(<Blocks blocks={readBlocks([{ type: "text", text: "Leave at **7:10** sharp" }])} />);
    expect(container.querySelector("strong")!.textContent).toBe("7:10");
  });

  it("draws every non-chart, non-photo catalog example without throwing", () => {
    const kinds = catalog.blocks.map((b) => b.kind).filter((k) => !["chart", "images", "include"].includes(k));
    const { container } = render(<Blocks blocks={readBlocks(kinds.map(example))} />);
    expect(container.querySelector(".hb-blocks")!.children.length).toBe(kinds.length);
  });
});
