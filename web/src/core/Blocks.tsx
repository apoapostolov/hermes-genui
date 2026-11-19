// Draws a list of blocks in order. Each type's drawing is its entry in registry.tsx; containers draw their children
// through the same lookup. One list is one board: its blocks share which flow node a steps block has lit.
// Each block draws inside its own error boundary, so one that throws leaves a small note and the rest of the board.
import { Component as ReactComponent, type ErrorInfo, type ReactNode } from "react";
import { FlowLightBoard } from "../blocks/flow/highlight";
import { REGISTRY, type Block } from "../registry";
import type { BlockEntry } from "./types";

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

function drawAll(blocks: Block[]): ReactNode[] {
  return blocks.map((b, i) => <BlockView key={i} block={b} />);
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return <div className="hb-blocks"><FlowLightBoard>{drawAll(blocks)}</FlowLightBoard></div>;
}
