import { clean, keepFirst, num, str, type Trail } from "../../core/fields";

/** A checkpoint's label is text, or a number the drawing writes in the block's unit (250000 with "₹" → "₹2.5L"). */
export type Step = { label: string | number; at: number };
/** The three tones a fill, a band or a segment can take. "bad" is its own red here; the badge atom folds it into warn. */
export type Tone = "good" | "warn" | "bad";
/** bar (the plain track), ring (a full circle) or gauge (an open arc). */
export type Shape = "line" | "circle" | "dashboard";
/** A mark on the track. A mark with a `tone` colours the band that ends at it. */
export type Threshold = { at: number; label?: string | number; tone?: Tone };
/** One part of the track, drawn from where the last one ended. */
export type Segment = { value: number; label?: string; tone?: Tone };
/** `value` and `goal` may be null: a reading nobody took. Either draws an empty track and reads "no data" in its
 *  place, so a model that doesn't know the figure keeps the card instead of writing a 0. */
export type ProgressBlock = {
  type: "progress"; title: string; value: number | null; goal: number | null; unit?: string; steps: Step[];
  shape?: Shape; show_percent?: boolean; tone?: Tone; thresholds?: Threshold[]; segments?: Segment[];
};

const TONES: Record<string, Tone> = {
  good: "good", success: "good", positive: "good", ok: "good",
  warn: "warn", warning: "warn", caution: "warn",
  bad: "bad", danger: "bad", negative: "bad", error: "bad",
};
const SHAPES: Record<string, Shape> = { line: "line", bar: "line", circle: "circle", ring: "circle", dashboard: "dashboard", gauge: "dashboard" };

/** A tone word → good, warn or bad; anything else is undefined (the drawing then keeps the block's own tone).
 *  "warning" → "warn";  "danger" → "bad";  "blue" → undefined */
export function progressTone(v: unknown): Tone | undefined {
  return typeof v === "string" ? TONES[v.toLowerCase()] : undefined;
}

/** A shape word → line, circle or dashboard; anything else is undefined (a plain bar).
 *  "ring" → "circle";  "gauge" → "dashboard";  "pie" → undefined */
function progressShape(v: unknown): Shape | undefined {
  return typeof v === "string" ? SHAPES[v.toLowerCase()] : undefined;
}

/** One checkpoint: a label (text or a number) and where it sits. Returns null after noting what was dropped. */
function readStep(raw: any, here: Trail): Step | null {
  const label = str(raw?.label, 28) ?? num(raw?.label);
  const at = num(raw?.at);
  if (label === undefined || label === null || at === null) {
    return here.drop("checkpoint needs a label and a number `at`");
  }
  return { label, at };
}

/** One mark: a number `at`, and optionally a label and a tone. */
function readThreshold(raw: any, here: Trail): Threshold | null {
  const at = num(raw?.at);
  if (at === null) return here.drop("threshold needs a number `at`");
  const label = str(raw?.label, 28) ?? num(raw?.label);
  return clean({ at, label: label === null ? undefined : label, tone: progressTone(raw?.tone) });
}

/** One segment: a number `value` (its share of the goal), and optionally a label and a tone. */
function readSegment(raw: any, here: Trail): Segment | null {
  const value = num(raw?.value);
  if (value === null || value < 0) return here.drop("segment needs a number `value` of 0 or more");
  return clean({ value, label: str(raw?.label, 28), tone: progressTone(raw?.tone) });
}

/**
 * progress: how far value is towards goal, with up to 6 checkpoints sorted by where they sit. A checkpoint needs a
 * label (text or a number) and a number `at`; a broken one is dropped with a note.
 *   {type: "progress", title: "Level 4", value: 95, goal: 120, steps: [{label: "90 XP", at: 90}, {label: "30 XP", at: 30}, {label: "bad"}]}
 *   → {type: "progress", title: "Level 4", value: 95, goal: 120, steps: [{label: "30 XP", at: 30}, {label: "90 XP", at: 90}]}
 *   steps: [{label: 250000, at: 250000}] → the same (drawn "₹2.5L" with unit "₹")
 * A shape (line | circle | dashboard), show_percent for the figure, an overall tone, up to 6 thresholds (marks, and the
 * bands between them) and up to 5 segments (parts of the whole, in order) are optional:
 *   {type: "progress", title: "Load", value: 88, goal: 100, unit: "%", shape: "dashboard",
 *    thresholds: [{at: 60, tone: "good"}, {at: 85, tone: "warn"}, {at: 100, tone: "bad"}]}
 *   → the same, drawn as a gauge whose fill is red
 * Thresholds replace steps when both are given (a track has marks or checkpoints, not both).
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

  const thresholds: Threshold[] = [];
  const rawThresholds = Array.isArray(raw.thresholds) ? raw.thresholds : [];
  rawThresholds.forEach((t: any, i: number) => {
    const mark = readThreshold(t, here.at("thresholds").at(i));
    if (mark) thresholds.push(mark);
  });
  thresholds.sort((a, b) => a.at - b.at);

  const steps: Step[] = [];
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (thresholds.length && rawSteps.length) {
    here.at("steps").drop("thresholds replace steps");
  } else {
    rawSteps.forEach((st: any, i: number) => {
      const step = readStep(st, here.at("steps").at(i));
      if (step) steps.push(step);
    });
    steps.sort((a, b) => a.at - b.at);
  }

  const segments: Segment[] = [];
  const rawSegments = Array.isArray(raw.segments) ? raw.segments : [];
  rawSegments.forEach((s: any, i: number) => {
    const segment = readSegment(s, here.at("segments").at(i));
    if (segment) segments.push(segment);
  });

  return clean({
    type: "progress" as const, title, value, goal, unit: str(raw.unit, 12),
    shape: progressShape(raw.shape),
    show_percent: raw.show_percent === true ? true : undefined,
    tone: progressTone(raw.tone),
    steps: keepFirst(steps, 6, here, "checkpoints"),
    thresholds: thresholds.length ? keepFirst(thresholds, 6, here, "thresholds") : undefined,
    segments: segments.length ? keepFirst(segments, 5, here, "segments") : undefined,
  });
}
