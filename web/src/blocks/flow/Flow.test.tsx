import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";
import { fitsAcross } from "./Flow";

afterEach(cleanup);

const flow = { type: "flow", id: "tf", title: "How a transformer picks the next word", nodes: [
  { id: "tokens", label: "Tokens", icon: "note", note: "The text cut into **pieces**." },
  { id: "attn", label: "Attention", note: "Each token weighs the others." },
  { id: "ffn", label: "Feed-forward" },
], groups: [{ label: "Repeated × 12 layers", nodes: ["attn", "ffn"] }] };

const draw = (blocks: unknown[]) => render(<Blocks blocks={readBlocks(blocks)} />);

describe("Flow", () => {
  it("draws the title, every node in order with arrows between, and the repeat frame round its group", () => {
    const { container } = draw([flow]);
    expect(screen.getByText("How a transformer picks the next word")).toBeTruthy();
    const labels = [...container.querySelectorAll(".hb-flow-label")].map((n) => n.textContent);
    expect(labels).toEqual(["Tokens", "Attention", "Feed-forward"]);
    expect(container.querySelectorAll(".hb-flow-arrow").length).toBe(2);
    const frame = container.querySelector(".hb-flow-group")!;
    expect(frame.querySelector(".hb-flow-group-label")!.textContent).toBe("Repeated × 12 layers");
    expect([...frame.querySelectorAll(".hb-flow-label")].map((n) => n.textContent)).toEqual(["Attention", "Feed-forward"]);
    expect(container.querySelector(".hb-flow-node svg")).not.toBeNull();  // the icon
  });

  it("flows right in a wide column, and down when asked or when the column is too narrow", () => {
    const wide = draw([flow]);
    expect(wide.container.querySelector(".hb-flow-right")).not.toBeNull();
    cleanup();
    const asked = draw([{ ...flow, direction: "down" }]);
    expect(asked.container.querySelector(".hb-flow-down")).not.toBeNull();
    cleanup();
    const long = { type: "flow", nodes: Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, label: `Stage ${i}` })) };
    const narrow = draw([long]);  // 8 boxes don't fit the 560px column assumed in tests
    expect(narrow.container.querySelector(".hb-flow-down")).not.toBeNull();
  });

  it("opens one note at a time in a panel under the diagram, and closes it on a second tap or Escape", () => {
    const { container } = draw([flow]);
    const tokens = screen.getByRole("button", { name: /Tokens/ });
    const attn = screen.getByRole("button", { name: /Attention/ });
    expect(tokens.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".hb-flow-panel")).toBeNull();
    fireEvent.click(tokens);
    expect(tokens.getAttribute("aria-expanded")).toBe("true");
    const panel = container.querySelector(".hb-flow-panel")!;
    expect(tokens.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.textContent).toContain("The text cut into pieces.");
    expect(panel.querySelector("strong")!.textContent).toBe("pieces");
    fireEvent.click(attn);
    expect(tokens.getAttribute("aria-expanded")).toBe("false");
    expect(attn.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".hb-flow-panel")!.textContent).toContain("Each token weighs the others.");
    fireEvent.click(attn);
    expect(container.querySelector(".hb-flow-panel")).toBeNull();
    fireEvent.click(attn);
    fireEvent.keyDown(attn, { key: "Escape" });
    expect(container.querySelector(".hb-flow-panel")).toBeNull();
  });

  it("draws a node without a note as a plain box, not a button", () => {
    draw([flow]);
    expect(screen.queryByRole("button", { name: /Feed-forward/ })).toBeNull();
    expect(screen.getByText("Feed-forward")).toBeTruthy();
  });

  it("fits across only when every box has room: 5 boxes and a group fit 560px, 6 don't", () => {
    expect(fitsAcross(5, 1, 560)).toBe(true);
    expect(fitsAcross(6, 0, 560)).toBe(false);
    expect(fitsAcross(2, 0, 300)).toBe(true);
  });
});

describe("what a flow is called", () => {
  it("is a group named by its title", () => {
    render(<Blocks blocks={readBlocks([flow])} />);
    expect(screen.getByRole("group", { name: "How a transformer picks the next word" })).toBeTruthy();
  });

  it("says what it is when it has no title", () => {
    const { title, ...untitled } = flow;
    render(<Blocks blocks={readBlocks([untitled])} />);
    expect(screen.getByRole("group", { name: "Flow" })).toBeTruthy();
  });
});
