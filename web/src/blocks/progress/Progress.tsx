// A track toward a goal: a bar, a ring or a gauge, with checkpoints, threshold bands and coloured segments.
import type { ProgressBlock, Segment, Shape, Step, Threshold, Tone } from "./read";
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
 * showing — and keeps its unit, since it is the only number left.
 *   (0, 1000000, "₹") → "₹0 / ₹10L";  (40, 100, "%") → "40% / 100%";  (95, 120, "XP") → "95 / 120 XP";
 *   (300, 500, "pts") → "300 / 500 pts";  (3, 10) → "3 / 10";  (null, 120, "XP") → "no data / 120 XP";
 *   (95, null, "₹") → "₹95 / no data";  (95, null, "XP") → "95 XP / no data"
 */
export function amountOf(value: number | null, goal: number | null, unit?: string): string {
  const left = value === null ? "no data" : fmt(value, unit);
  if (goal === null) return value === null ? "no data / no data" : `${left} / no data`;
  const plain = fmt(goal);
  const joined = fmt(goal, unit);
  if (!unit || (joined !== plain && joined !== `${plain} ${unit}`)) return `${left} / ${joined}`;
  return `${value === null ? left : fmt(value)} / ${plain} ${unit}`;
}

/** The share of the goal reached as a whole percent, held between 0 and 100 (the amount itself keeps the real value).
 *  An unknown value or goal has no share, so it reads 0.
 *   (14, 21.1) → 66;  (150, 120) → 100;  (-5, 120) → 0;  (null, 120) → 0;  (95, null) → 0 */
export function percentOf(value: number | null, goal: number | null): number {
  if (value === null || goal === null) return 0;
  return Math.round(Math.max(0, Math.min(1, value / goal)) * 100);
}

/**
 * The tone of the band the value falls in. A toned threshold ends a band, so with marks at 60 good / 85 warn / 100 bad
 * a value of 88 sits in the bad band, 70 in the warn band and 50 in the good one. A mark past `goal` is held at the
 * goal, as the bar and the Python text both do, so it colours nothing beyond full: marks at 60 good / 100 warn / 150
 * bad on a goal of 100 leave a value of 120 in the warn band. No toned mark → `fallback`.
 */
export function zoneTone(value: number | null, thresholds: Threshold[], fallback: Tone = "good", goal = Infinity): Tone {
  if (value === null) return fallback;  // an unknown reading colours no band
  const toned = thresholds
    .filter((t): t is Threshold & { tone: Tone } => t.tone !== undefined)
    .sort((a, b) => a.at - b.at);
  if (!toned.length) return fallback;
  let from = 0;
  let last: Tone | undefined;
  for (const mark of toned) {
    const to = Math.min(mark.at, goal);
    if (to <= from) continue;   // a second mark at the same place adds no band
    if (value <= to) return mark.tone;
    from = to;
    last = mark.tone;
  }
  return last ?? fallback;
}

/** Where a value sits on the track, from 0 to 1: the mark at 85 of a goal of 100 → 0.85. Held between 0 and 1. */
const place = (at: number | null, goal: number | null): number =>
  at === null || goal === null ? 0 : Math.max(0, Math.min(1, at / goal));

/** A share as a CSS percentage, rounded: 0.2 of a goal of 100 is "20%", never "20.000000000000007%". */
const pctOf = (share: number): string => `${Math.round(share * 10000) / 100}%`;

/** The bands between toned marks, from 0 to the first toned mark, then on to each next one. */
export function bandsOf(thresholds: Threshold[], goal: number | null): { from: number; to: number; tone: Tone }[] {
  const bands: { from: number; to: number; tone: Tone }[] = [];
  let from = 0;
  for (const t of [...thresholds].sort((a, b) => a.at - b.at)) {
    if (!t.tone) continue;
    const to = Math.max(from, place(t.at, goal));
    if (to > from) bands.push({ from, to, tone: t.tone });
    from = to;
  }
  return bands;
}

export function Progress({ title, value, goal, unit, steps, shape = "line", show_percent, tone, thresholds = [], segments = [] }: ProgressBlock) {
  // A track carries marks (thresholds) or checkpoints (steps), not both: the reader drops steps when marks are given.
  const marks = thresholds.length ? thresholds : [];
  const checkpoints = marks.length ? [] : steps;
  const ring = shape === "circle" || shape === "dashboard";
  // A ring has no checkpoint seats, so it always fills by value / goal; a bar with checkpoints fills gap by gap.
  const share = ring ? place(value, goal) : trackShare(value, goal, checkpoints);
  const percent = percentOf(value, goal);
  const active = zoneTone(value, marks, tone ?? "good", goal ?? Infinity);
  return (
    <div className={`hb-card hb-progress hb-progress-tone-${active}`}>
      <div className="hb-progress-head">
        <span className="hb-progress-icon"><Icon name="trophy" size={19} stroke={2.2} /></span>
        <span className="hb-card-title">{title}</span>
        <span className="hb-progress-amount">
          <Icon name="flame" size={15} stroke={2.2} />{amountOf(value, goal, unit)}
        </span>
        {show_percent && !ring && <span className="hb-progress-pct">{percent}%</span>}
      </div>
      {ring
        ? <Ring shape={shape} share={share} percent={show_percent ? percent : null} marks={marks} segments={segments} goal={goal} />
        : segments.length
          ? <Segments segments={segments} goal={goal} unit={unit} />
          : checkpoints.length
            ? <Checkpoints steps={checkpoints} value={value} share={share} unit={unit} />
            : <Bar share={share} marks={marks} goal={goal} unit={unit} />}
    </div>
  );
}

/** The plain bar, with the bands between toned marks behind the fill and a tick at each mark. */
function Bar({ share, marks, goal, unit }: { share: number; marks: Threshold[]; goal: number | null; unit?: string }) {
  const bands = bandsOf(marks, goal);
  const track = `hb-progress-track${marks.length ? " hb-progress-track-zoned" : ""}`;
  const body = (
    <>
      <div className={track}>
        {bands.map((b, k) => (
          <span key={k} className={`hb-progress-band hb-progress-band-${b.tone}`}
            style={{ left: pctOf(b.from), width: pctOf(b.to - b.from) }} />
        ))}
        <span className="hb-progress-fill" style={{ width: pctOf(share) }} />
      </div>
      {marks.map((m, k) => <span key={k} className="hb-progress-mark" style={{ left: pctOf(place(m.at, goal)) }} />)}
      <MarkLabels marks={marks} goal={goal} unit={unit} />
    </>
  );
  // Only a marked track needs the wrapper the ticks and their labels are placed in; a plain bar stays one element.
  return marks.length ? <div className="hb-progress-line">{body}</div> : body;
}

/** Each mark's label sits under its tick, held a little inside the card so the first and last stay readable. */
function MarkLabels({ marks, goal, unit }: { marks: Threshold[]; goal: number | null; unit?: string }) {
  const labelled = marks.filter((m) => m.label !== undefined);
  if (!labelled.length) return null;
  return (
    <div className="hb-progress-mark-labels">
      {labelled.map((m, k) => (
        <span key={k} style={{ left: pctOf(Math.min(0.96, Math.max(0.04, place(m.at, goal)))) }}>
          {typeof m.label === "number" ? fmt(m.label, unit) : m.label}
        </span>
      ))}
    </div>
  );
}

/** Parts of one track, end to end: each starts where the last ended, and what is left of the goal stays empty. */
function Segments({ segments, goal, unit }: { segments: Segment[]; goal: number | null; unit?: string }) {
  let at = 0;
  const parts = segments.map((s, k) => {
    const from = at;
    at = Math.min(1, at + (goal === null ? 0 : Math.max(0, s.value / goal)));
    return { key: k, left: from, width: at - from, label: s.label, value: s.value, tone: s.tone ?? "good" };
  });
  return (
    <>
      <div className="hb-progress-track hb-progress-track-zoned hb-progress-track-parts">
        {parts.filter((p) => p.width > 0).map((p) => (
          <span key={p.key} className={`hb-progress-seg hb-progress-seg-${p.tone}`}
            style={{ left: pctOf(p.left), width: pctOf(p.width) }} />
        ))}
      </div>
      {parts.some((p) => p.label) && (
        <div className="hb-legend">
          {parts.filter((p) => p.label).map((p) => (
            <span key={p.key} className="hb-legend-item">
              <i className={`hb-legend-dot hb-progress-dot-${p.tone}`} />
              {p.label}
              <span className="hb-legend-value">{fmt(p.value, unit)}</span>
            </span>
          ))}
        </div>
      )}
    </>
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

/** A ring (a full circle) or a gauge (an open arc across the top, 270°): the arc starts at the top for a ring and at
 *  the lower left for a gauge, and sweeps clockwise. */
const RING_R = 50;

function spot(at: number, radius: number, shape: Shape): [number, number] {
  const start = shape === "dashboard" ? -135 : 0;
  const sweep = shape === "dashboard" ? 270 : 360;
  const angle = ((start + sweep * at) * Math.PI) / 180;
  return [60 + radius * Math.sin(angle), 60 - radius * Math.cos(angle)];
}

/** How long the stroked path is, for the dash that draws the filled part. */
function ringLength(shape: Shape): number {
  return 2 * Math.PI * RING_R * (shape === "dashboard" ? 270 / 360 : 1);
}

/** Where the stroked circle starts, so the dash begins on the track's own first point: 12 o'clock for a ring, the
 *  lower left for a gauge (its path starts at 25 95, 135° clockwise from 3 o'clock, where a circle's stroke starts). */
function startTurn(shape: Shape): string {
  return `rotate(${shape === "dashboard" ? 135 : -90} 60 60)`;
}

function Ring({ shape, share, percent, marks, segments, goal }: {
  shape: Shape; share: number; percent: number | null; marks: Threshold[]; segments: Segment[]; goal: number | null;
}) {
  const length = ringLength(shape);
  const track = shape === "dashboard"
    ? <path className="hb-progress-ring-track" d="M 25 95 A 50 50 0 1 1 95 95" />
    : <circle className="hb-progress-ring-track" cx="60" cy="60" r={RING_R} />;
  let at = 0;
  const parts = segments.map((s) => {
    const from = at;
    at = Math.min(1, at + (goal === null ? 0 : Math.max(0, s.value / goal)));
    return { from, to: at, tone: s.tone ?? "good" };
  });
  return (
    <div className={`hb-progress-ring${shape === "dashboard" ? " hb-progress-ring-dash" : ""}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        {track}
        {parts.length
          ? parts.filter((p) => p.to > p.from).map((p, k) => (
            <circle key={k} className={`hb-progress-ring-fill hb-progress-ring-${p.tone}`} cx="60" cy="60" r={RING_R}
              transform={startTurn(shape)}
              strokeDasharray={`${length * (p.to - p.from)} ${length}`} strokeDashoffset={-length * p.from} />
          ))
          : <circle className="hb-progress-ring-fill" cx="60" cy="60" r={RING_R}
            transform={startTurn(shape)}
            strokeDasharray={`${length * share} ${length}`} />}
        {marks.map((m, k) => {
          const [x1, y1] = spot(place(m.at, goal), RING_R - 9, shape);
          const [x2, y2] = spot(place(m.at, goal), RING_R + 9, shape);
          return <line key={k} className="hb-progress-ring-mark" x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </svg>
      {percent !== null && <span className="hb-progress-ring-pct">{percent}%</span>}
    </div>
  );
}
