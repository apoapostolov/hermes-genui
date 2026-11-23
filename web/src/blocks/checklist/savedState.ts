// What the user did to a stored board (a checklist's ticks, a slider's dragged line, an unsent form draft,
// a picked tab), saved on the server beside the board so it follows them to every device: GET and PUT
// /blocks/<id>/state. The state is one object per board. Until the board is UPDATED IN PLACE, a checklist
// and a form's sent record file where the block sits ("0", "1.children.2") — the accepted rule, byte for
// byte. The moment an update lands, the board is LIVING (promoteOnUpdate below): answers then file by the
// block's IDENTITY slot — "k:" plus the chain of its own words and the own words of the identity blocks
// above it (core/living-identity.ts) — so a reader's answer follows its block across an insertion, a
// reorder, a move into another container and a reopen, and a block taking over a vacated position can
// never read the old occupant's answer. Saving never shows an error: without the server the values simply
// live on screen (and, on this page, in the store below) until the reply is drawn again.
import type { Rest } from "../../host/actions";
import { carrySource, eachSlot, kkey } from "../../core/living-identity";

type Board = {
  state: Record<string, unknown>;
  loaded: Promise<Record<string, unknown>>;
  saving: Promise<void>;
  ready: boolean;  // the door has answered once: state may be read and written on the spot, without waiting
};
const boards = new Map<string, Board>();

// Boards that have taken an update in place: their answers now file by identity. A reopen of a
// version-≥2 board re-marks it from the door's own word (host/BlockTag.tsx). A board that was never
// updated never sees any of this: its checklist and form save positionally, exactly as accepted.
const living = new Set<string>();

// Which version of each board the ARCHIVE WALK (migrateArchived below) has already computed its mapping
// against: one honest pass per address-and-version, not one per mount.
const migratedWalk = new Map<string, number>();

// The page's live answers, keyed `<blockId>\u0000<identity chain>`: a move remounts within the same tick,
// too fast for any network — an in-page mount looks HERE first and in the door's state second.
const stored = new Map<string, unknown>();

// Coalesced door writes for transient answers (a slider fires an event for every pixel of its drag).
const queued = new Map<string, { rest: Rest; value: unknown }>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const DOOR_DELAY = 150;

/** Forget every board loaded so far (tests start each case clean). */
export function forgetBoards(): void {
  boards.clear();
  migratedWalk.clear();
}

/** The server's answer as a state object: {state: {"0": [1]}} → {"0": [1]};  {} (nothing saved yet) → {};  junk → {} */
function stateIn(answer: unknown): Record<string, unknown> {
  const state = (answer as { state?: unknown } | null)?.state;
  if (state && typeof state === "object" && !Array.isArray(state)) return { ...(state as Record<string, unknown>) };
  return {};
}

/**
 * A board's saved state, fetched once and shared by every block on it (two checklists in one board load it once). A
 * failed fetch gives {} and is forgotten, so the next block drawn tries again. The promise resolves to the board's
 * LIVE object, and so does peekState once the board has loaded: a block mounted after a change reads the newest
 * values without waiting on the network again.
 *   board 7f3a09bc with {"0": [1]} saved → {"0": [1]};  nothing saved → {};  offline → {}
 */
export function loadBoardState(rest: Rest, blockId: string): Promise<Record<string, unknown>> {
  const known = boards.get(blockId);
  if (known) return known.loaded;
  const board: Board = { state: {}, loaded: Promise.resolve({}), saving: Promise.resolve(), ready: false };
  board.loaded = rest(`/blocks/${blockId}/state`).then(
    (answer) => {
      Object.assign(board.state, stateIn(answer));
      board.ready = true;
      return board.state;
    },
    () => {
      boards.delete(blockId);
      return {};
    },
  );
  boards.set(blockId, board);
  return board.loaded;
}

/** The board's door state the moment it is trustworthy on the page, or null when it still must be fetched. */
export function peekState(blockId: string): Record<string, unknown> | null {
  const board = boards.get(blockId);
  return board !== undefined && board.ready ? board.state : null;
}

/**
 * Sets one block's value and saves the board's whole state, after its load and after any save before it (so the
 * server ends with the last tap). Two checklists on one board keep each other's ticks. Failures are swallowed.
 *   saved {"1": [0]}; saveBoardValue(rest, id, "0", [2]) → PUT {state: {"1": [0], "0": [2]}}
 *   the board's state can't be loaded → nothing is sent (the tick stays on screen)
 */
export async function saveBoardValue(rest: Rest, blockId: string, key: string, value: unknown): Promise<void> {
  await loadBoardState(rest, blockId);
  const board = boards.get(blockId);
  if (!board) return;  // the load failed: saving only this value could wipe what other blocks on the board saved
  board.state[key] = value;
  const snapshot = { ...board.state };
  board.saving = board.saving.then(() => rest(`/blocks/${blockId}/state`, { method: "PUT", body: { state: snapshot } })).then(() => {}, () => {});
  await board.saving;
}

// --- the living board: identity filing --------------------------------------------------------------------------------
//
// Interactive state lives on the BOARD, keyed by the block's carried identity, and is restored on every
// mount. These are the pieces core/blockState.ts composes; a block never calls them directly.

/** The board has taken an update in place: its answers now file by identity. */
export function markLiving(blockId: string): void {
  living.add(blockId);
}

export function isLiving(blockId: string): boolean {
  return living.has(blockId);
}

/** Has this door state ever been filed by identity? Before it has, a positional key is still the board's
 *  own truth; after it has, position says NOTHING — a block must never wear a vacated slot's old answer. */
export function hasIdentityKeys(state: Record<string, unknown>): boolean {
  return Object.keys(state).some((key) => key.startsWith("k:"));
}

/** What a mount reads out of the door's state for one block: the value filed under its key — and ONLY
 *  that key. A living board never answers a block through a POSITION. The positional truth stays exactly
 *  where it belongs: a board that was never updated reads its own path because its door key IS the path
 *  (blockState.ts), not because anything falls back. A vacated slot leaves nothing behind for its next
 *  occupant to mistake for its own; legacy bytes move only along a mapping the archive proves below,
 *  never along the new layout. */
export function seedValue(state: Record<string, unknown>, key: string): unknown {
  return state[key];
}

/** The page's live answer for a block's identity chain, if it holds one. */
export function peekStored(blockId: string, cacheKey: string): { value: unknown } | undefined {
  const key = `${blockId}\u0000${cacheKey}`;
  return stored.has(key) ? { value: stored.get(key) } : undefined;
}

/**
 * File one answer: on the page always, on the server per policy.
 *   "now"      — save at once (a checklist tick, a form's sent record: the accepted semantics, unchanged);
 *   "coalesce" — save at most once a breath (a dragged slider, a clicked tab, a typed draft): EVERY
 *                interactive kind files its answer at the edit itself, living or not — there is no
 *                transient path that stops at the page; "never" now means only that no door exists to
 *                write to (a bare preview) or the block has no identity chain at all.
 * A block outside a drawn board has no identity chain (cacheKey null) but keeps its positional door save.
 */
export function recordValue(
  rest: Rest | undefined, blockId: string, cacheKey: string | null, doorKey: string,
  value: unknown, door: "now" | "coalesce" | "never",
): void {
  if (cacheKey !== null) stored.set(`${blockId}\u0000${cacheKey}`, value);
  const state = peekState(blockId);
  if (state !== null && door !== "never") state[doorKey] = value;  // the page's own door mirror: a fresh mount reads it at once
  if (!rest || door === "never") return;
  if (door === "now") {
    void saveBoardValue(rest, blockId, doorKey, value);
    return;
  }
  const key = `${blockId}\u0000${doorKey}`;
  queued.set(key, { rest, value });
  if (!timers.has(key)) {
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      const pending = queued.get(key);
      if (pending !== undefined) {
        queued.delete(key);
        const at = key.indexOf("\u0000");
        void saveBoardValue(pending.rest, key.slice(0, at), key.slice(at + 1), pending.value);
      }
    }, DOOR_DELAY));
  }
}

/** The page has let this board go (its roster is vacant). Releasing a view DESTROYS NOTHING the reader
 *  answered — every answer reached the board at the edit itself, and the page's mirror of them is the
 *  board's own store, not an element's. Push every queued door write out first, so the door holds them
 *  even if this page never speaks to it again; only the archive-walk gate resets, so a later mount
 *  re-checks the door honestly. */
export function forgetBlock(blockId: string): void {
  const prefix = `${blockId}\u0000`;
  for (const [key, item] of [...queued]) {
    if (!key.startsWith(prefix)) continue;
    queued.delete(key);
    const timer = timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(key);
    void saveBoardValue(item.rest, blockId, key.slice(prefix.length), item.value);
  }
  living.delete(blockId);
  migratedWalk.delete(blockId);  // the page let the address go: the next mount re-checks the door honestly
}

/** Where one new-tree block came from at the update: the block it was CARRIED from in its own list, or —
 *  only when nothing else in the old tree shares its flat identity — the unique block it clearly MOVED
 *  away from. Answers ride that trail. */
type Trail = { from: string; position?: string };

function trailsFrom(prev: unknown[] | null, next: unknown[]): Map<object, Trail> {
  const trails = new Map<object, Trail>();
  if (prev === null) return trails;
  const prevFull = new Map<object, string>();
  const prevFlat = new Map<string, Trail & { count: number }>();
  eachSlot(prev, (block, full, flat) => {
    prevFull.set(block, full);
    const position = (block as { path?: unknown }).path;
    const seen = prevFlat.get(flat);
    if (seen === undefined) {
      prevFlat.set(flat, { from: full, position: typeof position === "string" ? position : undefined, count: 1 });
    } else {
      seen.count += 1;
    }
  });
  eachSlot(next, (block, full, flat) => {
    const src = carrySource(block);
    if (src !== undefined) {
      const was = prevFull.get(src);
      if (was !== undefined) {
        const position = (src as { path?: unknown }).path;
        trails.set(block, { from: was, position: typeof position === "string" ? position : undefined });
      }
      return;
    }
    const cand = prevFlat.get(flat);
    if (cand !== undefined && cand.count === 1 && cand.from !== full) {
      trails.set(block, { from: cand.from, position: cand.position });
    }
  });
  return trails;
}

/**
 * The moment an update lands on the live view: the board becomes LIVING, and its answers follow the blocks.
 *  · the page's held answers are carried onto the NEW identity chain of every block the update moved, so a
 *    cross-container remount finds its dragged value on the spot (no network in the loop);
 *  · the door's state gains each block's identity key — from the page value, from the chain the block was
 *    carried or moved from, or from the position that block's own words were filed at before this update.
 *    A position nobody claimed keeps its bytes; once the door holds ANY identity key, no block may read a
 *    position again — a vacated slot leaves nothing behind for its next occupant to mistake for its own.
 * Runs for every update; once the door is fully carried it is a no-op walk.
 */
export async function promoteOnUpdate(
  rest: Rest | undefined, blockId: string, prev: unknown[] | null, next: unknown[],
): Promise<void> {
  living.add(blockId);
  const trails = trailsFrom(prev, next);
  // the page carries the moved block's whole held estate — its own fields and its child chains' answers —
  // onto the new identity chain, whatever the door can do
  eachSlot(next, (block, full) => {
    const came = trails.get(block);
    if (came === undefined || came.from === full) return;
    const from = `${blockId}\u0000${came.from}`;
    for (const [key, value] of [...stored]) {
      if (!key.startsWith(from)) continue;
      const suffix = key.slice(from.length);
      if (suffix !== "" && suffix[0] !== "/" && suffix[0] !== "~") continue;  // this block's own field keys and subtree
      const target = `${blockId}\u0000${full}${suffix}`;
      if (!stored.has(target)) stored.set(target, value);
    }
  });
  if (rest === undefined) return;
  const board = boards.get(blockId);
  if (board !== undefined && board.ready) {
    fileDoor(board, blockId, rest, next, trails);  // the door already answered: migrate on the spot
    return;
  }
  await loadBoardState(rest, blockId);
  const now = boards.get(blockId);
  if (now !== undefined) fileDoor(now, blockId, rest, next, trails);
}

function fileDoor(
  board: Board, blockId: string, rest: Rest, next: unknown[], trails: Map<object, Trail>,
): void {
  const state = board.state;
  const claimed = new Set<string>();
  let dirty = false;
  // every answer the page holds files under its identity door key
  const prefix = `${blockId}\u0000`;
  for (const [key, value] of stored) {
    if (!key.startsWith(prefix)) continue;
    const dk = kkey(key.slice(prefix.length));
    if (state[dk] === undefined) {
      state[dk] = value;
      dirty = true;
    }
  }
  // and the answers the door holds under a carried or moved chain, or an old position, follow their block
  eachSlot(next, (block, full) => {
    const key = kkey(full);
    if (state[key] !== undefined) return;
    const came = trails.get(block);
    if (came === undefined) return;
    const moved = came.from === full ? undefined : state[kkey(came.from)];
    if (moved !== undefined) {
      state[key] = moved;
      dirty = true;
      return;
    }
    if (came.position !== undefined && state[came.position] !== undefined && !claimed.has(came.position)) {
      state[key] = state[came.position];
      claimed.add(came.position);
      dirty = true;
    }
  });
  if (!dirty) return;
  const snapshot = { ...state };
  board.saving = board.saving
    .then(() => rest(`/blocks/${blockId}/state`, { method: "PUT", body: { state: snapshot } }))
    .then(() => {}, () => {});
}

// --- the headless update: migrating answers from the STORED archive ---------------------------------------------------
//
// The store takes an update at an address with no view anywhere: the chat quotes the board later, and the
// reopen must find answers that the mounted promote never got to move. Migration is tied to the VERSION
// TRANSITION, not to a mount — the map from old keys to new is computed from the STORED SPECS (the version
// archive), which exist whether or not anyone ever watched the board change. The rules the walk obeys:
//  · a legacy POSITION was only ever filed by a never-living board, and only version 1 was ever
//    non-living while holding that position (markLiving lands before any draw of a v≥2 board): so a
//    positional orphan resolves against the stored v1 spec — and against nothing else;
//  · an answer rides the same trail the mounted promote would have walked (the unique-flat move
//    matcher from trailsFrom), composed step by step across EVERY headless transition, each step
//    computed from the stored specs alone;
//  · a chain that survives a transition unchanged is its own trail (words and nesting untouched —
//    that string is what the reopened block will read);
//  · where retention cannot be CONFIRMED — the block's words are gone, its identity was never unique,
//    or an archived spec cannot be read — NOTHING is applied. Bytes that cannot move with proof are
//    left exactly where they are: inert, never erased, never worn by a stranger (the misfire guard).

/** The door's positional filing key ("0", "1.children.0"), same shape as the identity module recognizes. */
const POSITION_KEY = /^\d+(?:\.[A-Za-z_]+(?:\.\d+)*)*$/;

/** Split an identity door key into its chain and the sub-key field a kind may hang beside it ("~v").
 *  Chain segments are `<hex>:<occurrence>` joined by "/" and never hold a "~"; only fields do. */
function splitKKey(key: string): { chain: string; field: string } {
  const slot = key.slice(2);
  const tilde = slot.indexOf("~");
  return tilde < 0 ? { chain: slot, field: "" } : { chain: slot.slice(0, tilde), field: slot.slice(tilde) };
}

/**
 * The fresh mount of a version ≥ 2 board: carry every answer the door holds but NO current block
 * claims onto the key its block will read — using only the stored specs. Never rejects; never blocks
 * the draw beyond its own round trips; files nothing it cannot prove.
 *   loadVersion answers the read blocks of one archived version (empty/null when it cannot be read)
 */
export async function migrateArchived(
  rest: Rest | undefined, blockId: string,
  loadVersion: (version: number) => Promise<unknown[] | null>,
  next: unknown[], version: number,
): Promise<void> {
  living.add(blockId);
  if (rest === undefined || version < 2) return;
  if ((migratedWalk.get(blockId) ?? 0) >= version) return;
  migratedWalk.set(blockId, version);
  await loadBoardState(rest, blockId);
  const board = boards.get(blockId);
  if (board === undefined || !board.ready) return;  // the door did not answer: nothing is known, nothing is filed
  const state = board.state;
  const here = new Set<string>();
  eachSlot(next, (_block, full) => here.add(full));
  const orphans: string[] = [];
  for (const key of Object.keys(state)) {
    if (POSITION_KEY.test(key)) {
      orphans.push(key);  // a living board never reads a position: whatever sits there may not wear it
    } else if (key.startsWith("k:")) {
      if (!here.has(splitKKey(key).chain)) orphans.push(key);
    }
  }
  if (orphans.length === 0) return;
  const specs = new Map<number, unknown[] | null>([[version, next]]);
  const specOf = async (v: number): Promise<unknown[] | null> => {
    if (!specs.has(v)) {
      let read: unknown[] | null = null;
      try {
        const answer = await loadVersion(v);
        if (answer !== null && answer.length > 0) read = answer;
      } catch {
        read = null;  // the archive cannot say it: every answer behind that version stays unconfirmed
      }
      specs.set(v, read);
    }
    return specs.get(v) ?? null;
  };
  const chainsAt = async (v: number): Promise<Set<string> | null> => {
    const spec = await specOf(v);
    if (spec === null) return null;
    const set = new Set<string>();
    eachSlot(spec, (_block, full) => set.add(full));
    return set;
  };
  const stepMap = async (from: number, to: number): Promise<Map<string, string> | null> => {
    const prev = await specOf(from);
    const nx = await specOf(to);
    if (prev === null || nx === null) return null;
    const trails = trailsFrom(prev, nx);
    const map = new Map<string, string>();
    eachSlot(nx, (block, full) => {
      const came = trails.get(block);
      if (came !== undefined) map.set(came.from, full);
    });
    return map;
  };
  let position1: Map<string, string> | null | undefined;
  const positionsOfV1 = async (): Promise<Map<string, string> | null> => {
    if (position1 === undefined) {
      const spec = await specOf(1);
      position1 = spec === null ? null : (() => {
        const map = new Map<string, string>();
        eachSlot(spec, (block, full) => {
          const at = (block as { path?: unknown }).path;
          if (typeof at === "string") map.set(at, full);
        });
        return map;
      })();
    }
    return position1;
  };
  let dirty = false;
  for (const key of orphans) {
    const value = state[key];
    let chain: string;
    let field = "";
    let origin: number;
    if (key.startsWith("k:")) {
      const parts = splitKKey(key);
      chain = parts.chain;
      field = parts.field;
      origin = -1;
      for (let v = version - 1; v >= 1; v--) {
        const at = await chainsAt(v);
        if (at !== null && at.has(chain)) {
          origin = v;
          break;
        }
      }
      if (origin < 0) continue;  // no stored version says it filed this chain: unprovable, leave it
    } else {
      const slots = await positionsOfV1();
      if (slots === null) continue;  // version 1 cannot be read: nothing may be inferred about its slots
      const from = slots.get(key);
      if (from === undefined) continue;  // that slot held no block at v1 — or no filing ever came from it
      chain = from;
      origin = 1;
    }
    let cur = chain;
    let lost = false;
    for (let v = origin + 1; v <= version; v++) {
      const at = await chainsAt(v);
      if (at === null) {
        lost = true;
        break;  // a middle version is unreadable: the trail is broken, and a broken trail proves nothing
      }
      if (at.has(cur)) continue;  // the chain rode the transition unchanged — its own confirmed trail
      const moved = (await stepMap(v - 1, v))?.get(cur);
      if (moved === undefined) {
        lost = true;
        break;  // the block the answer belongs to is not this board's anymore (or was never unique)
      }
      cur = moved;
    }
    if (lost || !here.has(cur)) continue;  // the misfire guard: retention unconfirmed — the bytes stay put
    const target = kkey(cur + field);
    if (state[target] === undefined) {
      state[target] = value;
      dirty = true;
    }
  }
  if (!dirty) return;
  const snapshot = { ...state };
  board.saving = board.saving
    .then(() => rest(`/blocks/${blockId}/state`, { method: "PUT", body: { state: snapshot } }))
    .then(() => {}, () => {});
}

// --- Checklist ticks: the list of ticked item numbers, [0, 3] ------------------------------------------------------

/** Ticks after a tap on item `i`: an unticked item is ticked, a ticked one unticked; kept in order.
 *  [0, 3] tap 2 → [0, 2, 3];  [0, 3] tap 3 → [0] */
export function toggleTick(ticks: number[], i: number): number[] {
  if (ticks.includes(i)) return ticks.filter((t) => t !== i);
  return [...ticks, i].sort((a, b) => a - b);
}

/** What was saved for a checklist of `count` items, as ticks it can show; null when nothing usable was saved.
 *  [3, 0, 3] with 5 items → [0, 3];  [0, 9] with 5 items → [0] (item 9 isn't there);  "yes" → null;  undefined → null */
export function readTicks(saved: unknown, count: number): number[] | null {
  if (!Array.isArray(saved)) return null;
  const ticks = new Set<number>();
  for (const t of saved) {
    if (Number.isInteger(t) && t >= 0 && t < count) ticks.add(t);
  }
  return [...ticks].sort((a, b) => a - b);
}

/** What a checklist shows once its board's state arrives: the saved ticks, or the model's starting ticks when nothing
 *  is saved; but if the user tapped before it arrived (a slow connection), their taps, which are newer.
 *  saved [1, 2], not tapped → [1, 2];  nothing saved, started [0] → [0];  saved [1], tapped to [0, 1, 4] → [0, 1, 4] */
export function ticksAfterLoad(saved: number[] | null, onScreen: number[], tapped: boolean): number[] {
  if (tapped) return onScreen;
  return saved ?? onScreen;
}
