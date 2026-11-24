// Draws a list of blocks in order. Each type's drawing is its entry in registry.tsx; containers draw their children
// through the same lookup. One list is one board: its blocks share which flow node a steps block has lit.
// Each block draws inside its own error boundary, so one that throws leaves a small note and the rest of the board.
// Living Boards: each block also carries its identity SLOT down through BlockSlot (the chain the board files a
// block's answers under — context only, no DOM), and a list an update has CARRIED is keyed by carried identity, so
// React reconciles each surviving drawing onto the very element already mounted. A plain list — every unsaid board,
// every first draw — keeps the accepted index keys, byte for byte.
// Where a block sits across its column or cell is the board's placement, resolved for every block wherever it sits:
// `align` says it per block (readBlocks.ts), `boardAlign` defaults it for every block that didn't ask, and a block
// that says nothing on a board that says nothing sits left as it always has. The model's cascade — block, board,
// left — is the whole rule; the reader has no override. Containers draw their children through this same placement,
// so a child's own word and the board's default both reach inside a grid, row, columns, section or tab panel; each
// block is placed within the cell it already had, and the cell keeps the layout it owns.
// The same block also answers for how the words read inside the blocks that carry words (heading, text, stat,
// callout): `text_align` per block, `boardTextAlign` for every block that didn't ask, left when neither says.
// A block wrapped for placement, for its text voice, or for both, gets the one wrapper; a board with no ask
// anywhere draws the same DOM it always did.
// A board whose envelope declares provenance (asOf or live) also grows a quiet footer — its source, when its data
// is from, and the word Live or Snapshot. The source part joins both attributions the board says: its first
// top-level source block — drawn there rather than twice on the board — and the `source` each chart block carries,
// deduped in draw order (the chart keeps its inline line). The absorbed source sits on its own row of the footer
// column, beside the join line of everything else. A board that declares nothing draws exactly what it always
// drew: no footer, no new nodes.
import { Component as ReactComponent, createContext, Fragment, useContext, type ErrorInfo, type ReactNode } from "react";import { FlowLightBoard } from "../blocks/flow/highlight";
import type { SourceBlock } from "../blocks/source/read";
import { REGISTRY, type Block } from "../registry";
import type { BlockEntry } from "./types";
import { BlockSlot } from "./blockState";
import { carriedKey, identityOf, mintKey, noteMounted } from "./living-identity";
import type { Align } from "./fields";
import { alignOf, textAlignOf } from "./readBlocks";

/** The two board-wide voices, carried down so every block — top level or nested — resolves both the same way:
 *  `board` places the cards, `text` says how the words inside the blocks that carry text should read. */
const AlignScope = createContext<{ board?: Align; text?: Align }>({ board: undefined, text: undefined });

/** The blocks whose whole draw is words, where a text voice has something to move. A drawing that owns a layout
 *  (a chart, a table, photos, any container) is never re-typed by the board: the ask is simply not drawn there.
 *  A kind joins this set only where its words fill a line box wide enough for the voice to distribute them —
 *  Chrome measures every kind below at real word position (tests/test_layout_alignment.py); a shrink-wrapped text
 *  container (the callout body) is opened for the ask in tokens.css, never by default. */
const TEXT_BEARING: ReadonlySet<string> = new Set(["heading", "text", "stat", "callout"]);


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

/** One block with its identity slot hung on the chain of the blocks above it, drawn inside its place. Context
 *  only for the slot: a placed board wraps the block in a .hb-place box, an unplaced one draws exactly the DOM
 *  it always drew — byte for byte, keys and all. */
function Slotted({ block, flat }: { block: Block; flat: string }) {
  const parent = useContext(BlockSlot);
  const slot = parent === null ? flat : `${parent}/${flat}`;
  return <BlockSlot.Provider value={slot}><Placed block={block} /></BlockSlot.Provider>;
}

/** The drawing path every block takes, top level or nested: children come back slotted and placed, exactly like
 *  the board's own list. */
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

/** One block wherever it sits: wrapped in its place when it sits away from left, and marked with its text voice
 *  when it carries words and they are asked to read other than left. Either ask grows the one wrapper; nothing
 *  asked for, nothing added — the board draws exactly the DOM it always drew. */
function Placed({ block }: { block: Block }) {
  const { board, text } = useContext(AlignScope);
  const at = alignOf(block) ?? board ?? "left";
  const ta = TEXT_BEARING.has(block.type) ? textAlignOf(block) ?? text ?? "left" : "left";
  const view = <BlockView block={block} />;
  if (at === "left" && ta === "left") return view;
  const cls = ["hb-place"];
  if (at !== "left") cls.push(`hb-place-${at}`);
  if (ta !== "left") cls.push(`hb-ta-${ta}`);
  return (
    <div className={cls.join(" ")} {...(at !== "left" ? { "data-align": at } : {})}
      {...(ta !== "left" ? { "data-text-align": ta } : {})}>{view}</div>
  );
}

/** What a board declares about its data: asOf — one quiet date line, live — whether the figures move. */
export type Provenance = { asOf?: string; live?: boolean };

/** The quiet footer of a board that declares where its data came from and when. Only the parts the board
 *  gave are shown: the first top-level source block (absorbed here, drawn not twice on the board), each
 *  chart's own `source` once in draw order, the date, and the badge — Live or Snapshot, always its word,
 *  never colour alone. A board that declares nothing never reaches this component. */
function ProvenanceFooter({ source, chartSources, asOf, live }: {
  source?: SourceBlock; chartSources?: string[]; asOf?: string; live?: boolean;
}) {
  const parts: ReactNode[] = [];
  const add = (key: string, node: ReactNode) => {
    if (parts.length) parts.push(<span key={`${key}-dot`} className="hb-provenance-dot" aria-hidden="true">·</span>);
    parts.push(<Fragment key={key}>{node}</Fragment>);
  };
  for (const [i, s] of (chartSources ?? []).entries()) {
    add(`chart-${i}`, <span className="hb-provenance-source">{s}</span>);
  }
  if (asOf) add("as_of", <span className="hb-provenance-time">{asOf}</span>);
  if (live !== undefined) {
    add("live", <span className="hb-provenance-badge" data-live={live ? "live" : "snapshot"}>{live ? "Live" : "Snapshot"}</span>);
  }
  return (
    <div className="hb-provenance">
      {source && drawAll([source])}
      <div className="hb-provenance-line">{parts}</div>
    </div>
  );
}

export function Blocks({ blocks, boardAlign, boardTextAlign, provenance }: {
  blocks: Block[]; boardAlign?: Align; boardTextAlign?: Align; provenance?: Provenance;
}) {
  const declared = provenance?.asOf !== undefined || provenance?.live !== undefined;
  let list = blocks;
  let source: SourceBlock | undefined;
  const chartSources: string[] = [];
  if (declared) {  // the first top-level source line belongs to the footer, not twice on the board
    const at = blocks.findIndex((b) => b.type === "source");
    if (at >= 0) {
      source = blocks[at] as SourceBlock;
      list = blocks.filter((_, i) => i !== at);
    }
    const said = new Set<string>(source?.text ? [source.text] : []);
    for (const b of list) {  // charts say their own source; the line joins each once, in draw order
      if (b.type !== "chart") continue;
      const s = b.spec.source;
      if (typeof s === "string" && s.trim() && !said.has(s)) {
        said.add(s);
        chartSources.push(s);
      }
    }
  }
  return (
    <AlignScope.Provider value={{ board: boardAlign, text: boardTextAlign }}>
      <div className="hb-blocks">
        <FlowLightBoard>{drawAll(list)}</FlowLightBoard>
        {declared && (
          <ProvenanceFooter source={source} chartSources={chartSources}
            asOf={provenance?.asOf} live={provenance?.live} />
        )}
      </div>
    </AlignScope.Provider>
  );
}
