import { clean, keepFirst, num, str, type Trail } from "../../core/fields";

/** A checkpoint's label is text, or a number the drawing writes in the block's unit (250000 with "₹" → "₹2.5L"). */
export type Step = { label: string | number; at: number };
/** `value` and `goal` may be null: a reading nobody took. Either draws an empty track and reads "no data" in its
 *  place, so a model that doesn't know the figure keeps the card instead of writing a 0. */
export type ProgressBlock = { type: "progress"; title: string; value: number | null; goal: number | null; unit?: string; steps: Step[] };

/**
 * progress: how far value is towards goal, with up to 6 checkpoints sorted by where they sit. A checkpoint needs a
 * label (text or a number) and a number `at`; a broken one is dropped with a note.
 *   {type: "progress", title: "Level 4", value: 95, goal: 120, steps: [{label: "90 XP", at: 90}, {label: "30 XP", at: 30}, {label: "bad"}]}
 *   → {type: "progress", title: "Level 4", value: 95, goal: 120, steps: [{label: "30 XP", at: 30}, {label: "90 XP", at: 90}]}
 *   steps: [{label: 250000, at: 250000}] → the same (drawn "₹2.5L" with unit "₹")
 *   {type: "progress", title: "Level 5", value: null, goal: 120} → kept, value null (an unknown reading, not a 0)
 * Dropped: no title, a value or goal that isn't a number and isn't null, or a goal of 0 or less.
 */
export function readProgress(raw: any, here: Trail): ProgressBlock | null {
  const title = str(raw.title, 40);
  if (!title) return here.drop("progress needs a title");
  const value = num(raw.value);
  if (value === null && raw.value !== null) return here.drop("progress needs a numeric value");
  const goal = num(raw.goal);
  if (goal === null && raw.goal !== null) return here.drop("progress needs a goal above 0");
  if (goal !== null && goal <= 0) return here.drop("progress needs a goal above 0");

  const steps: Step[] = [];
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  rawSteps.forEach((st: any, i: number) => {
    const label = str(st?.label, 28) ?? num(st?.label);
    const at = num(st?.at);
    if (label === undefined || label === null || at === null) {
      here.at("steps").at(i).drop("checkpoint needs a label and a number `at`");
      return;
    }
    steps.push({ label, at });
  });
  steps.sort((a, b) => a.at - b.at);
  return clean({ type: "progress" as const, title, value, goal, unit: str(raw.unit, 12), steps: keepFirst(steps, 6, here, "checkpoints") });
}
