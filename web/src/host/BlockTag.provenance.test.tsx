// Provenance at the tag across version navigation. The store archives a board whole — bytes exactly as
// they were said, a live:true and all — because the record must stay what it was. But a version reached
// back into is a FROZEN drawing: it cannot update. So the footer may show that historical version its
// OWN words (its source, its as-of date), yet a stored live:true must never wear the word "Live" in a
// view nobody can refresh. The door is a fake over the real route shapes (GET /blocks/{id}[?version=N]);
// the render is the shipped BlockTag machinery answering it.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const badgeOf = (c: HTMLElement) => c.querySelector(".hb-provenance-badge") as HTMLElement | null;
const footerOf = (c: HTMLElement) => c.querySelector(".hb-provenance") as HTMLElement | null;

describe("provenance across version navigation (archived truthfulness)", () => {
  it("current → archived → current: Live is honored only where the drawing can still move", async () => {
    const id = "cafe0001";
    const d = door();
    const archived = {
      blocks: [
        { type: "heading", text: "the archived draft" },
        { type: "source", text: "BLS JOLTS (Nov 17)" },
      ],
      version: 1, updated_at: "2026-11-17T09:00:00+00:00",
      as_of: "Nov 17, 09:00 UTC", live: true,  // the stored flag of the frozen drawing — what it said THEN
    };
    const current = {
      blocks: [
        { type: "heading", text: "the current draft" },
        { type: "source", text: "BLS JOLTS (Nov 18)" },
      ],
      version: 2, updated_at: "2026-11-18T14:05:00+00:00",
      as_of: "Nov 18, 14:05 UTC", live: true,
    };
    d.boards.set(`${id}.versions`, [{ version: 1, saved_at: archived.updated_at, board: archived }]);
    d.boards.set(id, current);
    const { container } = mountTag(id, d);

    // The live view of a live:true board says Live — its own flag, honored.
    await waitFor(() => expect(badgeOf(container)?.textContent).toBe("Live"));
    expect(badgeOf(container)!.getAttribute("data-live")).toBe("live");

    // Reach back: the SAME drawing frozen in the archive, stored flag live:true and all.
    fireEvent.click(container.querySelector(".hb-live-history")!);  // v1 ↩
    await waitFor(() => expect(screen.getByText("the archived draft")).toBeTruthy());
    // A frozen drawing cannot update — the word "Live" must be gone...
    expect(container.textContent).not.toMatch(/Live/);
    // ...and its badge must say Snapshot truthfully, not vanish (the round-1 defect rendered "Live" here).
    expect(badgeOf(container)!.getAttribute("data-live")).toBe("snapshot");
    expect(badgeOf(container)!.textContent).toBe("Snapshot");
    // The historical version keeps its OWN words: never stripped, never borrowed from the current one.
    expect(footerOf(container)!.textContent).toContain("Nov 17, 09:00 UTC");
    expect(footerOf(container)!.textContent).toContain("BLS JOLTS (Nov 17)");

    // Back to current: the living flag is honored again.
    fireEvent.click(container.querySelector(".hb-live-back")!);  // current
    await waitFor(() => expect(screen.getByText("the current draft")).toBeTruthy());
    await waitFor(() => expect(badgeOf(container)?.textContent).toBe("Live"));
    expect(footerOf(container)!.textContent).toContain("Nov 18, 14:05 UTC");
  });

  it("an archived live:false still says Snapshot with its own date — the fix demotes, never strips", async () => {
    const id = "cafe0002";
    const d = door();
    const archived = {
      blocks: [{ type: "heading", text: "snapshot v1" }],
      version: 1, updated_at: "2026-11-17T09:00:00+00:00",
      as_of: "Nov 17, 09:00 UTC", live: false,
    };
    const current = {
      blocks: [{ type: "heading", text: "snapshot v2" }],
      version: 2, updated_at: "2026-11-18T14:05:00+00:00",
      as_of: "Nov 18, 14:05 UTC", live: false,
    };
    d.boards.set(`${id}.versions`, [{ version: 1, saved_at: archived.updated_at, board: archived }]);
    d.boards.set(id, current);
    const { container } = mountTag(id, d);

    await waitFor(() => expect(badgeOf(container)?.textContent).toBe("Snapshot"));  // the existing negative control
    fireEvent.click(container.querySelector(".hb-live-history")!);
    await waitFor(() => expect(screen.getByText("snapshot v1")).toBeTruthy());
    expect(badgeOf(container)!.textContent).toBe("Snapshot");
    expect(container.textContent).not.toMatch(/Live/);
    expect(footerOf(container)!.textContent).toContain("Nov 17, 09:00 UTC");
  });

  it("an archived version that never declared live gets no badge — nothing is invented for it", async () => {
    const id = "cafe0003";
    const d = door();
    const archived = {
      blocks: [{ type: "heading", text: "date-only v1" }],
      version: 1, updated_at: "2026-11-17T09:00:00+00:00",
      as_of: "Nov 17, 09:00 UTC",  // no live word at all
    };
    const current = {
      blocks: [{ type: "heading", text: "date-only v2" }],
      version: 2, updated_at: "2026-11-18T14:05:00+00:00",
      as_of: "Nov 18, 14:05 UTC",
    };
    d.boards.set(`${id}.versions`, [{ version: 1, saved_at: archived.updated_at, board: archived }]);
    d.boards.set(id, current);
    const { container } = mountTag(id, d);

    await waitFor(() => expect(footerOf(container)).not.toBeNull());
    expect(badgeOf(container)).toBeNull();
    fireEvent.click(container.querySelector(".hb-live-history")!);
    await waitFor(() => expect(screen.getByText("date-only v1")).toBeTruthy());
    expect(badgeOf(container)).toBeNull();
    expect(footerOf(container)!.textContent).toContain("Nov 17, 09:00 UTC");
    expect(container.textContent).not.toMatch(/Live|Snapshot/);
  });

  it("a board that says nothing grows no footer — mounted, reached back, and back again", async () => {
    const id = "cafe0004";
    const d = door();
    d.boards.set(`${id}.versions`, [{
      version: 1, saved_at: "2026-11-17T09:00:00+00:00",
      board: { blocks: [{ type: "heading", text: "plain v1" }], version: 1, updated_at: "2026-11-17T09:00:00+00:00" },
    }]);
    d.boards.set(id, { blocks: [{ type: "heading", text: "plain v2" }], version: 2, updated_at: "2026-11-18T14:05:00+00:00" });
    const { container } = mountTag(id, d);

    await waitFor(() => expect(screen.getByText("plain v2")).toBeTruthy());
    expect(footerOf(container)).toBeNull();
    const home = container.innerHTML;
    fireEvent.click(container.querySelector(".hb-live-history")!);
    await waitFor(() => expect(screen.getByText("plain v1")).toBeTruthy());
    expect(footerOf(container)).toBeNull();
    expect(container.textContent).not.toMatch(/Live|Snapshot/);
    fireEvent.click(container.querySelector(".hb-live-back")!);
    await waitFor(() => expect(screen.getByText("plain v2")).toBeTruthy());
    expect(footerOf(container)).toBeNull();
    expect(container.innerHTML).toBe(home);  // navigation leaves no provenance residue on a silent board
  });
});
