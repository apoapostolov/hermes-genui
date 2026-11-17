// A milestone track: checkpoints done (ticked) or still locked, and how far along "value / goal" is.
import type { ProgressBlock, Step } from "./read";
import { Icon } from "../../lib/Icon";
import { fmt } from "../chart/chartData";
import { useNamed } from "../../core/a11y";

/**
 * How much of the track is filled, from 0 to 1. With no checkpoints it is value / goal. With checkpoints they sit
 * evenly along the track, and the fill reaches between two of them in proportion to the value. Worked examples:
 *   (30, 120, [])                     → 0.25
 *   (150, 120, [])                    → 1 (never past full)
 *   (45, 120, at 30 / 60 / 120)       → 0.25 (halfway from the first checkpoint to the second, of two gaps)
 *   (90, 120, at 30 / 60 / 120)       → 0.75
 *   (20, 120, at 30 / 60 / 120)       → 0 (not yet at the first)
 */
export function trackShare(value: number, goal: number, steps: Step[]): number {
  if (!steps.length) return Math.max(0, Math.min(1, value / goal));
  if (value <= steps[0].at) return 0;
  for (let k = 1; k < steps.length; k++) {
    if (value < steps[k].at) return (k - 1 + (value - steps[k - 1].at) / (steps[k].at - steps[k - 1].at)) / (steps.length - 1);
  }
  return 1;
}

/**
 * "value / goal" the way charts write amounts (fmt), big numbers short: a unit fmt joins to the number (₹, $, %) goes
 * on both, any other unit once at the end.
 *   (0, 1000000, "₹") → "₹0 / ₹10L";  (40, 100, "%") → "40% / 100%";  (95, 120, "XP") → "95 / 120 XP";
 *   (300, 500, "pts") → "300 / 500 pts";  (3, 10) → "3 / 10"
 */
export function amountOf(value: number, goal: number, unit?: string): string {
  const plain = fmt(goal);
  const joined = fmt(goal, unit);
  if (!unit || (joined !== plain && joined !== `${plain} ${unit}`)) return `${fmt(value, unit)} / ${joined}`;
  return `${fmt(value)} / ${plain} ${unit}`;
}

export function Progress({ title, value, goal, unit, steps }: ProgressBlock) {
  const share = trackShare(value, goal, steps);
  const named = useNamed("progress", title);
  const bar = barProps(named.root, value, goal, valueWords(value, goal, unit, steps));
  return (
    <div className="hb-card hb-progress">
      <div className="hb-progress-head">
        <span className="hb-progress-icon"><Icon name="trophy" size={19} stroke={2.2} /></span>
        <span id={named.title.id} className="hb-card-title">{title}</span>
        <span className="hb-progress-amount" aria-hidden="true">
          <Icon name="flame" size={15} stroke={2.2} />{amountOf(value, goal, unit)}
        </span>
      </div>
      {steps.length === 0 ? (
        <div className="hb-progress-track" {...bar}><span className="hb-progress-fill" style={{ width: `${share * 100}%` }} /></div>
      ) : (
        <Checkpoints steps={steps} value={value} share={share} unit={unit} bar={bar} />
      )}
    </div>
  );
}

/** What a progressbar says instead of a bare number: the amount as it is drawn, and its checkpoints when it has any.
 *   (95, 120, "XP", [60, 120]) → "95 / 120 XP, 2 of 2 checkpoints passed" */
function valueWords(value: number, goal: number, unit: string | undefined, steps: Step[]): string {
  const amount = amountOf(value, goal, unit);
  if (!steps.length) return amount;
  return `${amount}, ${steps.filter((s) => value >= s.at).length} of ${steps.length} checkpoints passed`;
}

/** The track is the progressbar (the title beside it names it): the value held inside 0 and the goal, and the words a
 *  reader hears for it. The amount beside the title is hidden, so it is said once and not twice. */
function barProps(root: { "aria-labelledby"?: string; "aria-label"?: string }, value: number, goal: number, words: string) {
  const top = Math.max(goal, value);
  return {
    ...root,
    role: "progressbar",
    "aria-valuemin": 0,
    "aria-valuemax": top,
    "aria-valuenow": Math.min(Math.max(value, 0), top),
    "aria-valuetext": words,
  };
}

/** Each checkpoint gets an equal column: its node sits at the column's centre and its label wraps inside it, so long
 *  names never run into the next one. The track runs from the first node's centre to the last's. A label given as a
 *  number is written like the amount: 250000 with "₹" → "₹2.5L". The track carries the progressbar's role and value
 *  (bar), so a reader hears the amount and the checkpoints passed as one. */
function Checkpoints({ steps, value, share, unit, bar }: { steps: Step[]; value: number; share: number; unit?: string; bar: ReturnType<typeof barProps> }) {
  const n = steps.length;
  const edge = `${50 / n}%`;
  const span = ((n - 1) / n) * 100;
  return (
    <>
      <div className="hb-progress-nodes">
        <span className="hb-progress-track hb-progress-track-steps" style={{ left: edge, right: edge }} {...bar} />
        <span className="hb-progress-fill hb-progress-fill-steps" style={{ left: edge, width: `${span * share}%` }} />
        {steps.map((s, k) => {
          const done = value >= s.at;
          return (
            <span key={k} className={done ? "hb-progress-node hb-progress-node-done" : "hb-progress-node"} style={{ left: `${((k + 0.5) / n) * 100}%` }}>
              <Icon name={done ? "check" : "lock"} size={12} stroke={2.6} />
            </span>
          );
        })}
      </div>
      <div className="hb-progress-labels" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {steps.map((s, k) => <span key={k}>{typeof s.label === "number" ? fmt(s.label, unit) : s.label}</span>)}
      </div>
    </>
  );
}
