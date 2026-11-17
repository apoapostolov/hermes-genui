// A milestone track: checkpoints done (ticked) or still locked, and how far along "value / goal" is.
import type { ProgressBlock, Step } from "./read";
import { Icon } from "../../lib/Icon";
import { fmt } from "../chart/chartData";

/**
 * How much of the track is filled, from 0 to 1. With no checkpoints it is value / goal. With checkpoints they sit
 * evenly along the track, and the fill reaches between two of them in proportion to the value. An unknown value (or
 * no goal to be a share of) fills nothing. Worked examples:
 *   (30, 120, [])                     → 0.25
 *   (150, 120, [])                    → 1 (never past full)
 *   (45, 120, at 30 / 60 / 120)       → 0.25 (halfway from the first checkpoint to the second, of two gaps)
 *   (90, 120, at 30 / 60 / 120)       → 0.75
 *   (20, 120, at 30 / 60 / 120)       → 0 (not yet at the first)
 *   (null, 120, [])                   → 0 (unknown, so the track stays empty)
 *   (95, null, [])                    → 0 (no goal to measure against)
 */
export function trackShare(value: number | null, goal: number | null, steps: Step[]): number {
  if (value === null || goal === null) return 0;
  if (!steps.length) return Math.max(0, Math.min(1, value / goal));
  if (value <= steps[0].at) return 0;
  for (let k = 1; k < steps.length; k++) {
    if (value < steps[k].at) return (k - 1 + (value - steps[k - 1].at) / (steps[k].at - steps[k - 1].at)) / (steps.length - 1);
  }
  return 1;
}

/**
 * "value / goal" the way charts write amounts (fmt), big numbers short: a unit fmt joins to the number (₹, $, %) goes
 * on both, any other unit once at the end. An unknown value or goal reads "no data" in its place, so the other keeps
 * showing.
 *   (0, 1000000, "₹") → "₹0 / ₹10L";  (40, 100, "%") → "40% / 100%";  (95, 120, "XP") → "95 / 120 XP";
 *   (300, 500, "pts") → "300 / 500 pts";  (3, 10) → "3 / 10";  (null, 120, "XP") → "no data / 120 XP";
 *   (95, null, "XP") → "95 / no data"
 */
export function amountOf(value: number | null, goal: number | null, unit?: string): string {
  const left = value === null ? "no data" : fmt(value, unit);
  if (goal === null) return `${value === null ? left : fmt(value)} / no data`;
  const plain = fmt(goal);
  const joined = fmt(goal, unit);
  if (!unit || (joined !== plain && joined !== `${plain} ${unit}`)) return `${left} / ${joined}`;
  return `${value === null ? left : fmt(value)} / ${plain} ${unit}`;
}

export function Progress({ title, value, goal, unit, steps }: ProgressBlock) {
  const share = trackShare(value, goal, steps);
  return (
    <div className="hb-card hb-progress">
      <div className="hb-progress-head">
        <span className="hb-progress-icon"><Icon name="trophy" size={19} stroke={2.2} /></span>
        <span className="hb-card-title">{title}</span>
        <span className="hb-progress-amount">
          <Icon name="flame" size={15} stroke={2.2} />{amountOf(value, goal, unit)}
        </span>
      </div>
      {steps.length === 0 ? (
        <div className="hb-progress-track"><span className="hb-progress-fill" style={{ width: `${share * 100}%` }} /></div>
      ) : (
        <Checkpoints steps={steps} value={value} share={share} unit={unit} />
      )}
    </div>
  );
}

/** Each checkpoint gets an equal column: its node sits at the column's centre and its label wraps inside it, so long
 *  names never run into the next one. The track runs from the first node's centre to the last's. A label given as a
 *  number is written like the amount: 250000 with "₹" → "₹2.5L". */
function Checkpoints({ steps, value, share, unit }: { steps: Step[]; value: number | null; share: number; unit?: string }) {
  const n = steps.length;
  const edge = `${50 / n}%`;
  const span = ((n - 1) / n) * 100;
  return (
    <>
      <div className="hb-progress-nodes">
        <span className="hb-progress-track hb-progress-track-steps" style={{ left: edge, right: edge }} />
        <span className="hb-progress-fill hb-progress-fill-steps" style={{ left: edge, width: `${span * share}%` }} />
        {steps.map((s, k) => {
          const done = value !== null && value >= s.at;  // an unknown value ticks nothing off
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
