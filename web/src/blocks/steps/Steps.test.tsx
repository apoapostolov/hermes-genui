import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";

afterEach(cleanup);

const flow = { type: "flow", id: "tf", nodes: [
  { id: "tokens", label: "Tokens", note: "Pieces of text." },
  { id: "attn", label: "Attention" },
  { id: "out", label: "Next word" },
] };
const steps = { type: "steps", title: "Step by step", for: "tf", items: [
  { title: "Split the text", text: "Into **tokens**.", node: "tokens" },
  { title: "Attend", text: "Each token weighs the others.", node: "attn", image: "https://x.example/a.jpg" },
  { title: "Pick", text: "The likeliest token wins." },
] };

const draw = (blocks: unknown[]) => render(<Blocks blocks={readBlocks(blocks)} />);
const next = () => screen.getByRole("button", { name: "Next" });
const back = () => screen.getByRole("button", { name: "Back" });

describe("Steps", () => {
  it("shows one step at a time with its place, dots, and Back / Next at the ends", () => {
    const { container } = draw([steps]);
    expect(screen.getByText("Step by step")).toBeTruthy();
    expect(screen.getByText("1 of 3")).toBeTruthy();
    expect(screen.getByText("Split the text")).toBeTruthy();
    expect(container.querySelector(".hb-steps-body strong")!.textContent).toBe("tokens");
    expect(container.querySelectorAll(".hb-steps-dot").length).toBe(3);
    expect(back().hasAttribute("disabled")).toBe(true);
    fireEvent.click(next());
    expect(screen.getByText("2 of 3")).toBeTruthy();
    expect(screen.getByText("Attend")).toBeTruthy();
    const img = container.querySelector(".hb-steps-photo") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://x.example/a.jpg");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    fireEvent.click(next());
    expect(next().hasAttribute("disabled")).toBe(true);
    fireEvent.click(back());
    expect(screen.getByText("2 of 3")).toBeTruthy();
  });

  it("moves with the arrow keys when focused, and jumps from a dot", () => {
    const { container } = draw([steps]);
    const box = container.querySelector(".hb-steps") as HTMLElement;
    fireEvent.keyDown(box, { key: "ArrowRight" });
    expect(screen.getByText("2 of 3")).toBeTruthy();
    fireEvent.keyDown(box, { key: "ArrowLeft" });
    fireEvent.keyDown(box, { key: "ArrowLeft" });
    expect(screen.getByText("1 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Step 3: Pick" }));
    expect(screen.getByText("3 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Step 3: Pick" }).getAttribute("aria-current")).toBe("step");
  });

  it("hides a photo that fails to load", () => {
    const { container } = draw([steps]);
    fireEvent.click(next());
    fireEvent.error(container.querySelector(".hb-steps-photo")!);
    expect(container.querySelector(".hb-steps-photo")).toBeNull();
    expect(screen.getByText("Attend")).toBeTruthy();
  });

  it("lights the flow node of the step shown, and none for a step without one", () => {
    const { container } = draw([flow, steps]);
    const lit = () => [...container.querySelectorAll(".hb-flow-lit .hb-flow-label")].map((n) => n.textContent);
    expect(lit()).toEqual(["Tokens"]);
    expect(screen.getByRole("button", { name: /Tokens/ }).getAttribute("aria-current")).toBe("step");
    fireEvent.click(next());
    expect(lit()).toEqual(["Attention"]);
    fireEvent.click(next());
    expect(lit()).toEqual([]);
  });

  it("ignores a flow id or node id it can't find, and never lights another board's flow", () => {
    const { container } = draw([flow, { ...steps, for: "nope" }]);
    expect(container.querySelector(".hb-flow-lit")).toBeNull();
    cleanup();
    const odd = draw([flow, { ...steps, items: [{ title: "A", node: "ghost" }, { title: "B", node: "attn" }] }]);
    expect(odd.container.querySelector(".hb-flow-lit")).toBeNull();
    cleanup();
    const two = render(<><Blocks blocks={readBlocks([flow])} /><Blocks blocks={readBlocks([steps])} /></>);
    expect(two.container.querySelector(".hb-flow-lit")).toBeNull();
  });

  it("lights its flow inside containers and tabs on the same board", () => {
    const { container } = draw([{ type: "columns", children: [flow, steps] }]);
    expect(container.querySelector(".hb-flow-lit .hb-flow-label")!.textContent).toBe("Tokens");
  });
});

describe("what a walkthrough is called", () => {
  it("is a group named by its title, or by what it is", () => {
    render(<Blocks blocks={readBlocks([{ type: "steps", title: "How a prompt runs", items: [{ title: "Ask" }, { title: "Answer" }] }])} />);
    expect(screen.getByRole("group", { name: "How a prompt runs" })).toBeTruthy();
    cleanup();
    render(<Blocks blocks={readBlocks([{ type: "steps", items: [{ title: "Ask" }, { title: "Answer" }] }])} />);
    expect(screen.getByRole("group", { name: "Steps" })).toBeTruthy();
  });
});
