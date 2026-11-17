// A board is drawn, not described: a block is announced by words it already shows, so nothing new has to be written
// into the JSON. One ladder serves every type — the title the block draws, then what it draws (a chart's series), then
// the model's group `name` (kpis, tiles and actions only), then the type in words. Names are never copied into
// aria-label when the block shows them: the element that draws the title gets an id from useId() and the block's root
// points at it with aria-labelledby.
import { useId } from "react";
import { str } from "./fields";

/** What a block type is called when it names nothing itself: a chart with no title is "Chart", not "region". */
const KIND_WORDS = {
  actions: "Actions",
  calendar: "Calendar",
  chart: "Chart",
  checklist: "Checklist",
  flow: "Flow",
  form: "Form",
  heatmap: "Heat map",
  kpis: "Figures",
  list: "List",
  progress: "Progress",
  section: "Section",
  steps: "Steps",
  table: "Table",
  tiles: "Choices",
  timeline: "Timeline",
} as const;

export type NamedKind = keyof typeof KIND_WORDS;

/** The name ladder as one function: the first of `words` that holds text, else the type in words.
 *   ("chart", ["Revenue vs profit", "Revenue, Net profit"]) → "Revenue vs profit"
 *   ("chart", [undefined, "Revenue, Net profit"])           → "Revenue, Net profit"
 *   ("chart", [undefined, undefined])                       → "Chart"
 *   ("kpis", [undefined, "This week"])                      → "This week"
 */
export function blockName(kind: NamedKind, words: (string | undefined)[]): string {
  for (const w of words) {
    const text = str(w, 90);
    if (text !== undefined) return text;
  }
  return KIND_WORDS[kind];
}

/** Where a block's name lives: `title.id` goes on the element that draws the title, `root` on the block itself. */
export type Named = {
  /** Spread on the element that draws the block's title. */
  title: { id: string };
  /** Spread on the block's root: a reference to the title it draws, or the ladder's words when it draws none. */
  root: { "aria-labelledby"?: string; "aria-label"?: string };
  /** The words the block is announced by (the title itself when it draws one). */
  name: string;
};

/** A block's name, ready to spread. `shown` is the title the block draws, when it draws one; `derived` holds the
 *  ladder's other steps, best first (a chart's series names, then the model's group `name`).
 *   useNamed("progress", "Level 4")             → root aria-labelledby, title id
 *   useNamed("kpis", undefined, [raw.name])     → root aria-label "This week", else "Figures"
 */
export function useNamed(kind: NamedKind, shown: string | undefined, derived: (string | undefined)[] = []): Named {
  const id = useId();
  const name = blockName(kind, [shown, ...derived]);
  const drawsTitle = str(shown, 90) !== undefined;
  return { title: { id }, name, root: drawsTitle ? { "aria-labelledby": id } : { "aria-label": name } };
}

/** The words a chart is announced by when it has no title of its own: its series, in the order it draws them.
 *   [{name: "Revenue"}, {name: "Net profit"}] → "Revenue, Net profit";  [{}] → undefined
 */
export function seriesWords(specs: { name?: string }[]): string | undefined {
  const names = specs.map((s) => str(s.name, 40)).filter((n): n is string => n !== undefined);
  return names.length ? names.join(", ") : undefined;
}
