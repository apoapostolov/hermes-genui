import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import catalog from "../../../core/catalog.json";
import { Blocks } from "../core/Blocks";
import { readBlocks } from "../core/readBlocks";
import { withStyles } from "../core/testing";
import tokens from "../styles/tokens.css?raw";
import shared from "../styles/shared.css?raw";
import calculator from "../blocks/calculator/calculator.css?raw";
import blockTag from "./blockTag.css?raw";
import { BlockActions } from "./actions";
import { BlockTag } from "./BlockTag";

afterEach(cleanup);

const timeline = catalog.blocks.find((b) => b.kind === "timeline")!.example;

// Shared shapes for the expand suite below (the BlockTag describe keeps its own locals untouched).
const stored = (blocks: unknown[], envelope: Record<string, unknown> = {}) => ({ ...envelope, blocks });
const calc = {
  type: "calculator", title: "Loan",
  inputs: [{ id: "p", label: "Principal", value: 40, min: 0, max: 100, step: 1 }],
  outputs: [{ label: "Half", formula: "p / 2" }],
};
const form = {
  type: "form", id: "trip", title: "Weekend",
  fields: [{ id: "note", kind: "text", label: "Note" }],
};
const photo = { type: "images", images: [{ url: "https://a.example/x.jpg", caption: "Alfama" }] };

const drawn = async (blocks: unknown[], envelope: Record<string, unknown> = {}) => {
  const view = render(<BlockTag id="7f3a09bc" streaming={false} load={async () => stored(blocks, envelope)} />);
  const button = await screen.findByRole("button", { name: "Expand board" });
  await waitFor(() => expect(view.container.querySelector(".hb-blocks")).toBeTruthy());
  return { ...view, button };
};
const openExpanded = async (blocks: unknown[], envelope: Record<string, unknown> = {}) => {
  const view = await drawn(blocks, envelope);
  fireEvent.click(view.button);
  await waitFor(() => expect(document.querySelector(".hb-board-overlay")).toBeTruthy());
  return view;
};

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

describe("BlockTag expand / full-screen", () => {
  // The images full-size overlay pattern (blocks/images/Images.tsx) raised to a whole board, with one honest
  // correction: a stateless photo may be re-drawn at full size, a board may not. Its blocks carry live state —
  // a calculator's sliders, an unsent form draft, a lit flow — so expanding MOVES the one drawn instance into
  // the dialog instead of instantiating a second one. The host wrapper is a plain block container at rest (the
  // inline board keeps drawing its byte-identical .hb-blocks under it) and becomes the fixed dialog itself.
  // Escape and the close control return to the inline view; focus is trapped inside while open and handed back
  // on close. The trap wraps Tab on the ELIGIBLE tabbable controls: disabled (own or via a disabled fieldset),
  // negative-tabindex and hidden controls are never stops and never leak focus out of the dialog.

  it("grows an expand control on every drawn board — a real button, outside the blocks", async () => {
    const { container, button } = await drawn([{ type: "heading", text: "Quarterly" }]);
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.classList.contains("hb-expand")).toBe(true);
    expect(document.querySelector(".hb-blocks .hb-expand")).toBeNull();  // the control never sits inside the board
    expect(container.querySelector(".hb-tag > .hb-board-host > .hb-blocks")).toBeTruthy();  // the host owns the wrapper
    expect(container.querySelector(".hb-board-host")!.hasAttribute("role")).toBe(false);    // at rest: a plain container
  });

  it("draws no expand control while streaming or when the board is not there", async () => {
    render(<BlockTag id="7f3a09bc" streaming={true} load={() => Promise.resolve({ blocks: [] })} />);
    expect(screen.queryByRole("button", { name: "Expand board" })).toBeNull();
    const failed = render(<BlockTag id="7f3a09bc" streaming={false} load={() => Promise.reject(new Error("404"))} />);
    await waitFor(() => expect(failed.container.innerHTML).toBe(""));
    expect(screen.queryByRole("button", { name: "Expand board" })).toBeNull();
  });

  it("leaves the inline board byte-identical when nothing is expanded", async () => {
    const blocks = [{ type: "heading", text: "Quarterly" }, calc, { type: "text", text: "Notes" }];
    const { container } = await drawn(blocks);
    const inline = container.querySelector(".hb-blocks")!.outerHTML;
    cleanup();
    const bare = render(<Blocks blocks={readBlocks(blocks)} />).container;
    expect(inline).toBe(bare.innerHTML);  // the whole .hb-blocks element: not one byte of markup changes
  });

  it("expands the one board instance into the dialog — the same element, never a copy", async () => {
    const { container, button } = await drawn([{ type: "heading", text: "Quarterly" }]);
    const board = container.querySelector(".hb-blocks")!;
    fireEvent.click(button);
    const dialog = document.querySelector<HTMLElement>(".hb-board-overlay")!;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Expanded board");
    expect(dialog.querySelector(".hb-blocks")).toBe(board);               // lifted in, not re-instantiated
    expect(document.querySelectorAll(".hb-blocks").length).toBe(1);      // the board is drawn once, ever
    expect(dialog.firstElementChild!.classList.contains("hb-overlay-close")).toBe(true);
    expect(screen.getAllByText("Quarterly").length).toBe(1);             // inline and expanded are ONE board
  });

  it("carries a calculator across open, close and reopen in both directions", async () => {
    const { container, button } = await drawn([calc]);
    const slider = container.querySelector<HTMLInputElement>(".hb-calc input")!;
    fireEvent.change(slider, { target: { value: "70" } });               // the reviewer probe: 40 moved to 70
    fireEvent.click(button);
    const shown = document.querySelector<HTMLInputElement>(".hb-board-overlay .hb-calc input")!;
    expect(shown).toBe(slider);                                          // the same control, not a second draw
    expect(shown.value).toBe("70");                                      // the dialog shows live state, not 40
    fireEvent.change(shown, { target: { value: "90" } });                // edit while expanded…
    fireEvent.click(document.querySelector(".hb-overlay-close")!);
    expect(slider.value).toBe("90");                                     // …and it returns to the inline view
    fireEvent.click(button);
    expect(document.querySelector<HTMLInputElement>(".hb-board-overlay .hb-calc input")!.value).toBe("90");  // survives a reopen
  });

  it("carries an unsent form draft across the same round trip", async () => {
    const { container, button } = await drawn([form]);
    const field = container.querySelector<HTMLInputElement>(".hb-input")!;
    fireEvent.change(field, { target: { value: "Cottage, Friday" } });   // typed, never sent
    fireEvent.click(button);
    expect(document.querySelector(".hb-board-overlay .hb-input")).toBe(field);
    expect(field.value).toBe("Cottage, Friday");
    fireEvent.change(field, { target: { value: "Cabin, Sunday" } });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(field.value).toBe("Cabin, Sunday");                           // the draft came back with the board
  });

  it("the close control returns to the inline view and hands focus back to the expand button", async () => {
    const { button } = await openExpanded([{ type: "heading", text: "Quarterly" }]);
    fireEvent.click(document.querySelector(".hb-overlay-close")!);
    expect(document.querySelector(".hb-board-overlay")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("Escape closes the expanded board and returns focus", async () => {
    const { button } = await openExpanded([{ type: "heading", text: "Quarterly" }]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".hb-board-overlay")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("focus lands in the dialog on open and Tab cannot leave it", async () => {
    const { button } = await openExpanded([calc]);
    const close = document.querySelector(".hb-overlay-close")!;
    expect(document.activeElement).toBe(close);                          // open: focus starts inside the dialog
    const items = [...document.querySelectorAll<HTMLElement>(
      ".hb-board-overlay button, .hb-board-overlay input, .hb-board-overlay [href], " +
      ".hb-board-overlay select, .hb-board-overlay textarea, .hb-board-overlay [tabindex]:not([tabindex='-1'])")];
    expect(items.length).toBeGreaterThan(1);                             // a slider lives in the expanded board
    const focusedLast = items[items.length - 1];
    focusedLast.focus();
    fireEvent.keyDown(window, { key: "Tab" });                           // from the last item: wraps to the first
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });           // from the first: wraps to the last
    expect(document.activeElement).toBe(focusedLast);
    expect(button).not.toBe(document.activeElement);                     // focus never escaped to the inline button
  });

  it("the trap wraps on the real ends when the last control is disabled — the reviewer probe", async () => {
    await openExpanded([calc]);
    const dialog = document.querySelector(".hb-board-overlay")!;
    const dead = document.createElement("button");                       // a Steps/Layers final Next, spent
    dead.disabled = true;
    dialog.appendChild(dead);                                            // dead last in tab order
    const close = document.querySelector<HTMLElement>(".hb-overlay-close")!;
    const slider = document.querySelector<HTMLElement>(".hb-board-overlay .hb-calc input")!;
    expect(document.activeElement).toBe(close);                          // open landed on the first control
    const back = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(back);                                          // Shift+Tab from the first control
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(slider);                         // wrapped to the last ELIGIBLE, not stuck
    const fwd = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    window.dispatchEvent(fwd);                                           // Tab from that real last control
    expect(fwd.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);                          // wraps — native would skip the dead end and leave
  });

  it("the trap skips disabled, negative-tabindex and hidden controls and stops only on eligible ones", async () => {
    await openExpanded([calc]);
    const dialog = document.querySelector(".hb-board-overlay")!;
    const add = <T extends HTMLElement>(el: T): T => { dialog.appendChild(el); return el; };
    const neg = add(document.createElement("input"));
    neg.setAttribute("type", "text");
    neg.setAttribute("tabindex", "-1");                                  // reachable only programmatically
    const hid = add(document.createElement("button"));
    hid.hidden = true;                                                   // gone from every tab order
    const held = add(document.createElement("fieldset"));
    held.disabled = true;
    const send = document.createElement("button");
    send.textContent = "Send";
    held.appendChild(send);                                              // a form Send behind a disabled fieldset
    const realLast = add(document.createElement("button"));
    realLast.textContent = "Real last";
    const close = document.querySelector<HTMLElement>(".hb-overlay-close")!;
    const slider = document.querySelector<HTMLElement>(".hb-board-overlay .hb-calc input")!;
    close.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(slider);                         // first: the close control, then the slider
    fireEvent.keyDown(window, { key: "Tab" });                           // skipping negative, hidden and held
    expect(document.activeElement).toBe(realLast);
    fireEvent.keyDown(window, { key: "Tab" });                           // and wrapping at that real end
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(realLast);                       // reverse: back over the same real list
  });

  it("clicking the scrim closes, clicking the board itself does not", async () => {
    const { container } = await openExpanded([{ type: "heading", text: "Quarterly" }]);
    fireEvent.click(container.querySelector(".hb-blocks")!);             // on the panel: stays open
    expect(document.querySelector(".hb-board-overlay")).toBeTruthy();
    fireEvent.click(document.querySelector(".hb-heading")!);             // inside the board: stays open
    expect(document.querySelector(".hb-board-overlay")).toBeTruthy();
    fireEvent.click(document.querySelector(".hb-board-overlay")!);       // the scrim ring closes
    expect(document.querySelector(".hb-board-overlay")).toBeNull();
  });

  it("a pointer of the same address — a chip, not a board — draws no expand control", async () => {
    // Living Boards (#55): one address draws ONE live view; every later tag is a pointer. The expand control
    // belongs to the drawn board; a pointer has no board to move and must stay exactly the quiet chip it is.
    const id = "c0ffee0d";
    const load = async () => stored([{ type: "heading", text: "Portfolio" }]);
    const home = render(
      <BlockActions.Provider value={{ send: async () => "nowhere", fill: () => {}, sessionScope: "expand-pointer" }}>
        <BlockTag id={id} streaming={false} load={load} />
      </BlockActions.Provider>,
    );
    await waitFor(() => expect(home.container.querySelector(".hb-blocks")).toBeTruthy());
    const pointer = render(
      <BlockActions.Provider value={{ send: async () => "nowhere", fill: () => {}, sessionScope: "expand-pointer" }}>
        <BlockTag id={id} streaming={false} load={load} />
      </BlockActions.Provider>,
    );
    await waitFor(() => expect(pointer.container.querySelector(".hb-live-pointer")).toBeTruthy());
    expect(pointer.container.querySelector(".hb-expand")).toBeNull();    // the pointer grows no control
    expect(home.container.querySelector(".hb-expand")).toBeTruthy();     // the live view keeps its one
  });

  it("the living row stays with the live view; the dialog is the board", async () => {
    const { container } = await openExpanded([{ type: "heading", text: "Portfolio" }],
      { version: 2, updated_at: "2026-11-20T09:00:00+00:00" });
    expect(container.querySelector(".hb-live")).toBeTruthy();            // the row keeps speaking beside the board
    expect(document.querySelector(".hb-board-overlay .hb-live")).toBeNull();  // the dialog carries the board, not the address row
    const dialog = document.querySelector(".hb-board-overlay")!;
    expect(dialog.querySelectorAll(".hb-blocks").length).toBe(1);         // one board, moved in, never copied
  });

  it("Escape answers the photo layer first while the board stays expanded", async () => {
    await openExpanded([photo]);
    fireEvent.click(document.querySelector(".hb-photo-open")!);          // open a photo inside the dialog
    await waitFor(() => expect(document.querySelector(".hb-photo-overlay")).toBeTruthy());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".hb-photo-overlay")).toBeNull();       // the photo closes first
    expect(document.querySelector(".hb-board-overlay")).toBeTruthy();      // the board keeps the ask
  });
});

describe("BlockTag expand width semantics", () => {
  // jsdom cannot lay out, but it does resolve the cascade: the board keeps the 1100px reading cap inline, and
  // the ONE shipped dialog rule opens that same element — and only its cap — to the wider container while every
  // .hb-blocks > X cap (the calculator's 720px, the hugging table) stays the board's own rule. Real widths are
  // measured in Chrome by tests/test_expand_fullscreen.py.
  let unstyle: () => void;
  beforeAll(() => (unstyle = withStyles(tokens, shared, blockTag, calculator)));
  afterAll(() => unstyle());

  it("lifts the reading cap on the very element the dialog opens, and puts it back on close", async () => {
    const { container, button } = await drawn([{ type: "heading", text: "Quarterly" }, calc]);
    const board = container.querySelector(".hb-blocks")!;
    const card = container.querySelector(".hb-calc")!;
    expect(getComputedStyle(board).maxWidth).toBe("1100px");             // inline: the cap stands
    fireEvent.click(button);
    expect(getComputedStyle(board).maxWidth).toBe("none");               // expanded: the same node rides the wider column
    expect(getComputedStyle(card).maxWidth).toBe("720px");               // cards keep their caps when expanded
    fireEvent.keyDown(window, { key: "Escape" });
    expect(getComputedStyle(board).maxWidth).toBe("1100px");             // closed: the cap returns with the inline view
    expect(getComputedStyle(card).maxWidth).toBe("720px");               // and the cards never moved
  });
});

describe("the export chrome is the only control a board grows", () => {
  // enhancement #6: the tag gains a board menu and a corner per exportable chart/table — view acts, never
  // placement or composer asks. Everything the chrome adds lives OUTSIDE .hb-blocks; the drawing itself is
  // none of its business (ExportChrome.test.tsx pins the bytes and the acts).
  it("every host button at rest is an export control", async () => {
    const chart = { type: "chart", title: "T", x: ["a"], series: [{ name: "s", data: [1, 2] }] };
    render(<BlockTag id="7f3a09bc" streaming={false} load={async () => ({ blocks: [chart], stored: [chart] })} />);
    await waitFor(() => expect(document.querySelector(".hb-blocks")).toBeTruthy());
    const tag = document.querySelector(".hb-tag")!;
    const buttons = [...tag.querySelectorAll("button")];
    expect(buttons.length).toBe(2);                       // the menu + this chart's corner
    for (const b of buttons) {
      expect(b.classList.contains("hb-export") || b.classList.contains("hb-export-btn")).toBe(true);
    }
    expect(document.querySelector(".hb-blocks button")).toBeNull();   // nothing inside the drawing
  });
});
