// Provenance: a board whose stored envelope declares `as_of` (when its data is from) or `live` (true: the figures
// update; false: a snapshot) draws a quiet footer — source · as_of · a [Live] or [Snapshot] badge. The footer
// reuses the envelope Living Boards already carries (version, updated_at, links sit beside these words in the
// same dict, and blocks_of stays the single reader of the blocks). A top-level source block on such a board is
// drawn inside the footer — not twice — on its own row of the footer's column; the `source` a chart block carries
// joins the line beside the date, deduped in draw order, while the chart keeps its own inline attribution.
// Anything that isn't a usable date string or a real boolean is ignored, and a board that declares nothing draws
// exactly what it always drew: no footer, no new nodes, source blocks where they sit.
import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Blocks } from "./Blocks";
import { readBlocksNoted } from "./readBlocks";
import { withStyles } from "./testing";
import tokens from "../styles/tokens.css?raw";
import shared from "../styles/shared.css?raw";
import sourceCss from "../blocks/source/source.css?raw";

let unstyle: () => void;
beforeAll(() => (unstyle = withStyles(tokens, shared, sourceCss)));
afterAll(() => unstyle());

const TEXT = { type: "text", text: "Hi" };
const SRC = { type: "source", text: "BLS", url: "https://www.bls.gov/ooh" };

/** A valid one-series line chart, optionally carrying its own `source` attribution. */
const chart = (source?: string) => {
  const c: any = { type: "chart", kind: "line", x: ["Q1", "Q2"], series: [{ name: "Jobs", data: [1, 2] }] };
  if (source !== undefined) c.source = source;
  return c;
};

const draw = (data: unknown) => {
  const { blocks, asOf, live } = readBlocksNoted(data);
  return render(<Blocks blocks={blocks} provenance={{ asOf, live }} />).container;
};

describe("envelope read: as_of and live ride beside the living words", () => {
  afterEach(cleanup);

  it("reads the words a stored envelope carries", () => {
    const noted = readBlocksNoted({ version: 2, as_of: "2026-11-18", live: true, blocks: [TEXT] });
    expect([noted.version, noted.asOf, noted.live]).toEqual([2, "2026-11-18", true]);
    expect(noted.blocks.length).toBe(1);
  });

  it("keeps live false — a snapshot is a word, not an absence", () => {
    expect(readBlocksNoted({ updated_at: "2026-11-18T10:00:00", as_of: "Nov 18, 14:05 UTC", live: false,
      blocks: [TEXT] }).live).toBe(false);
  });

  it("ignores anything that is not a usable date string or a real boolean", () => {
    for (const data of [
      { as_of: 5, blocks: [TEXT] },
      { as_of: "   ", blocks: [TEXT] },
      { live: "yes", blocks: [TEXT] },
      { live: 1, blocks: [TEXT] },
    ]) {
      const noted = readBlocksNoted(data);
      expect([noted.asOf, noted.live, noted.blocks.length]).toEqual([undefined, undefined, 1]);
    }
  });

  it("cuts an over-long date line to what the footer can show", () => {
    expect(readBlocksNoted({ as_of: "x".repeat(200), blocks: [TEXT] }).asOf).toBe("x".repeat(80));
  });

  it("leaves old boards as they were: plain lists and living-only envelopes give no provenance", () => {
    for (const data of [[TEXT], { version: 3, updated_at: "2026-11-18T10:00:00", blocks: [TEXT] }]) {
      const noted = readBlocksNoted(data);
      expect([noted.asOf, noted.live]).toEqual([undefined, undefined]);
    }
  });

  it("is not fooled by a block that spells its children blocks (its own fields stay the block's)", () => {
    const noted = readBlocksNoted({ type: "section", title: "T", as_of: "2026-11-18", blocks: [TEXT] });
    expect(noted.asOf).toBeUndefined();
    expect(noted.live).toBeUndefined();
  });

  it("a linked board's answer reads its provenance too — one reader for every door answer", () => {
    // what readBlocksNoted sees for GET /blocks/<id> of an envelope that says everything
    const noted = readBlocksNoted({ links: [{ id: "7f3a09bc" }], as_of: "Nov 18", live: false, blocks: [TEXT] });
    expect([noted.links, noted.asOf, noted.live]).toEqual([[{ id: "7f3a09bc" }], "Nov 18", false]);
  });
});

describe("footer render", () => {
  afterEach(cleanup);

  it("draws source · as_of · the badge, once, on a board that declares provenance", () => {
    const root = draw({ as_of: "2026-11-18", live: true, blocks: [TEXT, SRC] });
    const footer = root.querySelector(".hb-provenance")!;
    expect(footer).toBeTruthy();
    expect(footer.parentElement!.classList.contains("hb-blocks")).toBe(true);
    expect(footer.textContent).toContain("2026-11-18");
    // the source line is the existing one, absorbed into the footer rather than drawn twice
    expect(root.querySelectorAll(".hb-source").length).toBe(1);
    expect(footer.querySelector(".hb-source a")!.getAttribute("href")).toBe("https://www.bls.gov/ooh");
    // the order reads: source, then as_of, then the badge
    const line = footer.textContent!;
    expect(line.indexOf("BLS")).toBeLessThan(line.indexOf("2026-11-18"));
    expect(line.indexOf("2026-11-18")).toBeLessThan(line.indexOf("Live"));
  });

  it("the badge carries its word: Live or Snapshot, not colour alone", () => {
    const live = draw({ live: true, blocks: [TEXT] }).querySelector(".hb-provenance-badge")!;
    expect([live.textContent, live.getAttribute("data-live")]).toEqual(["Live", "live"]);
    const snap = draw({ live: false, blocks: [TEXT] }).querySelector(".hb-provenance-badge")!;
    expect([snap.textContent, snap.getAttribute("data-live")]).toEqual(["Snapshot", "snapshot"]);
  });

  it("truthfulness: a snapshot never wears the live word, and an undeclared freshness never invents one", () => {
    const snap = draw({ as_of: "2026-11-18", live: false, blocks: [SRC] });
    expect(snap.querySelector(".hb-provenance-badge")!.textContent).toBe("Snapshot");
    expect(snap.querySelector('[data-live="live"]')).toBeNull();
    expect(snap.textContent).not.toContain("Live");
    // as_of alone says no freshness at all: a date with no badge never claims the figures move
    const dated = draw({ as_of: "2026-11-18", blocks: [TEXT] });
    expect(dated.querySelector(".hb-provenance-badge")).toBeNull();
    expect(dated.querySelector(".hb-provenance")!.textContent).toBe("2026-11-18");
  });

  it("shows only the parts a board gave: live alone has no date", () => {
    const badged = draw({ live: true, blocks: [TEXT] }).querySelector(".hb-provenance")!;
    expect(badged.textContent).toBe("Live");
  });

  it("a source without a usable link still shows as text in the footer", () => {
    const footer = draw({ as_of: "2026-11-18", blocks: [{ type: "source", text: "desk notes" }] })
      .querySelector(".hb-provenance")!;
    expect(footer.querySelector(".hb-source a")).toBeNull();
    expect(footer.querySelector(".hb-source")!.textContent).toBe("desk notes");
  });

  it("absorbs only the first top-level source; a later one draws where it sits", () => {
    const root = draw({ as_of: "2026-11-18", blocks: [SRC, { type: "source", text: "field log" }] });
    expect(root.querySelectorAll(".hb-source").length).toBe(2);  // one in the footer, one in the board
    expect(root.querySelector(".hb-blocks > .hb-source")!.textContent).toBe("field log");
  });

  it("a structured source (a list, not a line) is absorbed whole, once", () => {
    const listed = { type: "source", title: "Sources", items: [{ label: "BLS" }, { label: "FRED" }] };
    const root = draw({ as_of: "2026-11-18", blocks: [TEXT, listed] });
    expect(root.querySelectorAll(".hb-source").length).toBe(1);
    expect(root.querySelector(".hb-provenance .hb-source")!.textContent).toContain("FRED");
    expect(root.querySelector(".hb-blocks > .hb-source")).toBeNull();  // the board does not also draw it
  });

  it("a board with no provenance draws exactly what it always did: no footer, no new nodes", () => {
    for (const data of [[TEXT, SRC], { version: 2, blocks: [TEXT, SRC] }]) {
      const root = draw(data);
      expect(root.querySelector(".hb-provenance")).toBeNull();
      const blocks = root.querySelector(".hb-blocks")!;
      expect(blocks.children.length).toBe(2);  // one per block, nothing added after them
      expect(root.querySelectorAll(".hb-source").length).toBe(1);
      expect(root.querySelector(".hb-source")!.textContent).toBe("BLS");  // where it always sat, not in a footer
    }
  });

  it("byte-identical: the footer is the ONLY difference — and never renders unless declared", () => {
    // a chart-only board: charts keep their inline attribution, the footer only joins words beside them, so the
    // declared drawing must equal the base drawing plus one appended node, byte for byte everywhere else.
    const blocks = readBlocksNoted([TEXT, chart("BLS")]).blocks;
    const plain = render(<Blocks blocks={blocks} />).container;
    expect(plain.innerHTML).not.toContain("hb-provenance");
    // an empty declaration (words that were junk and dropped) says nothing: the same HTML, byte for byte
    expect(render(<Blocks blocks={blocks} provenance={{}} />).container.innerHTML).toBe(plain.innerHTML);
    const said = render(<Blocks blocks={blocks} provenance={{ asOf: "2026-11-18", live: true }} />).container;
    const board = said.querySelector(".hb-blocks")!;
    const footer = board.querySelector(":scope > .hb-provenance")!;
    expect(footer.textContent).toContain("2026-11-18");  // the declared case does grow the footer …
    footer.remove();
    // … and it is the only node the declaration adds: what remains is exactly what main always drew
    expect(board.innerHTML).toBe(plain.querySelector(".hb-blocks")!.innerHTML);
    // where absorption DOES move a block (a top-level source), it moves exactly one block and adds nothing else
    const withSource = readBlocksNoted([TEXT, SRC]).blocks;
    const baseHTML = render(<Blocks blocks={withSource} />).container.innerHTML;
    const grown = render(<Blocks blocks={withSource} provenance={{ asOf: "d" }} />).container;
    const grownBoard = grown.querySelector(".hb-blocks")!;
    grownBoard.querySelector(":scope > .hb-provenance")!.remove();
    expect(grownBoard.innerHTML).not.toBe(render(<Blocks blocks={withSource} />)
      .container.querySelector(".hb-blocks")!.innerHTML);  // the source left the board flow: into the footer
    expect(grown.querySelectorAll(".hb-source").length).toBe(0);  // footer removed, source rode inside it
    expect(baseHTML).toContain("hb-source");
  });

  it("ignores junk the envelope may carry: an unusable date and a non-boolean live draw no footer", () => {
    const root = draw({ as_of: 5, live: "yes", blocks: [TEXT] });
    expect(root.querySelector(".hb-provenance")).toBeNull();
    expect(root.querySelector(".hb-blocks")!.children.length).toBe(1);
  });
});

describe("the footer keeps its own shape (the absorbed source sits on its own row)", () => {
  afterEach(cleanup);

  it("the source row is a child of the footer column, never inside the join line's flex row", () => {
    const root = draw({ as_of: "d", live: true, blocks: [SRC] });
    const source = root.querySelector(".hb-provenance .hb-source")!;
    // a place squeezed into a flex row shrink-wraps to its content; as the column's own row it fills the width
    expect(source.parentElement!.classList.contains("hb-provenance")).toBe(true);
    expect(root.querySelector(".hb-provenance-line .hb-source")).toBeNull();
    const plain = draw({ as_of: "d", blocks: [TEXT] });  // no source at all: the line still reads on its own
    expect(plain.querySelector(".hb-provenance-line")!.textContent).toBe("d");
  });

  it("the footer is drawn once, after the blocks, inside the board's own box", () => {
    const root = draw({ as_of: "d", live: true, blocks: [TEXT, SRC] });
    expect(root.querySelectorAll(".hb-provenance").length).toBe(1);
    const kids = Array.from(root.querySelector(".hb-blocks")!.children);
    expect(kids[kids.length - 1].classList.contains("hb-provenance")).toBe(true);
  });
});

describe("chart sources join the line", () => {
  afterEach(cleanup);

  it("a chart-only board reads source · as_of · the badge (reviewer probe)", () => {
    const root = draw({ as_of: "2026-11-18", live: false, blocks: [chart("BLS")] });
    expect(root.querySelector(".hb-provenance")!.textContent).toBe("BLS·2026-11-18·Snapshot");
    // the footer joins the chart's attribution, it does not replace it: the inline line stays
    expect(root.querySelector(".hb-chart-source")!.textContent).toBe("BLS");
  });

  it("several charts dedupe their sources in draw order", () => {
    const root = draw({ as_of: "d", blocks: [chart("BLS"), chart("FRED"), chart("BLS"), chart()] });
    expect(root.querySelector(".hb-provenance")!.textContent).toBe("BLS·FRED·d");
  });

  it("a chart without a source joins nothing and changes nothing", () => {
    const root = draw({ as_of: "2026-11-18", blocks: [chart()] });
    expect(root.querySelector(".hb-provenance")!.textContent).toBe("2026-11-18");
    expect(root.querySelector(".hb-chart-source")).toBeNull();
    // and a chart source alone is not provenance: no declaration, no footer, board as it always drew
    const plain = draw([chart("BLS")]);
    expect(plain.querySelector(".hb-provenance")).toBeNull();
    expect(plain.querySelector(".hb-chart-source")!.textContent).toBe("BLS");
  });

  it("a source block and chart sources join cleanly, each said once", () => {
    const same = draw({ as_of: "d", blocks: [{ type: "source", text: "BLS" }, chart("BLS")] });
    // deduped across the seams: the chart says nothing the source row hasn't already said, so the line is the date
    expect(same.querySelector(".hb-provenance .hb-source")!.textContent).toBe("BLS");
    expect(same.querySelector(".hb-provenance-line")!.textContent).toBe("d");
    expect(same.querySelectorAll(".hb-source").length).toBe(1);
    const both = draw({ as_of: "d", blocks: [{ type: "source", text: "Census" }, chart("BLS")] });
    expect(both.querySelector(".hb-provenance .hb-source")!.textContent).toBe("Census");  // its own row
    expect(both.querySelector(".hb-provenance-line")!.textContent).toBe("BLS·d");
    expect(both.querySelector(".hb-chart-source")!.textContent).toBe("BLS");  // inline stays too
  });

  it("a declared but sourceless footer still reads as_of · badge without a stray dot", () => {
    const root = draw({ as_of: "d", live: true, blocks: [chart(), TEXT] });
    expect(root.querySelector(".hb-provenance")!.textContent).toBe("d·Live");
  });
});
