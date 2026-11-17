// What a checklist shows and saves.
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetBoards } from "../checklist/savedState";
import { drawWithActions as draw } from "../../core/testing";

afterEach(cleanup);
beforeEach(() => forgetBoards());

describe("checklist", () => {
  const packing = { type: "checklist", title: "Packing", items: [{ text: "Jacket", group: "Clothes" }, { text: "Socks", group: "Clothes" }, "ID card"] };
  const box = (name: string) => screen.getByRole("checkbox", { name: new RegExp(name) });

  it("ticks and unticks, counting what's done, without anywhere to save", () => {
    draw([packing]);
    expect(screen.getByText("0 of 3 done")).toBeTruthy();
    expect(screen.getByText("Clothes")).toBeTruthy();
    fireEvent.click(box("Jacket"));
    expect(box("Jacket").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("1 of 3 done")).toBeTruthy();
    fireEvent.click(box("Jacket"));
    expect(screen.getByText("0 of 3 done")).toBeTruthy();
  });

  it("shows the ticks saved for its board, and saves each change", async () => {
    const rest = vi.fn(async (_path: string, init?: { method?: string; body?: unknown }) => (init ? { ok: true } : { state: { "0": [1] } }));
    draw([packing], { rest, blockId: "7f3a09bc" });
    await waitFor(() => expect(box("Socks").getAttribute("aria-checked")).toBe("true"));
    expect(rest).toHaveBeenCalledWith("/blocks/7f3a09bc/state");
    await act(async () => { fireEvent.click(box("ID card")); });
    expect(screen.getByText("2 of 3 done")).toBeTruthy();
    await waitFor(() => expect(rest).toHaveBeenCalledWith("/blocks/7f3a09bc/state", { method: "PUT", body: { state: { "0": [1, 2] } } }));
  });

  it("keeps ticking on screen when the server can't be reached", async () => {
    const rest = vi.fn(async () => { throw new Error("offline"); });
    draw([packing], { rest, blockId: "7f3a09bc" });
    await act(async () => { fireEvent.click(box("Jacket")); });
    expect(screen.getByText("1 of 3 done")).toBeTruthy();
    expect(screen.queryByText(/offline|error/i)).toBeNull();
  });

  it("says All done when every item is ticked", () => {
    draw([{ type: "checklist", items: ["One"] }]);
    fireEvent.click(box("One"));
    expect(screen.getByText("All done")).toBeTruthy();
  });
});

describe("what a checklist says to a screen reader", () => {
  const packing = { type: "checklist", title: "Packing", numbered: true, items: [{ text: "Jacket" }, { text: "ID card" }] };

  it("is a group named by its title", () => {
    draw([packing]);
    expect(screen.getByRole("group", { name: "Packing" })).toBeTruthy();
  });

  it("names each tick by its text, not by the number drawn beside it", () => {
    draw([packing]);
    expect(screen.getByRole("checkbox", { name: "Jacket" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "ID card" })).toBeTruthy();
  });

  it("says what it is when it has no title", () => {
    draw([{ type: "checklist", items: ["Jacket"] }]);
    expect(screen.getByRole("group", { name: "Checklist" })).toBeTruthy();
  });
});
