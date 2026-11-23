// What `::blocks{id="..."}` turns into inside a reply: a placeholder while the reply streams in, then the stored
// blocks fetched by id and drawn, or nothing at all when that isn't possible. Never raw JSON.
//
// One address, one live view (Living Boards): the FIRST tag of an id claims the address in the roster
// (core/boardRoster.ts) and owns the live view; every later tag of the same id draws a pointer instead and
// pokes the owner, whose refetch updates the SAME mounted subtree in place — a layout/state change of the
// same elements, never a second renderer (a calculator's sliders, an unsent form, a lit tab all ride
// through). A board that speaks a living word (a version, links) says it in a quiet row under itself; a board
// that speaks nothing draws the DOM and the note it always drew.
import { useContext, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { Blocks } from "../core/Blocks";
import * as boards from "../core/boardRoster";
import { carryBlocks } from "../core/living-identity";
import { forgetBlock, markLiving, migrateArchived, promoteOnUpdate } from "../blocks/checklist/savedState";
import { LivePointer, LiveRow } from "../core/LivingBoards";
import { readBlocksNoted, type BoardLink } from "../core/readBlocks";
import type { Block } from "../registry";
import { BlockActions } from "./actions";

const ID_PATTERN = /^[0-9a-f]{8}$/;

type State = { kind: "loading" } | { kind: "drawn"; blocks: Block[] } | { kind: "failed" };

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
        const { blocks, version: boardVersion, updatedAt: boardUpdatedAt, links: boardLinks } = readBlocksNoted(data);
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
            setState({ kind: "drawn", blocks });
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

  if (!validId && !streaming) return null;
  if (streaming || role === "unknown") return <Note text="drawing…" pulse />;
  if (role === "pointer") return <LivePointer id={id as string} address={address} />;
  if (state.kind === "loading") return <Note text="drawing…" pulse />;
  if (state.kind === "failed") return null;
  return (
    <BlockActions.Provider value={{ ...actions, blockId: id }}>
      <Blocks blocks={state.blocks} />
      {(live.version != null || live.links) && (
        <LiveRow id={id as string} version={live.version} updatedAt={live.updatedAt} links={live.links}
          viewing={viewing} onShow={setViewing} canReach={Boolean(actions.rest)} />
      )}
    </BlockActions.Provider>
  );
}

function Note({ text, pulse = false }: { text: string; pulse?: boolean }) {
  return <div className={pulse ? "hb-state hb-pulse" : "hb-state"}>{text}</div>;
}
