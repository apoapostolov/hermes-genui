// What-if numbers: a slider per input, and results worked out again on every move. Nothing is sent; every moved
// line is the BOARD's answer from the edit itself (core/blockState.ts) — a never-updated board, a living update,
// a move into another container or a reopen all find every slider where the reader left it, over the state door
// and across an unmounted first update alike.
import { useMemo } from "react";
import { useStoredValue } from "../../core/blockState";
import type { CalcInput, CalcOutput } from "./read";
import { calcChartSpec, type CalcChart } from "./calcChart";
import { formatWithUnit } from "../../lib/format";
import { evaluate } from "../../lib/formula";
import { InlineText } from "../../lib/InlineText";
import { Chart } from "../chart/Chart";

type Props = { title?: string; inputs: CalcInput[]; outputs: CalcOutput[]; chart?: CalcChart };

/** Sliders, then the results, then (when the block has one) a chart worked out again from the same values on every
 *  move. A chart with no point that can be worked out isn't shown. */
export function Calculator({ title, inputs, outputs, chart }: Props) {
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
  const values = useMemo(() => new Map(inputs.map((x) => [x.id, answers[x.id] ?? x.value])), [inputs, answers]);
  const move = (id: string, v: number) => write({ ...answers, [id]: v });
  const spec = useMemo(() => (chart ? calcChartSpec(chart, values) : null), [chart, values]);
  return (
    <div className="hb-card hb-calc">
      {title && <div className="hb-card-title"><InlineText text={title} /></div>}
      {inputs.map((input) => <Slider key={input.id} input={input} value={values.get(input.id) ?? input.value} onMove={(v) => move(input.id, v)} />)}
      {outputs.length > 0 && <div className="hb-calc-results">{outputs.map((o, i) => <Result key={i} output={o} values={values} />)}</div>}
      {spec && <Chart spec={spec} />}
    </div>
  );
}

export function Slider({ input, value, onMove }: { input: CalcInput; value: number; onMove: (v: number) => void }) {
  return (
    <label className="hb-calc-slider">
      <span className="hb-calc-head">
        <span className="hb-calc-label"><InlineText text={input.label} /></span>
        <span className="hb-calc-value">{formatWithUnit(value, input.unit)}</span>
      </span>
      <input type="range" className="hb-range" min={input.min} max={input.max} step={input.step} value={value}
        onChange={(e) => onMove(Number(e.target.value))} />
      <span className="hb-calc-ends"><span>{formatWithUnit(input.min, input.unit)}</span><span>{formatWithUnit(input.max, input.unit)}</span></span>
    </label>
  );
}

/** One result: its label and its value now, or "–" when the formula can't be worked out (that result only).
 *  emi(p, 8.5, 20) with p = 4000000, unit ₹ → "₹34,713";  p / 0 → "–" */
function Result({ output, values }: { output: CalcOutput; values: ReadonlyMap<string, number> }) {
  const value = evaluate(output.formula, values);
  return (
    <div className="hb-calc-result">
      <div className="hb-calc-result-label"><InlineText text={output.label} /></div>
      <div className="hb-calc-result-value" aria-live="polite">{value === null ? "–" : formatWithUnit(value, output.unit)}</div>
    </div>
  );
}
