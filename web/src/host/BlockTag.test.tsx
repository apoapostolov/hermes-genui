import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "../../../core/catalog.json";
import { BlockActions } from "./actions";
import { BlockTag } from "./BlockTag";

afterEach(cleanup);

const timeline = catalog.blocks.find((b) => b.kind === "timeline")!.example;

describe("BlockTag", () => {
  it("shows a placeholder while the reply is still streaming, without loading", () => {
    const load = vi.fn();
    render(<BlockTag id="7f3a09bc" streaming={true} load={load} />);
    expect(screen.getByText("drawing…")).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it("renders nothing for a malformed id, without loading", () => {
    const load = vi.fn();
    const { container } = render(<BlockTag id="zzz" streaming={false} load={load} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Couldn't load this block")).toBeNull();
    expect(container.querySelector(".hb-state")).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("renders nothing when loading fails", async () => {
    const { container } = render(<BlockTag id="7f3a09bc" streaming={false} load={() => Promise.reject(new Error("404"))} />);
    await waitFor(() => expect(container.querySelector(".hb-state")).toBeNull());
    expect(screen.queryByText("Couldn't load this block")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the stored data has nothing drawable", async () => {
    const { container } = render(
      <BlockTag id="7f3a09bc" streaming={false} load={() => Promise.resolve({ blocks: [{ type: "weather" }] })} />,
    );
    await waitFor(() => expect(container.querySelector(".hb-state")).toBeNull());
    expect(screen.queryByText("Couldn't load this block")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("draws the stored blocks", async () => {
    const load = vi.fn(() => Promise.resolve({ blocks: [timeline] }));
    render(<BlockTag id="7f3a09bc" streaming={false} load={load} />);
    await waitFor(() => expect(screen.getByText("Day 1 · Fri 9 Oct")).toBeTruthy());
    expect(load).toHaveBeenCalledWith("7f3a09bc");
  });

  it("hands its id to the blocks inside, so a checklist loads its board's saved ticks", async () => {
    const rest = vi.fn(async () => ({ state: { "0": [0] } }));
    const checklist = { type: "checklist", items: ["Passport", "Tickets"] };
    render(
      <BlockActions.Provider value={{ send: vi.fn(), fill: vi.fn(), rest }}>
        <BlockTag id="7f3a09bc" streaming={false} load={() => Promise.resolve({ blocks: [checklist] })} />
      </BlockActions.Provider>,
    );
    await waitFor(() => expect(screen.getByText("1 of 2 done")).toBeTruthy());
    expect(rest).toHaveBeenCalledWith("/blocks/7f3a09bc/state");
  });

  it("threads the board's placement words from the stored answer into the drawing", async () => {
    const heading = { type: "heading", text: "Revenue hit ₹72,275 Cr" };
    const { container } = render(
      <BlockTag id="7f3a09bc" streaming={false}
        load={() => Promise.resolve({ blocks: [heading], align: "center", text_align: "center" })} />,
    );
    await waitFor(() => expect(container.querySelector(".hb-place")).toBeTruthy());
    const place = container.querySelector(".hb-place")!;
    expect(place.getAttribute("data-align")).toBe("center");
    expect(place.getAttribute("data-text-align")).toBe("center"); // a heading carries words; the voice lands too
    expect(place.querySelector(".hb-heading")).toBeTruthy();
  });

  it("threads nothing when the answer carries no words: the board draws the DOM it always drew", async () => {
    const { container } = render(
      <BlockTag id="7f3a09bc" streaming={false} load={() => Promise.resolve({ blocks: [timeline] })} />,
    );
    await waitFor(() => expect(container.querySelector(".hb-blocks")).toBeTruthy());
    expect(container.querySelector(".hb-place")).toBeNull();
    expect(container.querySelector("[data-align], [data-text-align]")).toBeNull();
  });
});
