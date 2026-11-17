import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import catalog from "../../../../core/catalog.json";
import { readBlocks } from "../../core/readBlocks";
import { Blocks } from "../../core/Blocks";

afterEach(cleanup);

const board = readBlocks([{ type: "tabs", tabs: [
  { label: "Overview", children: [{ type: "text", text: "First view" }] },
  { label: "Risks", children: [{ type: "text", text: "Second view" }] },
  { label: "Verdict", children: [{ type: "text", text: "Third view" }] },
] }]);

describe("tabs", () => {
  it("shows a tab bar with the first tab selected and only its children drawn", () => {
    render(<Blocks blocks={board} />);
    expect(screen.getByRole("tablist")).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Overview", "Risks", "Verdict"]);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(screen.getByRole("tabpanel").textContent).toContain("First view");
    expect(screen.queryByText("Second view")).toBeNull();
  });
  it("shows a tab's count badge and says it to screen readers", () => {
    render(<Blocks blocks={readBlocks([{ type: "tabs", tabs: [
      { label: "Bills", badge: 4, children: [{ type: "text", text: "a" }] },
      { label: "Done", children: [{ type: "text", text: "b" }] },
    ] }])} />);
    const bills = screen.getByRole("tab", { name: "Bills, 4 open" });
    expect(bills.querySelector(".hb-tab-badge")?.textContent).toBe("4");
    expect(screen.getByRole("tab", { name: "Done" }).querySelector(".hb-tab-badge")).toBeNull();
  });
  it("switches on click: the other tab's content shows and the first's is gone", () => {
    render(<Blocks blocks={board} />);
    fireEvent.click(screen.getByRole("tab", { name: "Risks" }));
    expect(screen.getByText("Second view")).toBeTruthy();
    expect(screen.queryByText("First view")).toBeNull();
    expect(screen.getByRole("tab", { name: "Risks" }).getAttribute("aria-selected")).toBe("true");
  });
  it("moves with the Left and Right arrow keys, wrapping at the ends", () => {
    render(<Blocks blocks={board} />);
    const first = screen.getByRole("tab", { name: "Overview" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByText("Second view")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Risks" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "Risks" }), { key: "ArrowLeft" });
    expect(screen.getByText("First view")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "ArrowLeft" });
    expect(screen.getByText("Third view")).toBeTruthy();
  });
  it("draws the catalog example", () => {
    const example = catalog.blocks.find((b) => b.kind === "tabs")!.example;
    const { container } = render(<Blocks blocks={readBlocks([example])} />);
    expect(container.querySelector(".hb-tabs [role=tablist]")).toBeTruthy();
    expect(screen.getAllByRole("tab").length).toBe((example as any).tabs.length);
  });
});
