// A formula played over time: Play runs time from 0 to its end, the scrubber picks a moment, the sliders change the
// inputs, and the piles of dots (Piles.tsx) or the line chart (SimChart.tsx) show the amounts then. It opens finished
// (the whole picture at rest), pauses when scrolled out of view, and a run takes to ÷ speed seconds (at most 60).
import { useEffect, useMemo, useRef, useState } from "react";
import { useStoredValue } from "../../core/blockState";
import { InlineText } from "../../lib/InlineText";
import { evaluate, newBudget, parseFormula, type Node } from "../../lib/formula";
import { Slider } from "../calculator/Calculator";
import { MAX_CHART_WORK } from "../calculator/calcChart";
import { fmt } from "../chart/chartData";
import { Source } from "../source/Source";
import { Piles } from "./Piles";
import type { SimulateBlock } from "./read";
import { SimChart } from "./SimChart";
import { dotPer, timesOf, whole } from "./sim";

export function Simulate(block: SimulateBlock) {
  const { title, t: time, inputs, values: fixed, piles, unit, source } = block;
  const root = useRef<HTMLDivElement>(null);
  const clock = useRef(time.to);
  // The sliders and the view kind are the BOARD's answers (core/blockState.ts): a moved line and a picked
  // view survive updates, moves and reopens. The scrub position and Play are a run, not an answer — a
  // reopen opens finished, exactly as this block has always opened.
  const [answers, write] = useStoredValue<Record<string, number>>({
    door: "identity",
    initial: () => Object.fromEntries(inputs.map((x) => [x.id, x.value])),
    revive: (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
      const known = new Set(inputs.map((x) => x.id));
      const out: Record<string, number> = {};
      for (const [id, v] of Object.entries(saved as Record<string, unknown>)) {
        if (known.has(id) && typeof v === "number" && isFinite(v)) out[id] = v;
      }
      return out;
    },
    stored: (value) => value,
  });
  const sliders = useMemo(() => new Map(Object.entries(answers)), [answers]);
  const [view, setView] = useStoredValue<string>({
    door: "identity", field: "~view",
    initial: () => block.view,
    revive: (saved) => (saved === "dots" || saved === "chart" ? saved : null),
    stored: (value) => value,
  });
  const [at, setAt] = useState(time.to);
  const [playing, setPlaying] = useState(false);
  const trees = useMemo(() => piles.map((p) => parseFormula(p.formula)), [piles]);
  const names = useMemo(() => new Map([...fixed, ...sliders]), [fixed, sliders]);
  const times = useMemo(() => timesOf(time.to, time.step), [time]);
  // Every pile at every step with the sliders as they are (for the chart), and the most each can reach with every
  // slider at its top (for the size of the piles, so they don't jump as a slider moves).
  const lines = useMemo(() => valuesOver(trees, names, time.name, times), [trees, names, time.name, times]);
  const most = useMemo(() => {
    const tops = new Map([...fixed, ...inputs.map((x) => [x.id, x.max] as [string, number])]);
    const high = valuesOver(trees, tops, time.name, [time.to]);
    return trees.map((_, k) => Math.max(0, high[k][0] ?? 0, ...lines[k].map((v) => v ?? 0)));
  }, [trees, fixed, inputs, lines, time]);
  const per = dotPer(block.per, most.reduce((a, b) => a + b, 0));
  const index = Math.round(at / time.step);
  const amounts = lines.map((line) => line[index] ?? null);

  usePlay(playing, () => setPlaying(false), clock, time, setAt);
  usePauseWhenHidden(root, playing, () => setPlaying(false));

  function play() {
    if (playing) return setPlaying(false);
    if (clock.current >= time.to) {
      clock.current = 0;
      setAt(0);
    }
    setPlaying(true);
  }
  function scrub(v: number) {
    setPlaying(false);
    clock.current = v;
    setAt(v);
  }

  return (
    <div ref={root} className="hb-card hb-sim">
      <div className="hb-sim-head">
        {title && <div className="hb-card-title"><InlineText text={title} /></div>}
        <div className="hb-sim-switch" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "dots"} onClick={() => setView("dots")}>Dots</button>
          <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>Line chart</button>
        </div>
      </div>
      <div className="hb-sim-controls">
        <button type="button" className="hb-pill hb-pill-solid hb-sim-play" onClick={play}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d={playing ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5.5v13l10.5-6.5z"} />
          </svg>
          {playing ? "Pause" : "Play"}
        </button>
        <label className="hb-calc-slider hb-sim-time">
          <span className="hb-calc-head">
            <span className="hb-calc-label">{time.unit ? capital(time.unit) : time.name}</span>
            <span className="hb-calc-value">{`${fmt(at)} of ${fmt(time.to)}`}</span>
          </span>
          <input type="range" className="hb-range" min={0} max={time.to} step={time.step} value={at}
            aria-label={time.unit ?? time.name} onChange={(e) => scrub(Number(e.target.value))} />
        </label>
        {inputs.map((input) => (
          <Slider key={input.id} input={input} value={sliders.get(input.id) ?? input.value}
            onMove={(v) => write({ ...answers, [input.id]: v })} />
        ))}
      </div>
      {view === "dots"
        ? <Piles piles={piles} amounts={amounts} start={lines[0][0] ?? 0} per={per} most={most} playing={playing} unit={unit} label={block.start} />
        : <SimChart piles={piles} lines={lines} times={times} index={index} unit={unit} />}
      {source && <Source text={source} />}
    </div>
  );
}

/** "years" → "Years" */
function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Each pile's value at each time, worked out within one shared budget (a formula built to be slow leaves gaps).
 *  [P * 1.1 ^ y] with P 100 at times [0, 1, 2] → [[100, 110, 121]] */
function valuesOver(trees: Node[], names: ReadonlyMap<string, number>, tName: string, times: number[]): (number | null)[][] {
  const budget = newBudget(MAX_CHART_WORK);
  return trees.map((tree) => times.map((t) => evaluate(tree, new Map(names).set(tName, t), budget)));
}

/** While playing, moves time on at to ÷ seconds per second, a step at a time, and stops at the end. */
function usePlay(playing: boolean, stop: () => void, clock: { current: number }, time: SimulateBlock["t"], show: (t: number) => void) {
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      clock.current = Math.min(time.to, clock.current + ((now - last) / 1000) * (time.to / time.seconds));
      last = now;
      show(whole(clock.current, time.step));
      if (clock.current >= time.to) return stop();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);
}

/** Pauses once the block scrolls out of view, so nothing keeps playing where no one can see it. */
function usePauseWhenHidden(root: { current: HTMLElement | null }, playing: boolean, pause: () => void) {
  useEffect(() => {
    if (!playing || !root.current || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) pause();
    });
    watcher.observe(root.current);
    return () => watcher.disconnect();
  }, [playing]);
}
