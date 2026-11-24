// Review round 2 (offer #3): refreshing the source data behind a selected table must never destroy it,
// never re-point a tick at a different row, and never let stale picks reach the chat. The selection is
// tied to the ROW (its data), not to a seat in the array: ticks survive refreshes that keep the data
// (identical, reordered, or with other rows removed) and are forgotten when the picked row itself is
// gone or replaced. DashboardView periodically redraws live boards while keeping the block tree, so
// this is a real path, exercised here through the REAL composer seam (no send mock) and the real
// Blocks/readBlocks pipeline, rerendering the same drawn board with new data — exactly what a refresh
// does to the shipped component. Filter and sort behavior stays pinned too.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readBlocks } from "../../core/readBlocks";
import { Blocks } from "../../core/Blocks";
import { BlockActions, composerActions, type Composer } from "../../host/actions";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const A = ["Pixel 10a", "₹44,999"];
const B = ["Nothing 4", "₹39,999"];
const C = ["Galaxy A56", "₹42,999"];
const table = (rows: string[][]) => [
  { type: "table", caption: "Phones", columns: ["Phone", "Price"], rows, interactive: true },
];

function fakeComposer() {
  return {
    submit: vi.fn((_session: string | null, _text: string) => true),
    insertText: vi.fn(async () => true),
    focus: vi.fn(),
  } as unknown as Composer & { submit: ReturnType<typeof vi.fn>; insertText: ReturnType<typeof vi.fn> };
}

/** The board drawn through the real seam, with a redraw that rerenders the SAME tree with new data —
 *  React keeps the table's component state across it, exactly like DashboardView's periodic reload. */
function drawLive(rows: string[][]) {
  const composer = fakeComposer();
  const actions = composerActions(composer);
  const tree = (r: string[][]) => (
    <BlockActions.Provider value={{ send: actions.send, fill: actions.fill }}>
      <Blocks blocks={readBlocks(table(r))} />
    </BlockActions.Provider>
  );
  const view = render(tree(rows));
  return { view, composer, redraw: (r: string[][]) => view.rerender(tree(r)) };
}

const pill = () => screen.getByRole("button", { name: "Send selected rows as context" });
const tick = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name: `Select row ${name}` }));
const tickedNames = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map(
    (b) => b.getAttribute("aria-label")!.replace("Select row ", ""),
  );
const tap = async () => {
  await act(async () => {
    fireEvent.click(pill());
  });
};

describe("a removed row cannot destroy the table or send from beyond the grave", () => {
  it("the reviewer's repro: rows A,B, tick B, refresh to A only — the drawing lives, the pick is gone", () => {
    const { composer, redraw, view } = drawLive([A, B]);
    tick("Nothing 4");
    redraw([A]);
    expect(view.container.querySelector(".hb-block-failed")).toBeNull(); // no error boundary
    const box = screen.getByRole("checkbox", { name: "Select row Pixel 10a" }) as HTMLInputElement;
    expect(box.checked).toBe(false); // no phantom selection
    expect(pill().hasAttribute("disabled")).toBe(true); // nothing armed, nothing claimable
    fireEvent.click(pill()); // a click on the disarmed pill is a no-op
    expect(composer.submit).not.toHaveBeenCalled();
  });

  it("a pick whose row vanished sends nothing and promises nothing in its title", async () => {
    const { composer, redraw, view } = drawLive([A, B, C]);
    tick("Galaxy A56");
    redraw([A, B]); // the ticked row was removed upstream
    expect(tickedNames(view.container)).toHaveLength(0);
    expect(pill().hasAttribute("disabled")).toBe(true);
    expect(pill().getAttribute("title")).toBeNull(); // stale data is not previewed either
    await tap();
    expect(composer.submit).not.toHaveBeenCalled();
    expect(composer.insertText).not.toHaveBeenCalled();
  });

  it("a surviving ticked row keeps its selection even when its seat shifts", async () => {
    const { composer, redraw, view } = drawLive([A, B, C]);
    tick("Nothing 4");
    redraw([B, C]); // A was removed; Nothing 4 is now the FIRST row
    expect(tickedNames(view.container)).toEqual(["Nothing 4"]);
    await tap();
    expect(composer.submit).toHaveBeenCalledTimes(1);
    expect(composer.submit.mock.calls[0][1]).toBe(
      "Phones:\nPhone | Price\nNothing 4 | ₹39,999",
    ); // ONLY the row the reader actually ticked
  });
});

describe("a removed pick is DISCARDED, not hidden: reappearing data is a new entry (review round 3)", () => {
  // Round 2 only hid vanished keys while their rows were absent: `picked` kept them forever, so a
  // board that lost a row and later grew the same data back silently re-ticked it and re-armed the
  // pill — a selection the reader no longer holds, ready to send. Removal must be real removal.
  it("the reviewer's repro: tick B, refresh to A, refresh to A,B — the old pick does not come back", async () => {
    const { composer, redraw, view } = drawLive([A, B]);
    tick("Nothing 4");
    redraw([A]); // B was really removed from the source
    redraw([A, B]); // and identical data reappears — as a NEW row, not the reader's old pick
    expect(view.container.querySelector(".hb-block-failed")).toBeNull(); // drawing lives
    expect(tickedNames(view.container)).toEqual([]); // round 2 FAILED here: ['Nothing 4'] resurrected
    expect(pill().hasAttribute("disabled")).toBe(true); // nothing re-armed
    expect(pill().getAttribute("title")).toBeNull(); // nothing re-claimed in the preview
    await tap();
    expect(composer.submit).not.toHaveBeenCalled(); // and nothing can be sent from beyond the grave
    expect(composer.insertText).not.toHaveBeenCalled();
  });

  it("remove → replace → reappear: the key died at removal, so the returning row starts unselected", async () => {
    const { composer, redraw, view } = drawLive([A, B, C]);
    tick("Nothing 4");
    redraw([A, ["Galaxy S26", "₹71,999"], C]); // seat 1 holds different data — the pick is gone
    redraw([A, B, C]); // B comes back after the replacement left
    expect(tickedNames(view.container)).toEqual([]);
    expect(pill().hasAttribute("disabled")).toBe(true);
    await tap();
    expect(composer.submit).not.toHaveBeenCalled();
  });

  it("a row a filter merely HIDES is not removed: its pick rides through and still sends", async () => {
    const { composer, redraw, view } = drawLive([A, B, C]);
    tick("Nothing 4");
    const filter = screen.getByRole("searchbox", { name: "Filter rows" });
    fireEvent.change(filter, { target: { value: "pixel" } }); // B leaves the VIEW, not the board
    redraw([A, B, C]); // a reload underneath the active filter
    fireEvent.change(filter, { target: { value: "" } });
    expect(tickedNames(view.container)).toEqual(["Nothing 4"]); // hiding is not removal
    await tap();
    expect(composer.submit.mock.calls[0][1]).toBe(
      "Phones:\nPhone | Price\nNothing 4 | ₹39,999",
    );
  });

  it("three consecutive refreshes that keep the data keep every pick (unchanged, reorder, unchanged)", async () => {
    const { composer, redraw } = drawLive([A, B, C]);
    tick("Pixel 10a");
    tick("Nothing 4");
    redraw([A, B, C]); // unchanged
    redraw([C, A, B]); // reordered
    redraw([A, C, B]); // reordered again
    expect(pill().hasAttribute("disabled")).toBe(false);
    await tap();
    expect(composer.submit.mock.calls[0][1]).toBe(
      "Phones:\nPhone | Price\nPixel 10a | ₹44,999\nNothing 4 | ₹39,999",
    ); // the same whole selection, in board order
  });
});

describe("a refreshed table ties the tick to the row, not to the index", () => {
  it("refreshing identical data keeps every tick and sends the same whole selection", async () => {
    const { composer, redraw, view } = drawLive([A, B, C]);
    tick("Pixel 10a");
    tick("Galaxy A56");
    redraw([A, B, C]); // a periodic reload of unchanged content
    expect(tickedNames(view.container)).toEqual(["Pixel 10a", "Galaxy A56"]);
    await tap();
    expect(composer.submit.mock.calls[0][1]).toBe(
      "Phones:\nPhone | Price\nPixel 10a | ₹44,999\nGalaxy A56 | ₹42,999",
    );
  });

  it("a reorder carries the selection along with the row — never onto whatever took its seat", async () => {
    const { composer, redraw, view } = drawLive([A, B, C]);
    tick("Nothing 4");
    redraw([C, A, B]); // same three rows, different order
    expect(tickedNames(view.container)).toEqual(["Nothing 4"]); // selection rode the DATA, not seat 1
    await tap();
    const sent = composer.submit.mock.calls[0][1] as string;
    expect(sent).toBe("Phones:\nPhone | Price\nNothing 4 | ₹39,999");
    expect(sent).not.toContain("Galaxy A56");
    expect(sent).not.toContain("Pixel 10a");
  });

  it("a replaced row does not inherit the previous row's tick", async () => {
    const { composer, redraw, view } = drawLive([A, B]);
    tick("Nothing 4");
    redraw([A, ["Galaxy S26", "₹71,999"]]); // same length, seat 1 now holds different data
    expect(tickedNames(view.container)).toHaveLength(0); // the old pick was forgotten, not moved
    expect(pill().hasAttribute("disabled")).toBe(true);
    await tap();
    expect(composer.submit).not.toHaveBeenCalled(); // and the different data was never sent
  });

  it("identical rows are one selection: they tick together and send in board order", async () => {
    const { composer, view } = drawLive([A, B, A]); // the same data in two seats
    fireEvent.click(view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0]);
    expect(tickedNames(view.container)).toEqual(["Pixel 10a", "Pixel 10a"]);
    await tap();
    expect(composer.submit.mock.calls[0][1]).toBe(
      "Phones:\nPhone | Price\nPixel 10a | ₹44,999\nPixel 10a | ₹44,999",
    );
  });

  it("filtering after a refresh still narrows rows, still keeps the surviving tick, still sends it", () => {
    const { redraw, view } = drawLive([A, B, C]);
    tick("Nothing 4");
    redraw([A, B, C]); // reload of unchanged data
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "galaxy" } });
    const rows = [...view.container.querySelectorAll("tbody tr td.hb-first")];
    expect(rows.map((td) => td.textContent)).toEqual(["Galaxy A56"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "" } });
    expect(tickedNames(view.container)).toEqual(["Nothing 4"]); // the query never dropped the pick
    fireEvent.click(screen.getByRole("button", { name: /Price/ })); // sort the survivors as always
    expect([...view.container.querySelectorAll("tbody tr td.hb-first")].map((td) => td.textContent)).toEqual([
      "Nothing 4", "Galaxy A56", "Pixel 10a",
    ]);
    expect(tickedNames(view.container)).toEqual(["Nothing 4"]); // and sorting never dropped it either
  });
});
