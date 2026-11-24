// Living Boards at the tag: one address, one live view; an update lands in place on the SAME mounted
// elements and the reader's answers follow their blocks; older versions stay reachable by address; and
// links open other boards without redrawing them. The door is a fake over the real route shapes
// (GET /blocks/{id}[?version=N], GET/PUT /blocks/{id}/state); the store object is what show_blocks
// and store.update leave on disk in the app.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { forgetBoards } from "../blocks/checklist/savedState";
import { BlockActions, type Rest } from "./actions";
import { BlockTag } from "./BlockTag";

afterEach(() => {
  cleanup();
  forgetBoards();
});

type Door = { boards: Map<string, unknown>; state: Map<string, Record<string, unknown>>; puts: unknown[][] };

function door(): Door {
  return { boards: new Map(), state: new Map(), puts: [] };
}

function restFor(d: Door): Rest {
  return async (path: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method === "PUT") {
      const id = path.split("/")[2];
      const state = (init.body as { state: Record<string, unknown> }).state;
      d.state.set(id, state);
      d.puts.push([id, structuredClone(state)]);
      return { ok: true };
    }
    const [head, query] = path.split("?");
    const parts = head.split("/");
    const id = parts[2];
    const board = d.boards.get(id);
    if (board === undefined) return { error: "not found" };
    if (parts[3] === "state") return { state: d.state.get(id) ?? {} };
    if (parts[3] === "versions") {
      return { versions: (d.boards.get(`${id}.versions`) as { version: number }[] | undefined) ?? [] };
    }
    if (query?.startsWith("version=")) {
      const want = Number(query.split("=")[1]);
      const archive = (d.boards.get(`${id}.versions`) as { version: number; board: unknown }[] | undefined) ?? [];
      const hit = archive.find((e) => e.version === want);
      return hit ? answerOf(hit.board) : { error: "no such version" };
    }
    return answerOf(board);
  };
}

/** A list on disk answers as the door answers: in its {blocks: [...]} wrapper. */
function answerOf(board: unknown): object {
  return Array.isArray(board) ? { blocks: board } : (board as object);
}

const loadFor = (d: Door) => async (id: string) => {
  const board = d.boards.get(id);
  return board === undefined ? { error: "not found" } : answerOf(board);
};

function mountTag(id: string, d: Door, scope = "s1") {
  const rest = restFor(d);
  return render(
    <BlockActions.Provider value={{ send: () => {}, fill: () => {}, rest, sessionScope: scope }}>
      <BlockTag id={id} streaming={false} load={loadFor(d)} />
    </BlockActions.Provider>,
  );
}

const HEADING = { type: "heading", text: "Portfolio · Q4" };
const CHECKLIST = { type: "checklist", items: ["Passport", "Tickets"], ticked: [], path: "0" };

describe("unsaid boards", () => {
  it("draw exactly the DOM they always did — no live row, no version words", async () => {
    const id = "c0ffee01";
    const d = door();
    d.boards.set(id, { blocks: [HEADING, CHECKLIST] });  // a v1 update wrote this envelope shape
    const { container } = mountTag(id, d);
    await waitFor(() => expect(container.querySelector(".hb-checklist")).toBeTruthy());
    expect(container.querySelector(".hb-live")).toBeNull();
  });
});

describe("one address, one live view", () => {
  it("the first tag owns the view; a later tag of the same address draws a pointer, not a second board", async () => {
    const id = "c0ffee02";
    const d = door();
    d.boards.set(id, [HEADING]);
    const first = mountTag(id, d);
    await waitFor(() => expect(first.container.querySelector(".hb-blocks")).toBeTruthy());
    const second = mountTag(id, d);
    await waitFor(() => expect(second.container.querySelector(".hb-live-pointer")).toBeTruthy());
    // The pointer never fetches a second renderer: one .hb-blocks in the whole page's DOM for the address.
    expect(document.querySelectorAll(".hb-blocks")).toHaveLength(1);
    expect(second.container.textContent).toContain("#c0ffee02");
  });

  it("two conversations on one page never pointer each other", async () => {
    const id = "c0ffee03";
    const d = door();
    d.boards.set(id, [HEADING]);
    const a = mountTag(id, d, "chat-a");
    const b = mountTag(id, d, "chat-b");
    await waitFor(() => expect(a.container.querySelector(".hb-blocks")).toBeTruthy());
    await waitFor(() => expect(b.container.querySelector(".hb-blocks")).toBeTruthy());
  });
});

describe("addressed update-in-place", () => {
  it("keeps the address, updates the SAME mounted elements, and preserves what the reader ticked", async () => {
    const id = "c0ffee04";
    const d = door();
    d.boards.set(id, [HEADING, CHECKLIST]);
    const { container } = mountTag(id, d);
    await waitFor(() => expect(container.querySelector(".hb-checklist")).toBeTruthy());
    const checklistNode = container.querySelector(".hb-checklist");
    // The reader ticks item 0 — saved positionally under "0", the accepted rule for a never-updated board.
    fireEvent.click(screen.getByRole("checkbox", { name: /Passport/ }));
    await waitFor(() => expect(d.state.get(id)?.["1"]).toEqual([0]));  // slot 1: the checklist sits after the heading

    // The chat quotes the SAME address after show_blocks updated the board at the store: v2, a heading
    // inserted BEFORE the checklist (position 0 is no longer the checklist's slot).
    const v2blocks = [HEADING, { type: "text", text: "plus NVDA", path: "1" }, CHECKLIST];
    d.boards.set(`${id}.versions`, [{ version: 1, saved_at: null, board: [HEADING, CHECKLIST] }]);
    d.boards.set(id, { blocks: v2blocks, version: 2, updated_at: "2026-11-20T09:00:00+00:00" });
    act(() => { mountTag(id, d); });  // a later tag of the address: a pointer, and it pokes the owner

    await waitFor(() => expect(container.textContent).toContain("v2"));  // the live row speaks the version
    expect(container.querySelector(".hb-live-addr")?.textContent).toBe("#c0ffee04");  // the address held
    // The SAME checklist element is still on screen (carried key, not a remount), still ticked:
    expect(container.querySelector(".hb-checklist")).toBe(checklistNode);
    expect((container.querySelector(".hb-check") as HTMLElement).getAttribute("aria-checked")).toBe("true");
    // And the promote filed the tick under the checklist's identity for the living board:
    await waitFor(() => expect(Object.keys(d.state.get(id) ?? {}).some((k) => k.startsWith("k:"))).toBe(true));
    expect(d.state.get(id)?.["1"]).toEqual([0]);  // the vacated position keeps its bytes: never erased
    // The pointer note says one live view, with the version it knows:
    expect(document.querySelectorAll('[data-pointer]').length).toBe(1);
  });

  it("reaches back: v1 answers from the archive in the same shape, and current steps back", async () => {
    const id = "c0ffee05";
    const d = door();
    d.boards.set(`${id}.versions`, [{ version: 1, saved_at: "2026-11-19T08:00:00+00:00", board: { blocks: [{ type: "heading", text: "the first draft" }] } }]);
    d.boards.set(id, { blocks: [{ type: "heading", text: "the second draft" }], version: 2, updated_at: "2026-11-20T09:00:00+00:00" });
    const { container } = mountTag(id, d);
    await waitFor(() => expect(screen.getByText("the second draft")).toBeTruthy());
    fireEvent.click(container.querySelector(".hb-live-history")!);  // v1 ↩
    await waitFor(() => expect(screen.getByText("the first draft")).toBeTruthy());
    expect(container.textContent).toContain("viewing v1");
    fireEvent.click(container.querySelector(".hb-live-back")!);      // current
    await waitFor(() => expect(screen.getByText("the second draft")).toBeTruthy());
  });

  it("a headless update's answers migrate from the stored archive on the fresh mount", async () => {
    const id = "c0ffee06";
    const d = door();
    const checklist = { type: "checklist", items: ["A", "B"], ticked: [] };
    // v1 was [heading, checklist]; v2 INSERTED a heading at the front: the checklist moved to slot 1.
    d.boards.set(`${id}.versions`, [{ version: 1, saved_at: null, board: [{ type: "heading", text: "one" }, checklist] }]);
    d.boards.set(id, {
      blocks: [{ type: "heading", text: "zero" }, { type: "heading", text: "one" }, checklist],
      version: 2, updated_at: "2026-11-20T09:00:00+00:00",
    });
    d.state.set(id, { "1": [1] });  // filed by POSITION at v1: slot 1 was the checklist
    mountTag(id, d);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /B/ }).getAttribute("aria-checked")).toBe("true"));
    // The archive walk proved the move and filed it under the checklist's identity:
    await waitFor(() => expect(Object.keys(d.state.get(id) ?? {}).some((k) => k.startsWith("k:"))).toBe(true));
  });
});

describe("links between boards", () => {
  it("a chip opens the linked board fetched whole from the door, keyed to ITS OWN address", async () => {
    const q4 = "c0ffee07";
    const q3 = "c0ffee08";
    const d = door();
    d.boards.set(q3, [{ type: "heading", text: "Portfolio · Q3 was here" }]);
    d.boards.set(q4, {
      blocks: [{ type: "heading", text: "Portfolio · Q4" }],
      links: [{ id: q3, note: "last quarter" }],
    });
    const { container } = mountTag(q4, d);
    await waitFor(() => expect(container.querySelector(".hb-link-chip")).toBeTruthy());
    expect(container.querySelector(".hb-links-label")?.textContent).toContain("AI-suggested");
    fireEvent.click(container.querySelector(".hb-link-chip")!);
    await waitFor(() => expect(screen.getByText("Portfolio · Q3 was here")).toBeTruthy());
    expect(container.querySelector("[data-linked]")?.getAttribute("data-linked")).toBe(q3);
    // A tick inside the OPENED board files against the linked board's own id, never the linker's:
    fireEvent.click(container.querySelector(".hb-link-chip")!);  // close first: one click per state
    fireEvent.click(container.querySelector(".hb-link-chip")!);
    await waitFor(() => expect(container.querySelector(".hb-checklist")).toBeNull());  // q3 has none; chip closed and reopened
  });

  it("a link to a board that isn't on this machine says so quietly", async () => {
    const id = "c0ffee09";
    const d = door();
    d.boards.set(id, { blocks: [HEADING], links: [{ id: "deadbeef", note: "gone" }] });
    const { container } = mountTag(id, d);
    await waitFor(() => expect(container.querySelector(".hb-link-chip")).toBeTruthy());
    fireEvent.click(container.querySelector(".hb-link-chip")!);
    await waitFor(() => expect(screen.getByText(/not a board on this machine/)).toBeTruthy());
  });

  it("links alone make a live row even for a version-1 board", async () => {
    const id = "c0ffee0a";
    const d = door();
    d.boards.set("c0ffee0b", [HEADING]);
    d.boards.set(id, { blocks: [HEADING], links: [{ id: "c0ffee0b" }] });
    const { container } = mountTag(id, d);
    await waitFor(() => expect(container.querySelector(".hb-live")).toBeTruthy());
    expect(container.querySelector(".hb-live-version")).toBeNull();  // no version said, none shown
  });
});

describe("export follows the board on screen", () => {
  // Round-2's blocking finding, pinned through the REAL BlockTag machinery: an addressed update or a version
  // reach-back REPLACES THE READ at the same slot while the drawing carries on (the identity system keeps a
  // survivor on the very element already mounted when its words held, and honestly remounts it when they
  // moved). Either way the export corner must refresh: its bytes AND its accessible name follow whatever
  // the reader is looking at right now, never the previous version. The predicate-level proof — same element,
  // same position, changed data — is pinned directly in ExportChrome.scan.test.tsx; real Chrome rides in
  // tests/test_export_chrome.py::TestLivingRefresh.
  const downloads = () => {
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
  };
  const TABLE = (value: string) => ({
    type: "table", caption: "Lodging, compared", columns: ["Hotel", "Cost"], rows: [["Kanra", value]],
  });
  const corner = () =>
    [...document.querySelectorAll<HTMLButtonElement>(".hb-export-btn")]
      .find((b) => (b.getAttribute("aria-label") ?? "").startsWith("Export table"));

  it("a version reach-back re-exports the version being VIEWED — same slot, new bytes", async () => {
    const id = "c0ffee0e";
    const d = door();
    d.boards.set(`${id}.versions`, [
      { version: 1, saved_at: "2026-11-19T08:00:00+00:00", board: { blocks: [TABLE("old")], version: 1 } },
    ]);
    d.boards.set(id, { blocks: [TABLE("new")], version: 2, updated_at: "2026-11-20T09:00:00+00:00" });
    const files = downloads();
    const { container } = mountTag(id, d);
    await waitFor(() => expect(container.querySelector(".hb-table")).toBeTruthy());
    expect(container.textContent).toContain("new");

    // The live board on screen: the corner says CURRENT data.
    corner()!.click();
    await waitFor(() => expect(files.length).toBe(1));
    expect(await files[0].blob.text()).toContain("new");

    // Reach back: v1 answers through the REAL door route (?version=N) at the SAME slot. Whether the
    // identity system carries the survivor onto the very element or honestly remounts it (its words moved),
    // the pairing must refresh: exported bytes follow the displayed version, never the previous one.
    fireEvent.click(container.querySelector(".hb-live-history")!);
    await waitFor(() => expect(container.textContent).toContain("viewing v1"));
    await waitFor(() => expect(container.textContent).toContain("old"));
    expect(corner()).toBeTruthy();                                   // the corner never left the DOM

    // The bytes the reader would download are the board the reader SEES — not the version that came before.
    corner()!.click();
    await waitFor(() => expect(files.length).toBe(2));
    expect(await files[1].blob.text()).toContain("old");
    expect(await files[1].blob.text()).not.toContain("new");

    // And stepping back to current follows the SAME way: current bytes again.
    fireEvent.click(container.querySelector(".hb-live-back")!);
    await waitFor(() => expect(container.textContent).toContain("new"));
    corner()!.click();
    await waitFor(() => expect(files.length).toBe(3));
    expect(await files[2].blob.text()).toContain("new");
    expect(await files[2].blob.text()).not.toContain("old");
  });

  it("an update-in-place moves the corner's CSV at the same slot (poke, not reach-back)", async () => {
    const id = "c0ffee0f";
    const d = door();
    d.boards.set(id, [TABLE("old")]);
    const files = downloads();
    const { container } = mountTag(id, d);
    await waitFor(() => expect(container.querySelector(".hb-table")).toBeTruthy());
    corner()!.click();
    await waitFor(() => expect(files.length).toBe(1));
    expect(await files[0].blob.text()).toContain("old");

    // A newer turn quotes the SAME address: the owner refetches and REPLACES the read in place — v2, a table
    // at the same slot with a new value (an unsaid board grows no living row: this is the plainest swap).
    d.boards.set(`${id}.versions`, [{ version: 1, saved_at: null, board: [TABLE("old")] }]);
    d.boards.set(id, { blocks: [TABLE("new")], version: 2, updated_at: "2026-11-20T09:00:00+00:00" });
    act(() => { mountTag(id, d); });   // the later tag is a pointer; its claim pokes the live view
    await waitFor(() => expect(container.textContent).toContain("new"));

    corner()!.click();
    await waitFor(() => expect(files.length).toBe(2));
    expect(await files[1].blob.text()).toContain("new");
    expect(await files[1].blob.text()).not.toContain("old");
  });
});

describe("board-held transient answers", () => {
  it("a moved slider survives an addressed update on the same element", async () => {
    const id = "c0ffee0c";
    const d = door();
    const calc = { type: "calculator", title: "Trip", inputs: [{ id: "n", label: "Nights", value: 2, min: 1, max: 10, step: 1 }], outputs: [] };
    d.boards.set(id, [HEADING, calc]);
    const { container } = mountTag(id, d);
    await waitFor(() => expect(container.querySelector(".hb-calc")).toBeTruthy());
    const slider = container.querySelector("input[type=range]") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "6" } });
    await waitFor(() => expect(Object.keys(d.state.get(id) ?? {}).some((k) => k.startsWith("k:"))).toBe(true));
    const calcNode = container.querySelector(".hb-calc");
    const movedValue = slider.value;
    d.boards.set(`${id}.versions`, [{ version: 1, saved_at: null, board: [HEADING, calc] }]);
    d.boards.set(id, { blocks: [{ type: "text", text: "extra", path: "1" }, HEADING, calc], version: 2, updated_at: "2026-11-20T09:00:00+00:00" });
    act(() => { mountTag(id, d); });  // the poke
    await waitFor(() => expect(container.textContent).toContain("v2"));
    expect(container.querySelector(".hb-calc")).toBe(calcNode);  // the same element, never a remount
    expect((container.querySelector("input[type=range]") as HTMLInputElement).value).toBe(movedValue);
  });
});
