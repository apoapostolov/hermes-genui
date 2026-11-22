// The shapes every block type shares: how it is read from stored JSON and how it is drawn. registry.tsx holds one
// entry of this shape per type.
import type { ReactNode } from "react";
import type { Block } from "../registry";
import type { Trail } from "./fields";

/** Reads one item of a container's children into blocks (a flattened container gives several). Passed in by
 *  readBlocks.ts so a container's reader doesn't import it back. `depth` counts the containers above the item. */
export type ReadChild = (raw: unknown, here: Trail, depth: number) => Block[];

/** Stored JSON for one block → the block, several blocks (a container flattened in place), or null (dropped and noted
 *  on `here`). Most readers only look at `raw` and `here`; containers also use `depth` and `readChild`. */
export type Reader = (raw: any, here: Trail, depth: number, readChild: ReadChild) => Block | Block[] | null;

/** Draws a list of blocks; containers get it to draw their children. */
export type DrawChildren = (blocks: Block[]) => ReactNode[];

/** One block type: its reader and its drawing. A block whose children are its own authored data (a widget's view)
 *  draws them from the block and ignores `draw`. */
export type BlockEntry<B extends Block> = {
  read: Reader;
  Component: (props: { block: B; draw: DrawChildren }) => ReactNode;
};
