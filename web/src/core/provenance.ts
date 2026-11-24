// What a board's origins ARE, in one place: the first top-level source line and the sources the charts add
// beside it — once each, in draw order. On this base nothing is absorbed away from the drawing (a source line
// stays on the board where the board put it): this reading exists for the EXPORTS, so a file can never
// disagree with the board about where its data came from. lib/export.ts writes these words into the CSV
// comment record, the Markdown footer and the PNG's caption lines; host/ExportChrome.tsx hands them to it.
// A board that says nothing (no source line, no chart source) gets an empty line: an export of an ordinary
// board carries no provenance it did not have.
import type { Block } from "../registry";
import type { SourceBlock } from "../blocks/source/read";

export type BoardProvenance = {
  /** The first top-level source line, when the board has one. It STAYS drawn — this is a reading, not a move. */
  source?: SourceBlock;
  /** The charts' own sources: each one once, in draw order, never repeating the source line's own text. */
  chartSources: string[];
};

export function provenanceOf(blocks: Block[]): BoardProvenance {
  const at = blocks.findIndex((b) => b.type === "source");
  const source = at >= 0 ? (blocks[at] as SourceBlock) : undefined;
  const said = new Set<string>(source?.text ? [source.text] : []);
  const chartSources: string[] = [];
  for (const b of blocks) {  // charts say their own source; the line joins each once, in draw order
    if (b.type !== "chart") continue;
    const s = (b as { spec?: { source?: unknown } }).spec?.source;
    if (typeof s === "string" && s.trim() && !said.has(s)) {
      said.add(s);
      chartSources.push(s);
    }
  }
  return source ? { source, chartSources } : { chartSources };
}

/** The provenance as one plain line for exports: exactly the parts the board gave, in the order it gave them —
 *  the source line's own text, then the charts' sources. "" when the board said nothing.
 *  A source block that carries only a LIST (kind/accessed/note items, #38) says its whole truth in the
 *  Markdown body and the JSON envelope already; this one-line word stays what the reviewed feature made it:
 *  a single plain sentence, never a re-rendered list. */
export function provenanceLine(p: BoardProvenance): string {
  const parts: string[] = [];
  if (p.source?.text) parts.push(p.source.text);
  parts.push(...p.chartSources);
  return parts.join(" · ");
}
