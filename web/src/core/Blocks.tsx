// Draws a list of blocks in order. Each type's drawing is its entry in registry.tsx; containers draw their children
// through the same lookup. One list is one board: its blocks share which flow node a steps block has lit.
// Each block draws inside its own error boundary, so one that throws leaves a small note and the rest of the board.
// Living Boards: each block also carries its identity SLOT down through BlockSlot (the chain the board files a
// block's answers under — context only, no DOM), and a list an update has CARRIED is keyed by carried identity, so
// React reconciles each surviving drawing onto the very element already mounted. A plain list — every unsaid board,
// every first draw — keeps the accepted index keys, byte for byte.
import { Component as ReactComponent, useContext, type ErrorInfo, type ReactNode } from "react";
import { FlowLightBoard } from "../blocks/flow/highlight";
import { REGISTRY, type Block } from "../registry";
import type { BlockEntry } from "./types";
import { BlockSlot } from "./blockState";
import { carriedKey, identityOf, mintKey, noteMounted } from "./living-identity";

function BlockView({ block }: { block: Block }) {
  const entry = REGISTRY[block.type] as BlockEntry<Block> | undefined;
  if (!entry) return null;
  const { Component } = entry;
  return <Contained block={block}><Component block={block} draw={drawAll} /></Contained>;
}

/** Catches a block that throws while drawing: it becomes a one-line note, and the block and error are logged, so the
 *  board can be turned into a test case. Its siblings and the blocks around its container still draw.
 *  [text "Before", kpis with items: null, text "After"] → Before · "This part couldn't be drawn." · After */
class Contained extends ReactComponent<{ block: Block; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error(`hermes-genui: a "${this.props.block.type}" block failed to draw`, this.props.block, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <p className="hb-block-failed" role="note">This part couldn't be drawn.</p>;
  }
}

/** The key one block draws under: the carried one if an update handed it on (and the block was mounted before),
 *  a fresh mint inside a carried list, else the accepted index key. drawAll records what it mounted, so the next
 *  carry can hand that very key on. */
function blockKey(b: Block, i: number, carried: boolean): string | number {
  const asked = carriedKey(b as object);
  if (asked !== undefined) { noteMounted(b as object, asked); return asked; }
  if (carried) { const fresh = mintKey(b); noteMounted(b as object, fresh); return fresh; }
  noteMounted(b as object, String(i));
  return i;
}

/** One block with its identity slot hung on the chain of the blocks above it. Context only: a drawn board's DOM
 *  is exactly what it was, and the flat identity (`own words hash:occurrence among same-worded siblings`) is
 *  counted the one way living-identity counts it, so keys and state slots can never disagree. */
function Slotted({ block, flat }: { block: Block; flat: string }) {
  const parent = useContext(BlockSlot);
  const slot = parent === null ? flat : `${parent}/${flat}`;
  return <BlockSlot.Provider value={slot}><BlockView block={block} /></BlockSlot.Provider>;
}

/** The drawing path every container gets. */
function drawAll(blocks: Block[]): ReactNode[] {
  const seen = new Map<string, number>();
  const carried = blocks.some((b) => carriedKey(b as object) !== undefined);
  return blocks.map((b, i) => {
    const id = identityOf(b);
    const occ = seen.get(id) ?? 0;
    seen.set(id, occ + 1);
    return <Slotted key={blockKey(b, i, carried)} block={b} flat={`${id}:${occ}`} />;
  });
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return <div className="hb-blocks"><FlowLightBoard>{drawAll(blocks)}</FlowLightBoard></div>;
}
