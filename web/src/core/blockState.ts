// Living Boards — a block's interactive answer belongs to the BOARD, keyed by the block's carried
// identity — not to the element. React cannot carry a DOM node across parents, and a reopen draws a
// fresh tree from the stored spec anyway; so every answer (a dragged slider, a typed form draft, a
// picked tab, a checklist's ticks) is filed in the board's state store
// (blocks/checklist/savedState.ts) and restored on EVERY mount: the page's store first — a move
// remounts in the same tick, before any network — and the state door second, which is where a reopen,
// a reload and another device read it.
//
// The key is the block's identity chain (core/living-identity.ts): its own words plus its occurrence
// among same-worded siblings, hung on the chain of identity blocks above it — the same string at the
// mount, at an update's promote and at a reopen drawn from the stored spec, in any parent, at any
// depth. EVERY answer reaches the board AT EDIT TIME while mounted. Transient answers (kind "identity")
// file under the block's identity key from the very first move — whether or not an update has ever
// landed — so the first addressed update, mounted OR headless, migrates them by identity and a reopen
// restores them; no page-only ephemeral interactive state remains for the kinds this board state owns.
// PERSISTED answers (kind "always" — a checklist's ticks, a sent form record) keep their POSITIONAL
// filing on a never-updated board — the door key IS the path — and switch to identity when the first
// update makes the board living.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { BlockActions } from "../host/actions";
import { kkey } from "./living-identity";
import { loadBoardState, peekStored, recordValue, seedValue, isLiving } from "../blocks/checklist/savedState";

/** The identity chain of the block being drawn, composed by drawAll (core/Blocks.tsx) from the flat
 *  identity of this block and every identity block above it. Outside a drawn board — a bare component
 *  in a unit test, a preview — there is no chain and nothing here changes what draws. */
export const BlockSlot = createContext<string | null>(null);

export type Stored<T> = {
  /** The block's positional path ("0", "1.children.2") — only checklist and form carry one; it stays the
   *  door filing key for "always" answers until the board is living, and never keys an "identity" one. */
  path?: string;
  /** "always" — a PERSISTED answer: the door saves every change at once, the accepted board-state
   *  semantics (position until living, identity after).
   *  "identity" — a TRANSIENT answer (slider, tab, unsent draft): the door files it under the block's
   *  identity key AT EDIT TIME, living or not. There is no page-only path for these kinds: an answer
   *  released with a view is the board's own, never an element's. */
  door: "always" | "identity";
  /** A sub-key where one block keeps more than one answer (a form's draft beside its sent record). */
  field?: string;
  initial: () => T;
  /** The stored bytes as a value to draw, or null when they say nothing usable. */
  revive: (saved: unknown) => T | null;
  /** What the store keeps: JSON-safe. */
  stored: (value: T) => unknown;
  /** Asked when the door's answer arrives: true means a value on screen this one must not stomp (a
   *  sent form's answers outrank the draft typed before the send). */
  skip?: () => boolean;
};

/**
 * A block's value that lives on the board: mounted from the page's store (identity chain) at once,
 * from the state door when it answers, and from the spec when neither holds an answer. Every commit
 * files on the page AND — for every interactive kind, at edit time — on the server, coalesced for
 * transient answers and immediate for persisted ones. A mount with no board behind it (no blockId,
 * no chain) is the plain state the block always had.
 */
export function useStoredValue<T>(spec: Stored<T>): [T, (next: T, touched?: boolean) => void] {
  const { rest, blockId } = useContext(BlockActions);
  const chain = useContext(BlockSlot);
  const living = blockId !== undefined && chain !== null && isLiving(blockId);
  const idKey = chain === null ? null : `${chain}${spec.field ?? ""}`;       // the page store: identity only
  const legacy = `${spec.path ?? ""}${spec.field ?? ""}`;                    // the positional key
  // A transient answer's door key is its identity, always (there is no positional filing
  // for sliders, drafts or tabs — the legacy key for them is the empty string, which must never
  // reach the door). A persisted answer keeps the accepted age rule: position until living.
  const transient = spec.door === "identity";
  const byIdentity = transient ? idKey !== null : living && idKey !== null;
  const doorKey = byIdentity && idKey !== null ? kkey(idKey) : legacy;
  const touched = useRef(false);

  const [value, setValue] = useState<T>(() => {
    // The page's store is the board's memory. A persisted answer on a board that was never updated
    // mounts from the spec and reads the door's POSITIONAL bytes below — the accepted truth. A
    // transient answer mounts from the page mirror even before the door speaks (an answer released
    // with a view is the board's own, never an element's).
    if (blockId === undefined || idKey === null) return spec.initial();
    if (!byIdentity) return spec.initial();
    const held = peekStored(blockId, idKey);
    if (held === undefined) return spec.initial();
    return spec.revive(held.value) ?? spec.initial();
  });

  useEffect(() => {
    if (!rest || blockId === undefined) return;
    // The door holds transient answers from the edit onward, so every mount asks it. (With no chain
    // there is no identity to ask under: a bare component preview stays exactly as plain as it draws.)
    if (transient && idKey === null) return;
    let live = true;
    void loadBoardState(rest, blockId).then((state) => {
      if (!live || touched.current || (spec.skip?.() ?? false)) return;
      const saved = seedValue(state, doorKey);
      if (saved === undefined) return;
      const revived = spec.revive(saved);
      if (revived !== null) setValue(revived);
    });
    return () => {
      live = false;
    };
  }, [rest, blockId, doorKey, living]);

  const commit = (next: T, isTouched = true) => {
    if (isTouched) touched.current = true;
    setValue(next);
    if (blockId === undefined) return;
    if (!isTouched) return;  // a value the block itself never chose (a door answer replayed) re-saves nothing
    if (transient && idKey === null) return;  // no chain, no identity, nothing to file but the screen
    const door = !rest ? "never" : spec.door === "always" ? "now" : "coalesce";
    recordValue(rest, blockId, idKey, doorKey, spec.stored(next), door);
  };

  return [value, commit];
}
