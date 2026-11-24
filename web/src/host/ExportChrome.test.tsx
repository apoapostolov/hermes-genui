// The export affordance is host chrome (enhancement #6): EVERY exportable block — charts of both kinds and
// tables, at any depth the drawing shows them — carries a corner button that is ALWAYS in the DOM and in the
// tab order (invisible until lit, focusable all the time: a keyboard reader reaches a non-interactive chart's
// export without a mouse), and the board menu writes Markdown and JSON from the envelope the page already
// holds — export-time requests are ZERO, pinned here by giving the page a door that records and refuses.
// jsdom pins the acts, the DOM and the bytes it can reach; pixels, geometry, real Tab order and downloads are
// real Chrome's (tests/test_export_chrome.py).
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockActions } from "./actions";
import { BlockTag } from "./BlockTag";
import { csvOf } from "../lib/csv";

afterEach(() => {
  cleanup();
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
});

const CHART = { type: "chart", title: "Revenue", x: ["Jan", "Feb"], series: [{ name: "Ads", data: [4000, 5800] }], source: "Finance board" };
const HBAR = { type: "chart", kind: "hbar", title: "Costs", x: ["Stay", "Flights", "Local"], series: [{ name: "Cost", data: [42000, 31500, 28000] }] };
const TABLE = { type: "table", caption: "Kyoto trip", columns: ["Item", "Cost"], rows: [["Ryokan", "¥120,000"], ["Train, early", "¥3,000"]] };
const HEAD = { type: "heading", text: "Plan" };

/** A door that records every ask and then REFUSES: the feature's promise is that an export never knocks. */
function refusingDoor() {
  const calls: string[] = [];
  const rest = (path: string) => {
    calls.push(path);
    throw new Error("the door is off: exports are local");
  };
  return { rest, calls };
}

/** Every export hands its bytes through the one door the browser offers: createObjectURL. Watch it, and the
 *  named anchor every save clicks — the same seam real Chrome downloads through. */
function watchDownloads() {
  const files: { name: string; blob: Blob }[] = [];
  (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
    files.push({ name: "", blob: b });
    return "blob:x";
  };
  (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  const grab = (e: Event) => {
    const link = (e.target as HTMLElement).closest?.("a[download]");
    if (link && files.length) files[files.length - 1].name = link.getAttribute("download")!;
  };
  document.addEventListener("click", grab, true);
  afterEach(() => document.removeEventListener("click", grab, true));
  return files;
}

/** Mount a home BlockTag over a door answer in the LOCAL shape: the projection it serves (blocks) plus the
 *  stored envelope riding beside it (`stored`) — exactly what get_block answers with enhancement #6. */
async function drawnTag(
  board: unknown,
  extra: { rest?: (path: string) => Promise<unknown>; send?: (text: string) => void; fill?: () => void } = {},
) {
  const blocks = Array.isArray(board) ? board : (board as { blocks?: unknown[] }).blocks ?? [];
  const answer = { blocks, stored: board };
  render(
    <BlockActions.Provider value={{ send: extra.send ?? (() => {}), fill: extra.fill ?? (() => {}), rest: extra.rest, blockId: "7f3a09bc" }}>
      <BlockTag id="7f3a09bc" streaming={false} load={async () => answer} />
    </BlockActions.Provider>,
  );
  await waitFor(() => expect(document.querySelector(".hb-blocks")).toBeTruthy());
  const tag = document.querySelector(".hb-tag")!;
  const boardEl = tag.querySelector(".hb-blocks")!;
  const over = (el: Element) => fireEvent(el, new Event("pointermove", { bubbles: true }));
  const buttons = () => [...tag.querySelectorAll<HTMLButtonElement>(".hb-export-btn")];
  return { tag, board: boardEl, over, buttons };
}

describe("every exportable block carries its control, drawn or not", () => {
  it("top-level chart and table: buttons exist WITHOUT any pointer having reached them", async () => {
    const t = await drawnTag([HEAD, CHART, TABLE]);
    expect(t.buttons()).toHaveLength(2);                       // the heading is not exportable; nothing else dims to nothing
    const labels = t.buttons().map((b) => b.getAttribute("aria-label"));
    expect(labels[0]).toBe("Export chart “Revenue” as PNG");
    expect(labels[1]).toBe("Export table “Kyoto trip” as CSV");
    for (const b of t.buttons()) {
      expect(b.tabIndex).toBeGreaterThanOrEqual(0);            // in the tab order already: keyboard first-class
      expect(b.disabled).toBe(false);
    }
  });
  it("the DOM-drawn horizontal bars — no <svg> anywhere — are exportable too", async () => {
    const t = await drawnTag([HBAR]);
    expect(t.board.querySelector("figure.hb-chart svg")).toBeNull();   // proof it is the pure-DOM kind
    expect(t.buttons()).toHaveLength(1);
    expect(t.buttons()[0].getAttribute("aria-label")).toBe("Export chart “Costs” as PNG");
  });
  it("nested blocks: a chart and a table inside a grid each get a button", async () => {
    const grid = { type: "grid", children: [CHART, TABLE] };
    const t = await drawnTag([grid]);
    expect(t.buttons()).toHaveLength(2);
    expect(t.buttons().map((b) => b.getAttribute("aria-label"))).toEqual([
      "Export chart “Revenue” as PNG", "Export table “Kyoto trip” as CSV",
    ]);
  });
  it("a closed accordion's children are not drawn and get no button; opening it rescans", async () => {
    const section = { type: "section", title: "Picks", collapsed: true, children: [TABLE] };
    const t = await drawnTag([section]);
    expect(t.buttons()).toHaveLength(0);                        // not drawn: nothing to reach by keyboard either
    fireEvent.click(t.board.querySelector(".hb-section-toggle")!);
    await waitFor(() => expect(t.buttons()).toHaveLength(1));   // the mount changed; the walk re-pairs
  });
  it("tabs: only the panel the reader is on is offered; switching re-scans", async () => {
    const tabs = { type: "tabs", tabs: [{ label: "A", children: [TABLE] }, { label: "B", children: [CHART] }] };
    const t = await drawnTag([tabs]);
    expect(t.buttons().map((b) => b.getAttribute("aria-label"))).toEqual(["Export table “Kyoto trip” as CSV"]);
    fireEvent.click(t.board.querySelectorAll<HTMLElement>(".hb-tab")[1]!);
    await waitFor(() => expect(t.buttons().map((b) => b.getAttribute("aria-label")))
      .toEqual(["Export chart “Revenue” as PNG"]));
  });
  it("hover lights the corner under the pointer, and leaving dims it again (the look, not the reach)", async () => {
    const t = await drawnTag([HEAD, CHART, TABLE]);
    expect(t.buttons()[0].classList.contains("lit")).toBe(false);
    t.over(t.board.querySelector("figure.hb-chart")!);
    expect(t.buttons()[0].classList.contains("lit")).toBe(true);
    expect(t.buttons()[1].classList.contains("lit")).toBe(false);
    t.over(t.tag);
    expect(t.buttons()[0].classList.contains("lit")).toBe(false);
  });
});

describe("the corner tap writes bytes the page already has", () => {
  it("a table exports the STORED rows — every row, escaped — with the board's provenance comment over them", async () => {
    const files = watchDownloads();
    const t = await drawnTag([CHART, TABLE]);                 // the CHART says where its numbers came from
    t.buttons()[1].click();                                   // the table's corner
    await waitFor(() => expect(files.length).toBe(1));
    expect(files[0].name).toBe("kyoto-trip.csv");
    expect(files[0].blob.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await files[0].blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await files[0].blob.text()).toBe(
      `# Finance board\r\n${csvOf(["Item", "Cost"], [["Ryokan", "¥120,000"], ["Train, early", "¥3,000"]])}`);
  });
  it("#41's structured table travels as stored data: raw numbers, and the source words the table itself says", async () => {
    const files = watchDownloads();
    const struct = {
      type: "table", caption: "Q4",
      columns: [
        { id: "h", label: "Hotel", kind: "text" },
        { id: "p", label: "Price", kind: "currency", unit: "¥" },
        { id: "s", label: "Sources", kind: "sources" },
      ],
      rows: [
        { cells: { h: { text: "Kanra" }, p: { text: "¥42,000", value: 42000 } }, sources: [{ label: "booking" }, { label: "hotel.site" }] },
        { cells: { h: { text: "Hoshiya, JR" }, p: { text: "¥18,000", value: 18000 } }, sources: [] },
      ],
    };
    const t = await drawnTag([struct]);
    t.buttons()[0].click();
    await waitFor(() => expect(files.length).toBe(1));
    // headers are the column labels; a number travels RAW (42000, not the formatted word) — a spreadsheet is
    // for computing; the comma in a label and in the source list quotes exactly where bare text cannot hold it.
    expect(await files[0].blob.text()).toBe(
      csvOf(["Hotel", "Price", "Sources"], [["Kanra", "42000", "booking, hotel.site"], ["Hoshiya, JR", "18000", ""]]));
  });
  it("a board that says nothing of its own gets a CSV with no comment to strip", async () => {
    const files = watchDownloads();
    const t = await drawnTag([TABLE]);
    t.buttons()[0].click();
    await waitFor(() => expect(files.length).toBe(1));
    expect(await files[0].blob.text()).toBe(
      csvOf(["Item", "Cost"], [["Ryokan", "¥120,000"], ["Train, early", "¥3,000"]]));
  });
  it("nested, too: the grid's table exports its own stored data", async () => {
    const files = watchDownloads();
    const grid = { type: "grid", children: [HEAD, TABLE] };
    const t = await drawnTag([grid]);
    t.buttons()[0].click();
    await waitFor(() => expect(files.length).toBe(1));
    expect(files[0].name).toBe("kyoto-trip.csv");
  });
  it("the PNG act says so where a browser cannot paint — no fake download", async () => {
    const files = watchDownloads();
    const t = await drawnTag([CHART]);
    t.buttons()[0].click();
    await waitFor(() => expect(t.tag.querySelector(".hb-export-said")!.textContent).toBe("No picture could be exported."));
    expect(files).toEqual([]);
  });
});

describe("the board menu — Markdown and JSON from the page's own memory", () => {
  it("asks NOTHING of the door: a door that refuses everything still exports the whole board", async () => {
    const files = watchDownloads();
    const door = refusingDoor();
    const t = await drawnTag([HEAD, CHART, TABLE], { rest: door.rest });
    fireEvent.click(t.tag.querySelector(".hb-export")!);
    await waitFor(() => expect(t.tag.querySelector('[role="menu"]')).toBeTruthy());
    fireEvent.click(t.tag.querySelectorAll<HTMLElement>('[role="menuitem"]')[0]);   // Markdown
    await waitFor(() => expect(files.length).toBe(1));
    expect(files[0].name).toBe("board-7f3a09bc.md");
    expect(files[0].blob.type).toBe("text/markdown;charset=utf-8");
    // the host-side serializer twin, uncapped — the same text the chat fallback speaks for this board (the
    // corpus pins that byte for byte) — plus the provenance footer the board itself says: the chart's source.
    expect(await files[0].blob.text()).toBe(
      "**Plan**\n\n**Revenue**: Ads 4,000 → 5,800 (▲ 45%)\n\n**Kyoto trip**\n| Item | Cost |\n| --- | --- |\n"
      + "| Ryokan | ¥120,000 |\n| Train, early | ¥3,000 |\n\n---\n\nFinance board\n");
    expect(door.calls).toEqual([]);                             // ZERO asks. The promise, pinned.
  });
  it("JSON is the stored envelope, whole — the living words, unknown words and all, no second read", async () => {
    const files = watchDownloads();
    const door = refusingDoor();
    const board = { version: 2, updated_at: "2026-11-18T10:00:00+05:30", model_note: "kept verbatim", blocks: [HEAD, TABLE] };
    const t = await drawnTag(board, { rest: door.rest });
    fireEvent.click(t.tag.querySelector(".hb-export")!);
    fireEvent.click(await waitFor(() => {
      const items = t.tag.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (items.length < 2) throw new Error("menu not open");
      return items[1];
    }));
    await waitFor(() => expect(files.length).toBe(1));
    expect(files[0].name).toBe("board-7f3a09bc.json");
    expect(JSON.parse(await files[0].blob.text())).toEqual(board);
    expect(door.calls).toEqual([]);
  });
  it("Escape closes it; a click outside closes it; nothing was asked of anyone on the way", async () => {
    const door = refusingDoor();
    const t = await drawnTag([HEAD], { rest: door.rest });
    fireEvent.click(t.tag.querySelector(".hb-export")!);
    await waitFor(() => expect(t.tag.querySelector('[role="menu"]')).toBeTruthy());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(t.tag.querySelector('[role="menu"]')).toBeNull());
    fireEvent.click(t.tag.querySelector(".hb-export")!);
    await waitFor(() => expect(t.tag.querySelector('[role="menu"]')).toBeTruthy());
    fireEvent(t.board, new Event("pointerdown", { bubbles: true }));
    await waitFor(() => expect(t.tag.querySelector('[role="menu"]')).toBeNull());
    expect(door.calls).toEqual([]);
  });
});

describe("an export never costs a model turn", () => {
  it("send and fill are untouched through a CSV, a Markdown and a JSON export", async () => {
    const files = watchDownloads();
    const send = vi.fn();
    const fill = vi.fn();
    const door = refusingDoor();
    const t = await drawnTag([CHART, TABLE], { send, fill, rest: door.rest });
    t.buttons()[1].click();                                              // table CSV
    await waitFor(() => expect(files.length).toBe(1));
    fireEvent.click(t.tag.querySelector(".hb-export")!);
    const items = await waitFor(() => {
      const found = t.tag.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (found.length < 2) throw new Error("menu not open");
      return found;
    });
    fireEvent.click(items[0]);                                           // Markdown
    await waitFor(() => expect(files.length).toBe(2));
    fireEvent.click(t.tag.querySelector(".hb-export")!);
    const reopened = await waitFor(() => {
      const found = t.tag.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (found.length < 2) throw new Error("menu not open");
      return found;
    });
    fireEvent.click(reopened[1]);                                        // JSON
    await waitFor(() => expect(files.length).toBe(3));
    expect(send).not.toHaveBeenCalled();
    expect(fill).not.toHaveBeenCalled();
    expect(door.calls).toEqual([]);
  });
});

describe("the board's own DOM is none of the export's business", () => {
  it("corner buttons live OUTSIDE .hb-blocks; its bytes never change", async () => {
    const files = watchDownloads();
    const t = await drawnTag([HEAD, CHART, TABLE]);
    const before = t.board.innerHTML;
    for (const b of t.buttons()) {
      expect(b.closest(".hb-blocks")).toBeNull();                  // the layer is the tag's, never the board's
      b.click();
    }
    await waitFor(() => expect(files.length).toBe(1));             // the PNG act only said a word; the CSV wrote bytes
    expect(t.board.innerHTML).toBe(before);                        // every act ran; the board never moved
  });
});
