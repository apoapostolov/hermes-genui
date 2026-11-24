// What `::blocks{id="..."}` turns into inside a reply: a placeholder while the reply streams in, then the stored
// blocks fetched by id and drawn, or nothing at all when that isn't possible. Never raw JSON.
//
// One address, one live view (Living Boards): the FIRST tag of an id claims the address in the roster
// (core/boardRoster.ts) and owns the live view; every later tag of the same id draws a pointer instead and
// pokes the owner, whose refetch updates the SAME mounted subtree in place — a layout/state change of the
// same elements, never a second renderer (a calculator's sliders, an unsent form, a lit tab all ride
// through). A board that speaks a living word (a version, links) says it in a quiet row under itself; a board
// that speaks nothing draws the DOM and the note it always drew. The stored answer may also carry the board's
// own placement words (align, text_align) beside its blocks; they ride through to the drawing, which resolves
// them for every block that didn't ask for itself. A board that declares provenance (when its data is from,
// live or snapshot) grows its footer; a version reached back into keeps its own date and source but never says
// "Live" — a frozen drawing cannot update.
//
// The reader gets exactly one view, not an ask: a quiet expand control on every drawn board, the images strip's
// full-size overlay pattern (blocks/images/Images.tsx) raised to the whole board — with one honest correction.
// A stateless photo may be re-drawn at full size; a board may not: its blocks carry live state (a calculator's
// sliders, an unsent form draft, a lit flow), so expanding MOVES the one drawn instance into the dialog instead
// of instantiating a second one. The host's .hb-board-host wrapper — a plain block container at rest, so an
// inline board keeps drawing its byte-identical .hb-blocks under it — becomes the fixed dialog itself: cards
// keep their caps and full-width blocks ride the wider column. Escape or the close control returns to the
// inline view and the element settles back into flow; state survives open, close and reopen in both directions
// because the blocks were never unmounted. Focus lands in the dialog on open, stays inside it while open, and
// lands back on the control on close; the trap wraps Tab on the eligible tabbable controls (see tabbableIn),
// never on disabled, negative-tabindex or hidden ones. A board that is not expanded draws exactly the markup
// it always drew: the control lives outside the board wrapper, and the wrapper takes no part in layout. The
// pointer a later tag draws has no board to move, so it grows no control; the living row stays beside the
// live view (the dialog is the board itself).
import { useContext, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { Blocks, type Provenance } from "../core/Blocks";
import * as boards from "../core/boardRoster";
import { carryBlocks } from "../core/living-identity";
import { forgetBlock, markLiving, migrateArchived, promoteOnUpdate } from "../blocks/checklist/savedState";
import { LivePointer, LiveRow } from "../core/LivingBoards";
import { readBlocksNoted, type BoardLink, type FollowUp } from "../core/readBlocks";
import type { Align } from "../core/fields";
import type { Block } from "../registry";
import { BlockActions } from "./actions";

const ID_PATTERN = /^[0-9a-f]{8}$/;

type State = { kind: "loading" }
  | { kind: "drawn"; blocks: Block[]; align?: Align; textAlign?: Align; followUps?: FollowUp[] }
  | { kind: "failed" };

/**
 * load fetches the stored JSON for an id (in the app: the plugin's REST route).
 *   streaming → "drawing…" (no fetch yet: the tag may still be arriving)
 *   id "zzz" → renders nothing (never fetched: a stray half-written tag must not leave a note in the reply)
 *   fetch fails, or nothing in it can be drawn → renders nothing
 * The blocks drawn get the app's actions (send, fill, rest) with this tag's id added, so a checklist saves its
 * ticks with this board.
 */
export function BlockTag({ id, streaming, load }: { id: string | undefined; streaming: boolean; load: (id: string) => Promise<unknown> }) {
  const validId = typeof id === "string" && ID_PATTERN.test(id);
  const actions = useContext(BlockActions);
  // The roster's address key: the board id scoped to its conversation. An address is THE CHAT's visual
  // memory — two session panes open on one page never pointer each other.
  const address = validId ? `${actions.sessionScope ?? ""}|${id}` : "";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [viewing, setViewing] = useState<number | null>(null);  // an archived version being viewed, or null
  const [expanded, setExpanded] = useState(false);              // the drawn board moved into the full-screen dialog
  const hostRef = useRef<HTMLDivElement | null>(null);
  const expandRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // The tree this live view MOUNTED last: what the next replacement tree is carried against.
  const drawn = useRef<Block[] | null>(null);

  // The roster claim (core/boardRoster.ts): the token belongs to this instance; the claim is taken in a
  // LAYOUT effect so no flash of the wrong role ever paints, and it is released on unmount whatever path
  // the tag arrived by (streaming tags never hold a claim they cannot give back). Role "unknown" is only
  // the pre-claim beat of the very first paint — it draws the same "drawing…" note the tag has always
  // shown before its first answer lands.
  const self = useRef<{ token: symbol } | null>(null);
  if (self.current === null) self.current = { token: Symbol("hb-tag") };
  const [role, setRole] = useState<"unknown" | "home" | "pointer">("unknown");
  const [refresh, setRefresh] = useState(0);  // the owner's answer to a poke: the address said something newer
  const [, force] = useReducer((x: number) => x + 1, 0);  // repaint on any roster word about this address
  const [live, setLive] = useState<{ version?: number; updatedAt?: string; links?: BoardLink[] }>({});
  const [provenance, setProvenance] = useState<Provenance>({});  // what the drawn answer said about its own data

  useLayoutEffect(() => {
    if (streaming || !validId) return;
    const token = self.current!.token;
    const claim = boards.claim(address, token);
    setRole(claim ? "home" : "pointer");
    if (!claim) boards.poke(address);  // an update turn quotes this address: the live view should show it
    const recompute = () => {
      const mine = boards.owns(address, token);
      setRole(mine ? "home" : boards.listed(address, token) ? "pointer" : "unknown");
      force();  // pointers speak the live view's word: a meta change repaints them even when the role is stable
    };
    const unsub = boards.subscribe(address, recompute);
    // The poke channel is the owner's refetch word — and it steps the view back to the current version: a
    // poke means a newer turn quoted this address, so an older one being looked at is no longer the ask.
    const offPoke = boards.onPoke(address, () => {
      setViewing(null);
      setRefresh((r) => r + 1);
    });
    return () => {
      unsub();
      offPoke();
      // When this was the page's LAST tag of the address, forgetBlock only PUSHES the queued door writes
      // out — the board's answers live on the board (door + page mirror), not on the elements, so a reopen
      // at the address finds everything, mounted updates or headless ones.
      if (boards.release(address, token)) forgetBlock(id);
    };
  }, [address, id, streaming, validId]);

  useEffect(() => {
    if (streaming || !validId || role !== "home") return;
    let alive = true;
    // The live view answers load() (the tag's own door call); an archived version reached back into answers
    // the same door with its number — retrieval by address, never a redraw.
    const ask = viewing === null || !actions.rest
      ? load(id)
      : actions.rest(`/blocks/${id}?version=${viewing}`);
    Promise.resolve(ask)
      .then((data) => {
        const {
          blocks, version: boardVersion, updatedAt: boardUpdatedAt, links: boardLinks,
          align: boardAlign, textAlign: boardTextAlign, asOf: boardAsOf, live: boardLive,
          followUps: boardFollowUps,
        } = readBlocksNoted(data);
        if (!alive) return;
        if (blocks.length) {
          // Drawing the answer is a function of the board and the door; the ONE thing that may precede it
          // is an archive walk: a version ≥ 2 board arriving at a FRESH mount may carry updates that landed
          // with no view mounted anywhere — no promote ever ran, and the door may still hold answers under
          // the OLD position or a superseded chain. migrateArchived computes the old→new mapping from the
          // STORED specs alone and lands every answer it can PROVE before any block mounts. The walk may
          // not block the draw forever: it never rejects, and its round trips are the door's own.
          const headless = drawn.current === null && viewing === null && (boardVersion ?? 0) >= 2;
          const commitDraw = () => {
            if (!alive) return;
            // A replacement tree landing on this live view: carry every logically-retained block's identity
            // forward (core/living-identity.ts) BEFORE the swap, so React reconciles each surviving drawing
            // onto the very element already mounted — independent of content shape and of slot alike.
            // The first draw carries nothing: an unsaid board draws exactly the old keys, byte for byte.
            if (drawn.current) carryBlocks(drawn.current, blocks);
            // The update also makes the board LIVING: its interactive answers now file by identity and
            // follow their blocks across moves and reopens. The promote runs synchronously up to the door's
            // first answer, and marks before the swap renders, so every remount mounts from the board.
            if (drawn.current && viewing === null) void promoteOnUpdate(actions.rest, id, drawn.current, blocks);
            if (viewing === null && (boardVersion ?? 0) >= 2) markLiving(id);
            drawn.current = blocks;
            setState({ kind: "drawn", blocks, align: boardAlign, textAlign: boardTextAlign,
              followUps: boardFollowUps });
            // The footer speaks only what the answer being drawn carries for itself: a live view stamps its own
            // as_of and live, and a version reached back into is stamped with whatever that version said —
            // an older drawing never borrows the current version's freshness, and a board that says nothing
            // clears the footer. One truth stands on top of that per-version stamping: a historical view is a
            // FROZEN drawing — it can no longer move — so a stored live:true must never wear the word "Live"
            // there. It wears the word that fits instead, Snapshot, and keeps its own date and source. The
            // latest version is untouched: whatever the current board declared is exactly what its live view says.
            const stale = viewing !== null && boardLive === true;
            setProvenance({ asOf: boardAsOf, live: stale ? false : boardLive });
            // Only the LIVE answer says what this address IS now: the live row and the roster's word about
            // the address speak of the current version, whatever older one is being looked at.
            if (viewing === null) {
              setLive({ version: boardVersion, updatedAt: boardUpdatedAt, links: boardLinks });
              boards.setMeta(address, { version: boardVersion, updatedAt: boardUpdatedAt });
            }
          };
          if (headless && actions.rest !== undefined) {
            const rest = actions.rest;
            void migrateArchived(
              rest, id,
              async (v) => {
                const answer = await rest(`/blocks/${id}?version=${v}`);
                const read = readBlocksNoted(answer).blocks;
                return read.length > 0 ? (read as unknown[]) : null;
              },
              blocks, boardVersion ?? 2,
            ).then(commitDraw, commitDraw);  // the walk swallows everything; either way the board draws
          } else {
            commitDraw();
          }
        } else if (viewing === null) {
          setState({ kind: "failed" });
        } else {
          setViewing(null);  // the door had no such version: say nothing false, keep the live board drawn
        }
      })
      .catch(() => {
        if (!alive) return;
        if (viewing === null) setState({ kind: "failed" });
        else setViewing(null);
      });
    return () => {
      alive = false;
    };
    // actions.rest is left out of the deps on purpose: it is a per-render closure over the same door.
  }, [address, id, streaming, validId, role, refresh, viewing]);

  const close = () => {
    setExpanded(false);
    expandRef.current?.focus();  // the dialog hands focus back to the control it opened from
  };

  useEffect(() => {
    if (expanded) closeRef.current?.focus();  // an open dialog owns the keyboard
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // A photo opened from inside this dialog sits above it; the key answers the topmost layer first.
        if (document.querySelector(".hb-photo-overlay")) return;
        close();
        return;
      }
      if (e.key !== "Tab" || !hostRef.current) return;
      const items = tabbableIn(hostRef.current);  // the DOM can change while open: recompute per keypress
      if (!items.length) return;
      e.preventDefault();  // the dialog owns the keyboard: Tab steps only through its own eligible controls
      const active = document.activeElement as HTMLElement | null;
      const at = active === null ? -1 : items.indexOf(active);
      const step = e.shiftKey ? -1 : 1;
      const next = at === -1 ? (e.shiftKey ? items.length - 1 : 0) : (at + step + items.length) % items.length;
      items[next].focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (!validId && !streaming) return null;
  if (streaming || role === "unknown") return <Note text="drawing…" pulse />;
  if (role === "pointer") return <LivePointer id={id as string} address={address} />;
  if (state.kind === "loading") return <Note text="drawing…" pulse />;
  if (state.kind === "failed") return null;
  return (
    <BlockActions.Provider value={{ ...actions, blockId: id }}>
      <div className="hb-tag">
        <button ref={expandRef} type="button" className="hb-expand" aria-label="Expand board" aria-haspopup="dialog"
          onClick={() => setExpanded(true)}>
          <IconExpand />
        </button>
        <div ref={hostRef} className={expanded ? "hb-board-host hb-board-overlay" : "hb-board-host"}
          {...(expanded ? { role: "dialog", "aria-modal": "true", "aria-label": "Expanded board" } : {})}
          onClick={expanded ? (e) => e.target === e.currentTarget && close() : undefined}>
          {expanded && (
            <button ref={closeRef} type="button" className="hb-overlay-close" aria-label="Close expanded board"
              onClick={close}>
              <IconClose />
            </button>
          )}
          <Blocks blocks={state.blocks} boardAlign={state.align} boardTextAlign={state.textAlign}
            provenance={provenance} boardFollowUps={state.followUps} />
        </div>
      </div>
      {(live.version != null || live.links) && (
        <LiveRow id={id as string} version={live.version} updatedAt={live.updatedAt} links={live.links}
          viewing={viewing} onShow={setViewing} canReach={Boolean(actions.rest)} />
      )}
    </BlockActions.Provider>
  );
}

/** The controls a real Tab press can reach inside the open dialog, in tab order. The focusable set minus the
 *  controls that are not actually stops: anything disabled (own .disabled or a disabled fieldset — Steps and
 *  Layers end on a spent Next, and a form's Send sits behind its fieldset once sent), anything asking not to be
 *  (negative tabindex, hidden inputs), anything not shown. The layout half of that read (rects, visibility)
 *  only counts where layout is real; jsdom reports a zero rect for every element, so there the attribute
 *  shape governs and Chrome measures the rest (tests/test_expand_fullscreen.py). */
function tabbableIn(root: HTMLElement): HTMLElement[] {
  const laidOut = root.getClientRects().length > 0;
  return [...root.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")].filter(
    (el) =>
      el.tabIndex >= 0 &&
      el.getAttribute("type") !== "hidden" &&
      (el as HTMLButtonElement).disabled !== true &&
      !el.closest("fieldset[disabled]") &&
      !el.closest("[hidden]") &&
      (!laidOut || (el.getClientRects().length > 0 && getComputedStyle(el).visibility === "visible")),
  );
}

function Note({ text, pulse = false }: { text: string; pulse?: boolean }) {
  return <div className={pulse ? "hb-state hb-pulse" : "hb-state"}>{text}</div>;
}

function IconExpand() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true">
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
