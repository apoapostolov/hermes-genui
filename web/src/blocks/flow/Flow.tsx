// A flow: boxes joined by arrows, in order. It runs left to right when the column is wide enough for every box, and
// top to bottom when it isn't or the model asked for "down". A group is a labelled frame round neighbouring boxes (a
// part that repeats), as wide as the boxes it holds. A box with a note is a button: a tap opens its note in one panel
// under the diagram (one at a time; a second tap or Escape closes it). A box may hold chips (what is in it now).
// A steps block walking the flow lights its step's box (the accent outline); when its steps change the flow, the boxes
// this pass hasn't reached are dimmed, chips change, a packet slides along the arrow on Next and the repeated group
// counts its layers (walk.ts, packet.ts).
import { Fragment, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "../../lib/Icon";
import { InlineText } from "../../lib/InlineText";
import { lessMotion } from "../../lib/motion";
import { useWidth } from "../chart/useWidth";
import type { FlowMove } from "../steps/read";
import { useWalk, type Walk } from "./highlight";
import { useNamed } from "../../core/a11y";
import { packetPath, type Edges } from "./packet";
import type { Chip, FlowBlock, FlowGroup, FlowNode } from "./read";
import { flowState, isMoving, type FlowState } from "./walk";

// The narrowest a box may be when the flow runs right, the room an arrow takes, and a group frame's padding: a flow
// that needs more than the column has runs down instead.
const NODE_MIN = 88;
const ARROW = 24;
const FRAME = 16;
// Boxes holding chips need a little more room each.
const HOLDS_MIN = 104;
// How long the packet takes for one hop along an arrow, and for each hop of a tick (a tick's hops share 3s at most).
const SEND_MS = 420;
const TICK_MS = 260;
const TICK_TOTAL_MS = 3000;
const NO_STEPS: readonly FlowMove[] = [];

/** Whether the flow fits across `width`: 5 boxes and a group need 5 × 88 + 4 × 24 + 16 = 552px, so 560 fits; 6 don't.
 *  Boxes with chips take 104px: 5 of them and a group need 632px. */
export function fitsAcross(nodes: number, groups: number, width: number, holds = false): boolean {
  return nodes * (holds ? HOLDS_MIN : NODE_MIN) + (nodes - 1) * ARROW + groups * FRAME <= width;
}

/** The chain cut into pieces: a box on its own, or a group's run of boxes.
 *  5 boxes, group 1-2 → [{start 0, end 0}, {start 1, end 2, group}, {start 3, end 3}, {start 4, end 4}] */
function pieces(count: number, groups: FlowGroup[]): { start: number; end: number; group?: FlowGroup }[] {
  const out = [];
  for (let i = 0; i < count; i++) {
    const group = groups.find((g) => g.from === i);
    if (group) {
      out.push({ start: i, end: group.to, group });
      i = group.to;
    } else out.push({ start: i, end: i });
  }
  return out;
}

export function Flow({ id, title, direction, nodes, groups = [] }: FlowBlock) {
  const box = useRef<HTMLDivElement>(null);
  const packet = useRef<HTMLDivElement>(null);
  const boxes = useRef<(HTMLElement | null)[]>([]);
  const width = useWidth(box);
  const [open, setOpen] = useState<number | null>(null);
  const walk = useWalk(id);
  const steps = walk?.steps ?? NO_STEPS;
  const target = useMemo(() => flowState(nodes, groups, steps, walk?.at ?? 0), [nodes, groups, steps, walk?.at]);
  const travelling = useTravel(walk, nodes, groups, target, packet, boxes, box);
  const state = travelling ?? target;
  const moving = isMoving(nodes, steps);
  const holds = state.holds.some((h) => h.length > 0);
  const panelId = useId();
  const down = direction === "down" || !fitsAcross(nodes.length, groups.length, width, holds);
  const shown = open === null ? undefined : nodes[open];
  const named = useNamed("flow", title);

  // `arrow`: whether an arrow leads in (not for the first box, nor the first in a group: its frame has the arrow).
  const node = (n: FlowNode, i: number, arrow: boolean) => (
    <li key={i} className="hb-flow-step">
      {arrow && <Arrow />}
      <NodeBox node={n} chips={state.holds[i]} lit={state.lit === i} idle={state.seen !== null && !state.seen.has(i)}
        open={open === i} panelId={panelId} boxRef={(el) => { boxes.current[i] = el; }}
        onTap={() => setOpen((was) => (was === i ? null : i))} />
    </li>
  );

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && open !== null) setOpen(null);
  }

  return (
    <div className="hb-card hb-flow" role="group" {...named.root} onKeyDown={onKeyDown}>
      {title && <div id={named.title.id} className="hb-card-title">{title}</div>}
      <div ref={box} className="hb-flow-box">
        <ol className={`hb-flow-chain ${down ? "hb-flow-down" : "hb-flow-right"}`}>
          {pieces(nodes.length, groups).map(({ start, end, group }) => group ? (
            <li key={start} className="hb-flow-step" style={{ flexGrow: end - start + 1 }}>
              {start > 0 && <Arrow />}
              <div className="hb-flow-group">
                <div className="hb-flow-group-head">
                  <span className="hb-flow-group-label">{group.label}</span>
                  {group.count !== undefined && <Counter layer={state.layers[groups.indexOf(group)]} count={group.count} />}
                </div>
                <ol className="hb-flow-chain">{nodes.slice(start, end + 1).map((n, k) => node(n, start + k, k > 0))}</ol>
              </div>
            </li>
          ) : <Fragment key={start}>{node(nodes[start], start, start > 0)}</Fragment>)}
        </ol>
        {moving && walk && <div ref={packet} className="hb-flow-packet" aria-hidden="true" />}
      </div>
      {shown?.note && (
        <div id={panelId} className="hb-flow-panel" role="region" aria-label={shown.label}>
          <div className="hb-flow-panel-title">{shown.label}</div>
          <p className="hb-flow-note"><InlineText text={shown.note} /></p>
        </div>
      )}
    </div>
  );
}

/** A group's count: "× 6" until the pass reaches it, then "layer 3 of 6". */
function Counter({ layer, count }: { layer: number; count: number }) {
  return <span className="hb-chip hb-chip-soft hb-flow-count">{layer ? `layer ${layer} of ${count}` : `× ${count}`}</span>;
}

/**
 * The packet's trip when a walk moves one step on (Next) and the step sends or ticks: while it travels the flow shows
 * the step before (with the layer counting up through a tick), then the new step lands. Back, a jump to a dot, less
 * motion or a browser that can't animate land at once. Returns the state to show while travelling, or null.
 */
function useTravel(walk: Walk | undefined, nodes: FlowNode[], groups: FlowGroup[], target: FlowState,
  packet: { current: HTMLDivElement | null }, boxes: { current: (HTMLElement | null)[] },
  frame: { current: HTMLDivElement | null }): FlowState | null {
  const [travelling, setTravelling] = useState<FlowState | null>(null);
  useLayoutEffect(() => {
    const step = walk && walk.from !== null && walk.at === walk.from + 1 ? walk.steps[walk.at] : undefined;
    const dot = packet.current;
    if (!walk || !step || !(step.send || step.tick) || !dot || typeof dot.animate !== "function" || lessMotion()) {
      setTravelling(null);
      return;
    }
    const before = flowState(nodes, groups, walk.steps, walk.from!);
    let live = true;
    let flight: Animation | null = null;
    const edges = (i: number): Edges | null => {
      const el = boxes.current[i];
      const outer = frame.current?.getBoundingClientRect();
      if (!el || !outer) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left - outer.left, top: r.top - outer.top, right: r.right - outer.left, bottom: r.bottom - outer.top };
    };
    // One hop of the packet; resolves true when it lands, false when a newer step (or leaving) cut it short.
    const hop = async (from: number, to: number, ms: number): Promise<boolean> => {
      const a = edges(from);
      const b = edges(to);
      if (!a || !b) return live;
      const path = packetPath(a, b, to <= from);
      dot.style.opacity = "1";
      flight = dot.animate(path.map((p) => ({ transform: `translate(${p.x}px, ${p.y}px)` })), { duration: ms, easing: "ease-in-out", fill: "forwards" });
      try {
        await flight.finished;
        return live;
      } catch {
        return false;
      } finally {
        dot.style.opacity = "0";
      }
    };
    setTravelling(before);
    (async () => {
      const g = step.tick ? groups.findIndex((gr) => target.lit !== undefined && target.lit >= gr.from && target.lit <= gr.to) : -1;
      if (g >= 0) {
        const { from: first, to: last } = groups[g];
        const ms = Math.min(TICK_MS, TICK_TOTAL_MS / (2 * step.tick!));
        for (let k = 1; k <= step.tick!; k++) {
          const layers = before.layers.map((v, j) => (j === g ? Math.min(groups[g].count ?? Infinity, Math.max(1, v) + k) : v));
          if (!(await hop(last, first, ms))) return;
          setTravelling({ ...before, lit: first, layers });
          if (!(await hop(first, last, ms))) return;
          setTravelling({ ...before, lit: last, layers });
        }
      }
      if (step.send && before.lit !== undefined && target.lit !== undefined && !(await hop(before.lit, target.lit, SEND_MS))) return;
      if (live) setTravelling(null);
    })();
    return () => {
      live = false;
      flight?.cancel();
    };
  }, [walk]);
  return travelling;
}

type BoxProps = {
  node: FlowNode; chips: Chip[]; lit: boolean; idle: boolean; open: boolean; panelId: string;
  boxRef: (el: HTMLElement | null) => void; onTap: () => void;
};

/** One box: its icon, label and chips. With a note it is a button that opens the note; without one a plain box. */
function NodeBox({ node, chips, lit, idle, open, panelId, boxRef, onTap }: BoxProps) {
  const className = `hb-flow-node${lit ? " hb-flow-lit" : ""}${open ? " hb-flow-open" : ""}${idle ? " hb-flow-idle" : ""}`;
  const holds = chips.length > 0 && <Chips key={JSON.stringify(chips)} chips={chips} />;
  const inside = (
    <>
      {node.icon && <span className="hb-flow-icon"><Icon name={node.icon} size={14} /></span>}
      <span className="hb-flow-label">{node.label}</span>
    </>
  );
  if (!node.note) return <div ref={boxRef} className={className} aria-current={lit ? "step" : undefined}>{inside}{holds}</div>;
  return (
    <button ref={boxRef} type="button" className={className} aria-expanded={open} aria-controls={open ? panelId : undefined}
      aria-current={lit ? "step" : undefined} onClick={onTap}>
      {inside}
      <span className="hb-flow-more" aria-hidden="true">{open ? "−" : "+"}</span>
      {holds}
    </button>
  );
}

/** A box's chips. Keyed by what they say, so a change draws them afresh and they fade in (flow.css). */
function Chips({ chips }: { chips: Chip[] }) {
  return (
    <span className="hb-flow-holds">
      {chips.map((c, k) => <span key={k} className={c.accent ? "hb-flow-chip hb-flow-chip-accent" : "hb-flow-chip"}>{c.text}</span>)}
    </span>
  );
}

/** The arrow before a box; the css turns it to point down in a downward flow. */
function Arrow() {
  return (
    <span className="hb-flow-arrow" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
    </span>
  );
}
