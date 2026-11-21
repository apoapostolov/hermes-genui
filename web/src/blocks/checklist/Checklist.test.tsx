// What a checklist shows and saves.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
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

describe("checklist states", () => {
  const release = { type: "checklist", title: "Release 0.4", items: [
    { text: "Bump the manifest", state: "done" },
    { text: "Publish the wheel", state: "blocked", note: "Waiting on the index credentials" },
    { text: "Post the changelog", state: "pending", owner: "Sam" },
    { text: "Drop the old alias", state: "skipped" },
  ] };
  const box = (name: string) => screen.getByRole("checkbox", { name: new RegExp(name) });
  const described = (name: string) => {
    const ids = box(name).getAttribute("aria-describedby");
    return (ids ?? "").split(" ").filter(Boolean).map((id) => document.getElementById(id)?.textContent).join(" | ");
  };

  it("draws the state word, the owner and the note, and counts what is stuck", () => {
    draw([release]);
    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByText("Skipped")).toBeTruthy();
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getByText("Waiting on the index credentials")).toBeTruthy();
    expect(screen.getByText("1 of 4 done, 1 blocked, 1 skipped")).toBeTruthy();
    expect(screen.queryByText("Not started")).toBeNull();
    expect(described("Publish the wheel")).toBe("Blocked | Waiting on the index credentials");
    expect(described("Post the changelog")).toBe("Sam");
    expect(described("Bump the manifest")).toBe("");
  });

  it("points at the item being worked on, once, with aria-current", () => {
    draw([{ type: "checklist", items: [{ text: "Copy", state: "active" }, { text: "Verify", state: "pending" }, "Announce"] }]);
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(box("Copy").getAttribute("aria-current")).toBe("step");
    expect(box("Verify").getAttribute("aria-current")).toBeNull();
    expect(box("Announce").getAttribute("aria-current")).toBeNull();
  });

  it("points at the first item not started when none is being worked on", () => {
    draw([{ type: "checklist", items: [{ text: "Freeze", state: "done" }, { text: "Copy", state: "blocked" }, { text: "Verify", state: "pending" }] }]);
    expect(box("Verify").getAttribute("aria-current")).toBe("step");
    expect(box("Copy").getAttribute("aria-current")).toBeNull();
  });

  it("draws a state written with different case or surrounding space", () => {
    draw([{ type: "checklist", items: [{ text: "Copy", state: " IN PROGRESS " }] }]);
    expect(screen.getByText("In progress")).toBeTruthy();
  });

  it("draws a plain list exactly as before, with no state words and no pointer", () => {
    draw([{ type: "checklist", items: ["Jacket", { text: "Socks", owner: "Priya" }] }]);
    expect(screen.queryByText(/In progress|Blocked|Skipped/)).toBeNull();
    expect(screen.queryByText("Priya")).toBeTruthy();
    expect(box("Jacket").getAttribute("aria-current")).toBeNull();
  });

  it("gives each group a heading a screen reader can name", () => {
    draw([{ type: "checklist", groups: [{ label: "Clothes", items: ["Jacket"] }, { label: "Papers", items: ["ID card"] }] }]);
    expect(screen.getByRole("group", { name: "Clothes" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Papers" })).toBeTruthy();
  });

  it("keeps an ungrouped item outside the previous labelled group", () => {
    draw([{ type: "checklist", items: [{ text: "Jacket", group: "Clothes" }, "ID card"] }]);
    const group = screen.getByRole("group", { name: "Clothes" });
    expect(within(group).getByRole("checkbox", { name: /Jacket/ })).toBeTruthy();
    expect(within(group).queryByRole("checkbox", { name: /ID card/ })).toBeNull();
    expect(screen.getByRole("checkbox", { name: /ID card/ })).toBeTruthy();
  });

  it("lets a tick outrank the state, and gives the state back when it is unticked", () => {
    draw([release]);
    fireEvent.click(box("Publish the wheel"));
    expect(box("Publish the wheel").getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByText("Blocked")).toBeNull();
    expect(screen.getByText("2 of 4 done, 1 skipped")).toBeTruthy();
    fireEvent.click(box("Publish the wheel"));
    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByText("1 of 4 done, 1 blocked, 1 skipped")).toBeTruthy();
  });

  it("keeps a blocked item focusable and tappable, and saves its tick", async () => {
    const rest = vi.fn(async (_path: string, init?: { method?: string; body?: unknown }) => (init ? { ok: true } : { state: {} }));
    draw([release], { rest, blockId: "7f3a09bc" });
    await act(async () => { fireEvent.click(box("Publish the wheel")); });
    expect(box("Publish the wheel").getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(rest).toHaveBeenCalledWith("/blocks/7f3a09bc/state",
      { method: "PUT", body: { state: { "0": [0, 1] } } }));
  });
});

describe("checklist compact density", () => {
  const phases = { type: "checklist", title: "Release 0.4", density: "compact", items: [
    { text: "Bump the manifest", state: "done" },
    { text: "Publish the wheel", state: "blocked", sourceIds: ["src-1"] },
    { text: "Post the changelog", state: "active" },
    { text: "Drop the old alias", state: "skipped" },
  ] };

  it("draws only the segment strip, with one current phase", () => {
    const c = draw([phases]).container;
    expect(c.querySelectorAll(".hb-check-seg").length).toBe(4);
    expect(c.querySelectorAll(".hb-checklist-row").length).toBe(0);
    expect(c.querySelectorAll('[aria-current="step"]').length).toBe(1);
    expect(screen.getByRole("checkbox", { name: /Publish the wheel, blocked, sources src-1/ })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Post the changelog, in progress/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("1 of 4 done, 1 blocked, 1 skipped")).toBeTruthy();
  });

  it("still ticks a segment", () => {
    draw([phases]);
    const seg = screen.getByRole("checkbox", { name: /Post the changelog, in progress/ });
    fireEvent.click(seg);
    expect(seg.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("2 of 4 done, 1 blocked, 1 skipped")).toBeTruthy();
  });
});
