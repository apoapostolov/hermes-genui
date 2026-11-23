// Reading stored blocks: JSON from the plugin's store → blocks the drawing code can draw. Each type has its own reader
// in blocks/<type>/read.ts, with a comment and a worked example, listed in registry.tsx. The rule throughout: drop what
// doesn't fit and note why; never show broken data.
import { REGISTRY, type Block } from "../registry";
import { boardId, keepFirst, Trail, version, type Diagnostic, str } from "./fields";

/** Every block type that can be drawn, containers included. */
export const BLOCK_TYPES: string[] = Object.keys(REGISTRY);

/** One living-board link: another board by address, and the AI's one-line suggestion of how the two
 *  connect. The address names a stored board; the reader fetches it from the door when asked — reach-back
 *  without redrawing. */
export type BoardLink = { id: string; note?: string };

/**
 * Stored JSON → its blocks, notes on what was dropped, and — for a board that speaks them — the living
 * words its stored envelope carries: which version this is, when an update wrote it, and what it links to.
 * A lone block object is a list of one, and the store's {blocks: [...]} envelope is unwrapped. Anything
 * else gives no blocks.
 *   [{type: "heading", text: "Day 1"}, {type: "weather"}]
 *   → {blocks: [{type: "heading", text: "Day 1"}], dropped: [{path: "1", why: 'unknown type "weather"'}]}
 */
export function readBlocksNoted(data: unknown): {
  blocks: Block[]; dropped: Diagnostic[];
  version?: number; updatedAt?: string; links?: BoardLink[];
} {
  let list: unknown = data;
  let boardVersion: number | undefined;
  let boardUpdatedAt: string | undefined;
  let boardLinks: BoardLink[] | undefined;
  const top = new Trail();
  if (isObject(list) && Array.isArray((list as any).blocks)) {
    if (typeof (list as any).type !== "string") {
      // The envelope's own words (Living Boards): which version the address is on, when it was written,
      // and what it connects to. A block that merely spells its children `blocks` is not an envelope
      // and says nothing here — its type names a block, not a board.
      boardVersion = version((list as any).version);
      boardUpdatedAt = str((list as any).updated_at, 40);
      boardLinks = readBoardLinks((list as any).links, top.at("links"));
    }
    list = (list as any).blocks;
  }
  if (isObject(list) && typeof (list as any).type === "string") list = [list];
  const blocks: Block[] = [];
  if (Array.isArray(list)) {
    list.forEach((raw, i) => {
      blocks.push(...readOne(raw, top.at(i), 0));
    });
  }
  const noted: { blocks: Block[]; dropped: Diagnostic[]; version?: number; updatedAt?: string; links?: BoardLink[] } =
    { blocks, dropped: top.dropped };
  if (boardVersion !== undefined) noted.version = boardVersion;
  if (boardUpdatedAt !== undefined) noted.updatedAt = boardUpdatedAt;
  if (boardLinks !== undefined) noted.links = boardLinks;
  return noted;
}

/** Just the blocks to draw. */
export function readBlocks(data: unknown): Block[] {
  return readBlocksNoted(data).blocks;
}

function isObject(v: unknown): boolean {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** The envelope's links to other boards: at most three, each either a bare address or {id, note}. A link
 *  that names no address is dropped with a note (the writer refused it at show_blocks too; the reader
 *  never shows what it cannot open). The note — the AI's one-line suggestion of how the boards connect —
 *  is kept the way every shown word that carries the point is. Nothing usable is nothing said: undefined,
 *  and the board draws no links row. */
function readBoardLinks(value: unknown, here: Trail): BoardLink[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: BoardLink[] = [];
  value.forEach((item, i) => {
    const id = boardId(typeof item === "string" ? item : item?.id);
    if (!id) {
      here.at(i).drop("a link must name a board by its address");
      return;
    }
    const note = typeof item === "object" && item !== null ? str(item.note, 80) : undefined;
    items.push(note ? { id, note } : { id });
  });
  const kept = keepFirst(items, 3, here, "links");
  return kept.length ? kept : undefined;
}

/** One item (top level or a container's child) → zero, one or several blocks (a flattened container gives its
 *  children). `depth` counts the containers above it. */
function readOne(raw: unknown, here: Trail, depth: number): Block[] {
  if (!isObject(raw)) {
    here.drop("not a block object");
    return [];
  }
  const kind = (raw as any).type;
  const entry = Object.hasOwn(REGISTRY, kind) ? REGISTRY[kind as Block["type"]] : undefined;
  if (!entry) {
    here.drop(`unknown type "${kind}"`);
    return [];
  }
  const read = entry.read(raw, here, depth, readOne);
  if (!read) return [];
  return Array.isArray(read) ? read : [read];
}
