// Where blocks sit in the board's column — or in the cell a container gave them: a block that asks with `align` is
// placed, a board default from the stored envelope cascades to every block that didn't ask, wherever it sits, and
// the block's own word beats it. The model's cascade is the whole rule: there is no reader override anywhere.
// Placement resolves recursively: containers draw their children through the same path, so a nested block is
// placed inside its own cell and the container keeps the layout it owns. A placed block is drawn inside a .hb-place
// wrapper; left is how blocks sit already, so an unplaced board keeps the DOM exactly as it was.
// The same block also answers for how the words read (text_align) inside the blocks whose whole draw is words
// (heading, text, stat, callout); a block wrapped for placement, for its text voice, or for both, gets the one
// wrapper; a board with no ask anywhere draws the same DOM it always did.
import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import catalog from "../../../core/catalog.json";
import type { Align } from "./fields";
import { Blocks } from "./Blocks";
import { readBlocksNoted } from "./readBlocks";
import { withStyles } from "./testing";
import tokens from "../styles/tokens.css?raw";
import shared from "../styles/shared.css?raw";
import layoutCss from "../blocks/layout/layout.css?raw";
import chartCss from "../blocks/chart/chart.css?raw";
import tableCss from "../blocks/table/table.css?raw";
import calcCss from "../blocks/calculator/calculator.css?raw";
import formCss from "../blocks/form/form.css?raw";

let unstyle: () => void;
beforeAll(() => (unstyle = withStyles(tokens, shared, layoutCss, chartCss, tableCss, calcCss, formCss)));
afterAll(() => unstyle());

const draw = (data: unknown, opts: { boardAlign?: Align; boardTextAlign?: Align } = {}) => {
  const noted = readBlocksNoted(data);
  const blocks = noted.blocks;
  return render(
    <Blocks blocks={blocks} boardAlign={opts.boardAlign ?? noted.align}
      boardTextAlign={opts.boardTextAlign ?? noted.textAlign} />,
  ).container;
};

const TEXT = { type: "text", text: "Hi" };
const CALC = { type: "calculator", sliders: [{ name: "p", title: "Loan", max: 100, value: 40 }], results: [{ label: "Half", formula: "p / 2" }] };

describe("block placement", () => {
  afterEach(cleanup);

  it("leaves the board alone when nobody asks: no wrapper, blocks fill the column as they always did", () => {
    const root = draw([TEXT, CALC]);
    expect(root.querySelector(".hb-place")).toBeNull();
    const blocks = root.querySelector(".hb-blocks")!;
    expect(blocks.children.length).toBe(2);
    expect(blocks.firstElementChild!.classList.contains("hb-text")).toBe(true);
  });

  it("draws a block that asks for center inside a centered place", () => {
    const root = draw([{ ...TEXT, align: "center" }]);
    const place = root.querySelector(".hb-place")!;
    expect([place.className, place.getAttribute("data-align")]).toEqual(["hb-place hb-place-center", "center"]);
    expect(place.querySelector(".hb-text")).toBeTruthy();
  });

  it("draws a block that asks for right inside a right place", () => {
    const place = draw([{ ...CALC, align: "right" }]).querySelector(".hb-place")!;
    expect([place.getAttribute("data-align"), place.querySelector(".hb-calc") !== null]).toEqual(["right", true]);
  });

  it("asks for left the way a board already sits, so it needs no place at all", () => {
    const root = draw([{ ...TEXT, align: "left" }]);
    expect(root.querySelector(".hb-place")).toBeNull();
  });

  it("cascades the board's default to every block that didn't ask", () => {
    const root = draw({ align: "right", blocks: [TEXT, { ...CALC }] });
    const places = [...root.querySelectorAll(".hb-place")];
    expect(places.map((p) => p.getAttribute("data-align"))).toEqual(["right", "right"]);
    expect(root.querySelector(".hb-blocks")!.children.length).toBe(2); // one place per block, nothing added between
  });

  it("lets a block's own word override the board's default", () => {
    const root = draw({ align: "center", blocks: [{ ...TEXT, align: "left" }, { ...CALC, align: "right" }, CALC] });
    const places = [...root.querySelectorAll(".hb-place")];
    expect(places.map((p) => p.getAttribute("data-align"))).toEqual(["right", "center"]); // left sits unplaced; right beats center
  });

  it("is the model's cascade alone: the block's word, then the board's, then left — nothing else", () => {
    const root = draw({ align: "center", blocks: [{ ...TEXT, align: "right" }, TEXT, CALC] });
    expect([...root.querySelectorAll(".hb-place")].map((p) => p.getAttribute("data-align"))).toEqual(["right", "center", "center"]);
    expect(root.querySelectorAll("button").length).toBe(0); // no control of any kind sits on the board
  });

  it("places a container itself, and reaches its children with the same rules", () => {
    const root = draw({ align: "center", blocks: [{ type: "grid", children: [TEXT, { ...CALC, align: "right" }] }] });
    const place = root.querySelector(".hb-place")!;
    expect(place.getAttribute("data-align")).toBe("center");
    const grid = place.querySelector(".hb-grid")!;
    expect(grid.querySelectorAll(":scope > .hb-grid-cell").length).toBe(2); // the grid still owns its cells
    const cells = [...grid.children] as HTMLElement[];
    // the child that didn't ask takes the board default; the child that asked wins its own word inside its cell
    expect(cells[0].querySelector(":scope > .hb-place[data-align='center'] > .hb-text")).toBeTruthy();
    expect(cells[1].querySelector(":scope > .hb-place[data-align='right'] > .hb-calc")).toBeTruthy();
  });

  it("places nested blocks in every container shape: row, section, tabs", () => {
    const root = draw({ align: "center", blocks: [
      { type: "row", children: [TEXT, { type: "stat", label: "Seats", value: 12 }] },
      { type: "section", title: "Picks", children: [TEXT] },
      { type: "tabs", tabs: [{ label: "One", children: [{ ...TEXT, align: "right" }] }, { label: "Two", children: [{ type: "text", text: "Other" }] }] },
    ] });
    expect(root.querySelector(".hb-row > .hb-row-cell > .hb-place[data-align='center'] > .hb-text")).toBeTruthy();
    expect(root.querySelector(".hb-section-body > .hb-place[data-align='center'] > .hb-text")).toBeTruthy();
    expect(root.querySelector(".hb-tab-panel > .hb-place[data-align='right'] > .hb-text")).toBeTruthy();
  });

  it("places each block of a row drawn as a stack", () => {
    // A row holding a wide block is flattened by the reader; the row's word follows the stack.
    const root = draw([{ type: "row", align: "right", children: [TEXT, { ...CALC }] }]);
    expect([...root.querySelectorAll(".hb-place")].map((p) => p.getAttribute("data-align"))).toEqual(["right", "right"]);
  });

  it("centers one block without centering the board: one wrapper, no board voice", () => {
    // Sagar's note 1 repro, drawn straight: "center the verdict" is ONE block's ask. Only that block grows a
    // place; the board speaks no default, and no block anywhere picks up a text voice from an align ask.
    const root = draw([TEXT, { ...TEXT, text: "Verdict", align: "center" }, CALC]);
    const places = [...root.querySelectorAll(".hb-place")];
    expect(places.length).toBe(1);
    expect(places[0].getAttribute("data-align")).toBe("center");
    expect(places[0].textContent).toBe("Verdict");
    expect(root.querySelector("[data-text-align]")).toBeNull();
    expect(root.querySelector(".hb-ta-center, .hb-ta-right")).toBeNull();
  });
});

describe("placement within the column's widths", () => {
  // Behavior, not pixels: a placed card keeps the cap it had unplaced, a full-width block is not made narrower or
  // wider by being placed, and placing a board never reaches inside a container.
  afterEach(cleanup);

  const example = (kind: string) => catalog.blocks.find((b) => b.kind === kind)!.example;
  const style = (root: HTMLElement, selector: string) => getComputedStyle(root.querySelector(selector)!);

  it("keeps a centered calculator and a right-aligned form to their 720px reading width", () => {
    const root = draw([{ ...CALC, align: "center" }, { ...example("form"), align: "right" }]);
    expect(style(root, ".hb-blocks > .hb-place > .hb-calc").maxWidth).toBe("720px");
    expect(style(root, ".hb-blocks > .hb-place > .hb-form").maxWidth).toBe("720px");
  });

  it("caps a centered chart, and leaves a long line at the board's width", () => {
    cleanup();
    const root = draw([{ ...example("chart"), align: "center" }]);
    expect(style(root, ".hb-blocks > .hb-place > .hb-chart").maxWidth).toBe("720px");
    const x = Array.from({ length: 60 }, (_, i) => `d${i}`);
    const wide = draw([{ type: "chart", kind: "line", x, series: [{ data: x.map((_, i) => i) }], align: "center" }]);
    expect(style(wide, ".hb-blocks > .hb-place > .hb-chart").maxWidth).toBe("none");
  });

  it("lets a full-width table hug its columns, placed or not", () => {
    expect(style(draw([{ ...example("table"), align: "center" }]), ".hb-blocks > .hb-place > .hb-table-card").width).toBe("fit-content");
    expect(style(draw([example("table")]), ".hb-blocks > .hb-table-card").width).toBe("fit-content");
  });

  it("reaches inside a container without taking over its cells", () => {
    // (a grid with one child is drawn as just that child, so it needs two to stay a grid — as in widths.test)
    const root = draw({ align: "center", blocks: [{ type: "grid", children: [CALC, { type: "text", text: "Beside it" }] }] });
    expect(root.querySelector(".hb-blocks > .hb-place > .hb-grid")).toBeTruthy();
    // inside the cell the card fills its cell as unplaced: no top-level cap reaches into a container
    expect(style(root, ".hb-grid-cell > .hb-place > .hb-calc").maxWidth).toBe("none");
  });

  it("keeps a placed card's cap by its own cap rule, not by the place's layout", () => {
    // jsdom can't measure layout (the Chrome regression in tests/ does); what it can prove is the structure the
    // browser test pins its selectors to: the place is a block box, the capped card sits directly inside it.
    const root = draw([{ ...CALC, align: "center" }]);
    const place = root.querySelector(".hb-place")!;
    expect(place.getAttribute("class")).toBe("hb-place hb-place-center");
    expect(place.firstElementChild!.classList.contains("hb-calc")).toBe(true);
  });
});

describe("text alignment", () => {
  // How the words inside a text block read: `text_align` per block, a board default from the stored envelope,
  // and left when nobody says otherwise — the model's cascade again, exactly like placement. The voice lands on a
  // class (and a data-text-align marker) on the block's wrapper, and only for blocks whose words it can move:
  // heading, text, stat, callout. Chart, table, images, kpis, grid and the rest of the layout draw as they always did.
  afterEach(cleanup);

  const mark = (root: HTMLElement) => root.querySelector("[data-text-align]");

  it("leaves the words as they read when nobody asks: no text class anywhere", () => {
    const root = draw([TEXT, CALC]);
    expect(mark(root)).toBeNull();
    expect(root.querySelector(".hb-ta-center, .hb-ta-right")).toBeNull();
  });

  it("asks for left text the way words read anyway, so nothing is wrapped", () => {
    const root = draw([{ ...TEXT, text_align: "left" }]);
    expect(root.querySelector(".hb-place")).toBeNull();
  });

  it("keeps an align-only board byte-identical: places exist, the text voice never does", () => {
    const root = draw({ align: "center", blocks: [TEXT, CALC] });
    expect(root.querySelectorAll(".hb-place").length).toBe(2);
    expect(mark(root)).toBeNull();
    expect([...root.querySelectorAll(".hb-place")].every((p) => !p.className.includes("hb-ta"))).toBe(true);
  });

  it("centers a heading's words on the block's own ask", () => {
    const root = draw([{ type: "heading", text: "Head", text_align: "center" }]);
    const w = mark(root)!;
    expect([w.className, w.getAttribute("data-text-align")]).toEqual(["hb-place hb-ta-center", "center"]);
    expect(w.querySelector(".hb-heading")).toBeTruthy();
    expect(w.hasAttribute("data-align")).toBe(false); // the card still sits left
  });

  it("cascades the board's text default onto every block that didn't ask", () => {
    const root = draw({ text_align: "right", blocks: [
      TEXT, { type: "heading", text: "H" }, { type: "stat", label: "Seats", value: 12 },
      { type: "callout", text: "Mind the gap" },
    ] });
    expect([...root.querySelectorAll("[data-text-align]")].map((n) => n.getAttribute("data-text-align")))
      .toEqual(["right", "right", "right", "right"]);
    expect(root.querySelectorAll(".hb-callout").length).toBe(1);
  });

  it("lets a block's own text word override the board's, and left asks sit unwrapped", () => {
    const root = draw({ text_align: "center", blocks: [
      { ...TEXT, text_align: "right" }, { type: "heading", text: "H", text_align: "left" },
    ] });
    const marks = [...root.querySelectorAll("[data-text-align]")];
    expect(marks.length).toBe(1); // the left ask needs no voice of its own
    expect(marks[0].getAttribute("data-text-align")).toBe("right");
    expect(marks[0].querySelector(".hb-text")).toBeTruthy();
  });

  it("shares one wrapper between the position ask and the text voice", () => {
    const root = draw([{ type: "heading", text: "H", align: "center", text_align: "right" }]);
    const places = root.querySelectorAll(".hb-place");
    expect(places.length).toBe(1);
    expect(places[0].className).toBe("hb-place hb-place-center hb-ta-right");
    expect([places[0].getAttribute("data-align"), places[0].getAttribute("data-text-align")])
      .toEqual(["center", "right"]);
  });

  it("does not reach layout blocks: chart, table, images, kpis, grid and list draw exactly as without the ask", () => {
    const example = (kind: string) => catalog.blocks.find((b) => b.kind === kind)!.example;
    for (const kind of ["chart", "table", "images", "kpis", "grid", "list"]) {
      const asked = draw({ ...example(kind), text_align: "center" });
      expect([kind, asked.querySelector("[data-text-align]")]).toEqual([kind, null]);
      expect(asked.querySelector(".hb-ta-center, .hb-ta-right")).toBeNull();
      const plain = draw(example(kind));
      expect([kind, asked.innerHTML]).toEqual([kind, plain.innerHTML]);
    }
  });

  it("reaches nested text blocks with the same rules: the child's word inside the board's", () => {
    const root = draw({ text_align: "right", blocks: [
      { type: "grid", children: [{ type: "heading", text: "H", text_align: "center" }, TEXT] },
    ] });
    const cells = [...root.querySelectorAll(".hb-grid-cell")];
    expect(cells[0].querySelector(":scope > .hb-place[data-text-align='center'] > .hb-heading")).toBeTruthy();
    expect(cells[1].querySelector(":scope > .hb-place[data-text-align='right'] > .hb-text")).toBeTruthy();
  });

  it("carries a flattened row's text word onto the blocks drawn in its place", () => {
    const root = draw([{ type: "row", text_align: "center", children: [TEXT, { ...CALC }] }]);
    const marks = [...root.querySelectorAll("[data-text-align]")];
    expect(marks.length).toBe(1); // the text word belongs to the prose; a calculator keeps its own layout
    expect(marks[0].querySelector(".hb-text")).toBeTruthy();
  });
});
