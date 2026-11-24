// The walk's PAIRING contract, pinned at the seam where the round-2 finding lives: `scan` pairs the read
// blocks with the drawn elements. Two duties hold at once — a re-pair that changed NOTHING must not churn
// (loop avoidance: the hook's stored argument is a fresh object each render, so any scan whose commit did
// fire would re-render, re-scan, and re-commit forever), while a re-pair where the DATA moved must refresh
// — even when the drawing's element and its coordinates never moved, the exact state a Living Boards carry
// hands over: the survivor is reconciled onto the very element already mounted. The reviewer's isolated
// reproduction (render "old", re-render the SAME DOM at the SAME position with "new", export — and get
// "old") is this file's first case, run through the real hook over a fixture the test controls. The same
// act through the REAL BlockTag machinery is pinned in BlockTag.living.test.tsx and, in real Chrome, in
// tests/test_export_chrome.py: there the identity system honestly REMOUNTS a block whose own words moved,
// so those flows refresh by element change too — this harness holds the element still to pin the predicate
// itself: data currency is enforced on the DATA, not only on the geometry.
import { act, Profiler } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../registry";
import { useExportChrome } from "./ExportChrome";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
});

const TABLE = (value: string): Block =>
  ({ type: "table", caption: "Lodging, compared", columns: ["Item", "Cost"], rows: [[value]] }) as unknown as Block;
const CHART = (title: string): Block =>
  ({ type: "chart", spec: { kind: "bar", title, x: ["Day 1"], series: [{ name: "Cost", data: [1] }] } }) as unknown as Block;

/** The fixture the walk walks: a host box whose .hb-blocks carries ONE div — the element the reviewer's
 *  repro keeps identical across the swap. React never draws the board here: the test moves the data, the
 *  drawing stands still — exactly the state the pairing contract must survive. */
function fixture(): HTMLElement {
  const host = document.createElement("div");
  host.className = "hb-host";
  const board = document.createElement("div");
  board.className = "hb-blocks";
  board.append(document.createElement("div"));
  host.append(board);
  document.body.append(host);
  return board.firstElementChild as HTMLElement;
}

function Harness({ blocks }: { blocks: Block[] }) {
  const chrome = useExportChrome({
    blocks,
    stored: { blocks },
    getBoard: () => document.querySelector<HTMLElement>(".hb-blocks"),
    getHost: () => document.querySelector<HTMLElement>(".hb-host"),
  });
  return <div id="chrome-root">{chrome.layer}</div>;
}

const corners = () => [...document.querySelectorAll<HTMLButtonElement>(".hb-export-btn")];

function watchDownloads() {
  const files: { name: string; blob: Blob }[] = [];
  (URL as { createObjectURL?: unknown }).createObjectURL = (b: Blob) => {
    files.push({ name: "", blob: b });
    return "blob:x";
  };
  (URL as { revokeObjectURL?: unknown }).revokeObjectURL = () => {};
  const grab = (e: Event) => {
    const link = (e.target as HTMLElement).closest?.("a[download]");
    if (link && files.length) files[files.length - 1].name = link.getAttribute("download")!;
  };
  document.addEventListener("click", grab, true);
  return files;
}

describe("the pairing keeps the DATA current, not only the geometry", () => {
  it("same element, same position, new block: the corner exports the NEW bytes (the reviewer's repro)", async () => {
    const files = watchDownloads();
    const drawnCell = fixture();
    const view = render(<Harness blocks={[TABLE("old")]} />);
    await waitFor(() => expect(corners().length).toBe(1));
    const cornerEl = corners()[0];
    corners()[0].click();
    await waitFor(() => expect(files.length).toBe(1));
    expect(await files[0].blob.text()).toContain("old");

    // The swap: a newer read of the SAME slot. The drawn element is the very node, every rect is the same
    // (jsdom measures zero; the contract does not depend on that) — only the block moved. Same element +
    // same coordinates is NOT "unchanged" when the data is.
    act(() => { view.rerender(<Harness blocks={[TABLE("new")]} />); });
    corners()[0].click();
    await waitFor(() => expect(files.length).toBe(2));
    expect(corners()[0]).toBe(cornerEl);          // the corner itself never left the DOM
    expect(document.querySelector(".hb-blocks")!.firstElementChild).toBe(drawnCell);
    expect(await files[1].blob.text()).toContain("new");
    expect(await files[1].blob.text()).not.toContain("old");
  });

  it("a chart's name refreshes the same way: the accessible label speaks the CURRENT spec", async () => {
    fixture();
    const view = render(<Harness blocks={[CHART("Cost by day · first draft")]} />);
    await waitFor(() => expect(corners().length).toBe(1));
    expect(corners()[0].getAttribute("aria-label")).toBe("Export chart “Cost by day · first draft” as PNG");
    view.rerender(<Harness blocks={[CHART("Cost by day · current")]} />);
    await waitFor(() =>
      expect(corners()[0].getAttribute("aria-label")).toBe("Export chart “Cost by day · current” as PNG"));
  });

  it("loop avoidance stands: a re-pair that changed nothing commits nothing; the swap commits once, then holds", async () => {
    fixture();
    const onRender = vi.fn();
    const oldBlock = TABLE("old");
    const view = render(
      <Profiler id="chrome" onRender={onRender}>
        <Harness blocks={[oldBlock]} />
      </Profiler>,
    );
    await waitFor(() => expect(corners().length).toBe(1));
    const settled = onRender.mock.calls.length;

    // Scans WITHOUT a data move — resizes, scrolls — re-pair the same block objects with the same element
    // at the same rects: nothing may commit (had the pairing churned, the stored-identity layout effect
    // would re-scan on every render and the loop would never end).
    act(() => {
      for (let i = 0; i < 5; i += 1) {
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("scroll"));
      }
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(onRender.mock.calls.length).toBe(settled);

    // The data DOES move: exactly one further commit — and then it holds. (A commit that always fired
    // would render, re-scan over its fresh stored object, re-commit, and loop: the count would run away.)
    act(() => { view.rerender(<Harness blocks={[TABLE("new")]} />); });
    await waitFor(() => expect(corners().length).toBe(1));
    const afterSwap = onRender.mock.calls.length;
    expect(afterSwap).toBeLessThanOrEqual(settled + 2);   // this act's render + at most one commit from the pair
    act(() => {
      for (let i = 0; i < 5; i += 1) {
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("scroll"));
      }
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(onRender.mock.calls.length).toBe(afterSwap);   // the pairing converged and holds still
    expect(oldBlock).toBeTruthy();
  });
});
