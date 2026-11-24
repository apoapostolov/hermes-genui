// Reading stored blocks: JSON from the plugin's store → blocks the drawing code can draw. Each type's own reader
// in blocks/<type>/read.ts, with a comment and a worked example, listed in registry.tsx. The rule throughout:
// drop what doesn't fit and note why; never show broken data.
import { REGISTRY, type Block } from "../registry";
import {
  actsBeforeTheModel, align, boardId, firstText, keepFirst, NO_SEND, str, Trail, version,
  type Align, type Diagnostic,
} from "./fields";

/** Every block type that can be drawn, containers included. */
export const BLOCK_TYPES: string[] = Object.keys(REGISTRY);

/** One living-board link: another board by address, and the AI's one-line suggestion of how the two
 *  connect. The address names a stored board; the reader fetches it from the door when asked — reach-back
 *  without redrawing. */
export type BoardLink = { id: string; note?: string };

/** One tappable follow-up below the board: the short words shown on the pill, and the message a tap sends to
 *  the chat as the reader's own. */
export type FollowUp = { label: string; run: string };

/**
 * Stored JSON → its blocks, notes on what was dropped, and — for a board that speaks them — the words its
 * stored envelope carries: the living words (which version this is, when an update wrote it, what it links
 * to), the placement defaults (where the cards sit, how the words inside them read), its provenance (asOf:
 * when the data is from, one short line; live: true the figures update, false a snapshot, undefined the
 * board didn't say), and the quiet strip of taps the board offers under itself (followUps).
 * A lone block object is a list of one, and the store's {blocks: [...]} envelope is unwrapped. Anything
 * else gives no blocks.
 *   [{type: "heading", text: "Day 1"}, {type: "weather"}]
 *   → {blocks: [{type: "heading", text: "Day 1"}], dropped: [{path: "1", why: 'unknown type "weather"'}]}
 */
export function readBlocksNoted(data: unknown): {
  blocks: Block[]; dropped: Diagnostic[];
  version?: number; updatedAt?: string; links?: BoardLink[];
  align?: Align; textAlign?: Align; asOf?: string; live?: boolean; followUps?: FollowUp[];
} {
  let list: unknown = data;
  let boardVersion: number | undefined;
  let boardUpdatedAt: string | undefined;
  let boardLinks: BoardLink[] | undefined;
  let boardAlign: Align | undefined;
  let boardTextAlign: Align | undefined;
  let boardAsOf: string | undefined;
  let boardLive: boolean | undefined;
  let boardFollowUps: FollowUp[] | undefined;
  const top = new Trail();
  if (isObject(list) && Array.isArray((list as any).blocks)) {
    if (typeof (list as any).type !== "string") {
      // The envelope's own words: the living words (which version the address is on, when it was written,
      // what it connects to), the placement defaults (align sits the cards, text_align reads the words — the
      // same three words for both asks), where the board's data came from and when, and what the reader can
      // tap next. A block that merely spells its children `blocks` is not an envelope and says nothing here —
      // its type names a block, not a board.
      boardVersion = version((list as any).version);
      boardUpdatedAt = str((list as any).updated_at, 40);
      boardLinks = readBoardLinks((list as any).links, top.at("links"));
      boardAlign = align((list as any).align);
      boardTextAlign = align((list as any).text_align);
      boardAsOf = str((list as any).as_of, 80);  // cut the way every shown string is; junk gives nothing
      boardLive = typeof (list as any).live === "boolean" ? (list as any).live : undefined;
      boardFollowUps = readFollowUps((list as any).follow_ups, top.at("follow_ups"));
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
  const noted: {
    blocks: Block[]; dropped: Diagnostic[];
    version?: number; updatedAt?: string; links?: BoardLink[]; align?: Align; textAlign?: Align;
    asOf?: string; live?: boolean; followUps?: FollowUp[];
  } = { blocks, dropped: top.dropped };
  if (boardVersion !== undefined) noted.version = boardVersion;
  if (boardUpdatedAt !== undefined) noted.updatedAt = boardUpdatedAt;
  if (boardLinks !== undefined) noted.links = boardLinks;
  if (boardAlign !== undefined) noted.align = boardAlign;
  if (boardTextAlign !== undefined) noted.textAlign = boardTextAlign;
  if (boardAsOf !== undefined) noted.asOf = boardAsOf;
  if (boardLive !== undefined) noted.live = boardLive;
  if (boardFollowUps !== undefined) noted.followUps = boardFollowUps;
  return noted;
}

/** Just the blocks to draw. */
export function readBlocks(data: unknown): Block[] {
  return readBlocksNoted(data).blocks;
}

/** Where a block's own spec asked to be drawn, read by the board (core/Blocks.tsx); undefined when it didn't say.
 *  A drawing never reads it: placement is the board's business, kept off each block's props. */
export function alignOf(block: Block): Align | undefined {
  return (block as { align?: Align }).align;
}

/** How a block's own spec asked its words to read (text_align, the same three words as align); undefined when it
 *  didn't say. Like placement, only the board reads it — a drawing never does. */
export function textAlignOf(block: Block): Align | undefined {
  return (block as { text_align?: Align }).text_align;
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

/** The envelope's follow_ups, read like a row of action buttons: both halves needed (aliases included, the way
 *  `actions` takes them), a message Hermes acts on before the model is dropped with the note buttons have always
 *  carried, and at most four taps. The words themselves are kept WHOLE: the writer stored the entire prompt, and
 *  a tap that carried a cut version would be a different message than the board offered (and a cut label is a
 *  clipped label — length is the row's business to wrap, not the reader's to amputate). Nothing usable is
 *  nothing said: undefined, and the board draws no strip. */
function readFollowUps(value: unknown, here: Trail): FollowUp[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: FollowUp[] = [];
  value.forEach((item, i) => {
    const label = firstText([item?.label, item?.text], Infinity);
    const run = firstText([item?.run, item?.ask, item?.message], Infinity);
    if (!label || !run) {
      here.at(i).drop("button needs a label and a run message");
      return;
    }
    if (actsBeforeTheModel(run)) {
      here.at(i).drop(NO_SEND);
      return;
    }
    items.push({ label, run });
  });
  const kept = keepFirst(items, 4, here, "follow-ups");
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
  const blocks = Array.isArray(read) ? read : [read];
  // An ask the drawing didn't want for itself belongs to it: a row drawn as a stack places every block of the
  // stack where the row said, and reads its words the way the row said. (Blocks drawn inside a container that
  // survives are placed by the container, not here.)
  const asked = align((raw as any).align);
  if (asked) for (const block of blocks) if (alignOf(block) === undefined) Object.assign(block, { align: asked });
  const askedText = align((raw as any).text_align);
  if (askedText) for (const block of blocks) if (textAlignOf(block) === undefined) {
    Object.assign(block, { text_align: askedText });
  }
  return blocks;
}
