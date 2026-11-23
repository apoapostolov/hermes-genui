// Draws one widget: the authored element tree from read.ts, with the local state the reader declared. Changing a
// control recomputes the computed values, so text, numbers, bars and the embedded blocks follow at once. The only
// thing this block can do outside itself is put text in the composer (a fill button); it never sends, fetches or
// writes to the host.
//
// Everything the model wrote is data here: elements are drawn with the plugin's own pieces (cards, chips, pills, the
// chart and table blocks), never as markup or CSS of its choosing.
import { Fragment, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { BlockActions } from "../../host/actions";
import { formatNumber, formatWithUnit } from "../../lib/format";
import { InlineText } from "../../lib/InlineText";
import { Bar, LinkLine } from "../atoms/Atoms";
import { Chart } from "../chart/Chart";
import { KpiCard } from "../kpis/Kpis";
import { Source } from "../source/Source";
import { Table } from "../table/Table";
import { evaluate, evaluateComputed, type Expr, type ExprScope } from "./expr";
import {
  applyBindings, initialState, itemKey, readEmbed, repeatItems,
  type EmbedBlock, type EmbedKind, type FillAction, type NumberDecl, type StateDecl, type StateValues,
  type WidgetAction, type WidgetBlock, type WidgetNode, type WidgetTone,
} from "./read";

type Item = Record<string, unknown> | null;

/** What a drawn element needs: the widget, the values now, and the three things a tap can do. */
type Context = {
  block: WidgetBlock;
  values: StateValues;
  computed: Record<string, unknown>;
  /** A prefix that keeps this widget's control ids apart from every other block on the page. */
  uid: string;
  set: (name: string, value: number | string | boolean) => void;
  reset: () => void;
  fill: (text: string) => void;
};

export function Widget({ block }: { block: WidgetBlock }) {
  const { fill } = useContext(BlockActions);
  const uid = `hb-widget-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [values, setValues] = useState<StateValues>(() => initialState(block.state));
  const computed = useMemo(() => evaluateComputed(block.computed, { data: block.data, state: values }), [block, values]);
  const context: Context = {
    block,
    values,
    computed: computed.values,
    uid,
    set: (name, value) => setValues((all) => ({ ...all, [name]: value })),
    reset: () => setValues(initialState(block.state)),
    fill,
  };
  return (
    <div className="hb-widget" role="group" aria-label={block.title}>
      {drawNodes(block.view, context, null, [])}
    </div>
  );
}

function drawNodes(nodes: WidgetNode[], context: Context, item: Item, path: string[]): ReactNode[] {
  return nodes.map((node) => (
    <Fragment key={`${path.join("/")}/${node.id}`}>{drawNode(node, context, item, path)}</Fragment>
  ));
}

function drawNode(node: WidgetNode, context: Context, item: Item, path: string[]): ReactNode {
  const scope: ExprScope = { data: context.block.data, state: context.values, computed: context.computed, item };
  const here = [...path, node.id];
  switch (node.kind) {
    case "stack":
    case "row":
    case "surface":
      return (
        <div className={`hb-widget-${node.kind} hb-widget-gap-${node.gap ?? "md"}`}>
          {drawNodes(node.children, context, item, here)}
        </div>
      );
    case "grid":
      return (
        <div className={`hb-widget-grid hb-widget-grid-${node.columns} hb-widget-gap-${node.gap ?? "md"}`}>
          {drawNodes(node.children, context, item, here)}
        </div>
      );
    case "text": {
      const result = node.text !== undefined ? { value: node.text, error: null } : evaluate(node.expr, scope);
      return (
        <div className={`hb-widget-text hb-widget-tone-${node.tone ?? "plain"}`}>
          <InlineText text={shownText(result.value)} />
          {result.error && <span className="hb-widget-note" role="note"> {result.error}</span>}
        </div>
      );
    }
    case "number": {
      const result = evaluate(node.expr, scope);
      return (
        <div className={`hb-widget-figure hb-widget-tone-${node.tone ?? "plain"}`}>
          {node.label && <div className="hb-widget-figure-label">{node.label}</div>}
          <div className="hb-widget-figure-value">
            {result.error ? "unavailable" : typeof result.value === "number" ? formatWithUnit(result.value, node.unit) : shownText(result.value)}
          </div>
          {result.error && <div className="hb-widget-note" role="note">{result.error}</div>}
        </div>
      );
    }
    case "badge": {
      const result = node.text !== undefined ? { value: node.text, error: null } : evaluate(node.expr, scope);
      return (
        <div className="hb-widget-badge">
          <span className={`hb-chip ${chipClass(node.tone)}`}>{shownText(result.value)}</span>
          {result.error && <span className="hb-widget-note" role="note"> {result.error}</span>}
        </div>
      );
    }
    case "divider":
      return <div className="hb-divider" role="separator" />;
    case "image":
      return (
        <figure className="hb-image">
          <img src={node.url} alt={node.alt} loading="lazy" referrerPolicy="no-referrer" />
        </figure>
      );
    case "link":
      return <LinkLine type="link" text={node.text} url={node.url} />;
    case "input":
      return drawInput(node.state, node.control, node.label, context, here);
    case "button":
      return (
        <div className="hb-widget-button">
          <button type="button" className="hb-pill" onClick={() => runAction(node.action, context, item, scope)}>
            {node.label}
          </button>
        </div>
      );
    case "when": {
      const result = evaluate(node.test, scope);
      const branch = result.value === true ? node.then : result.value === false ? node.else : [];
      return (
        <>
          {drawNodes(branch, context, item, here)}
          {result.error && <div className="hb-widget-note" role="note">{result.error}</div>}
        </>
      );
    }
    case "repeat": {
      const items = repeatItems(context.block, node);
      if (!items.length) return <>{drawNodes(node.empty, context, item, here)}</>;
      return (
        <div className="hb-widget-repeat">
          {items.map((entry, i) => {
            const key = itemKey(node, entry) ?? String(i);
            const next = entry !== null && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : null;
            return <Fragment key={key}>{drawNodes(node.template, context, next, [...here, key])}</Fragment>;
          })}
        </div>
      );
    }
    case "block":
      return <Embedded spec={node.spec} bindings={node.bindings} scope={scope} />;
  }
}

function drawInput(name: string, control: string, label: string, context: Context, here: string[]): ReactNode {
  const decl = context.block.state[name];
  const id = `${context.uid}-${here.join("-")}`;
  const value = context.values[name];
  if (!decl) return null;
  if (control === "checkbox" && decl.type === "boolean") {
    return (
      <label className="hb-widget-field hb-widget-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={value === true} onChange={(e) => context.set(name, e.target.checked)} />
        <span className="hb-widget-label">{label}</span>
      </label>
    );
  }
  if (decl.type === "number" && (control === "number" || control === "slider")) {
    const current = typeof value === "number" ? value : decl.initial;
    return (
      <label className="hb-widget-field" htmlFor={id}>
        <span className="hb-widget-field-head">
          <span className="hb-widget-label">{label}</span>
          <span className="hb-widget-value">{formatNumber(current)}</span>
        </span>
        <input
          id={id}
          className={control === "slider" ? "hb-range" : "hb-input"}
          type={control === "slider" ? "range" : "number"}
          min={decl.min}
          max={decl.max}
          step={decl.step}
          value={current}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (e.target.value !== "" && isFinite(next)) context.set(name, within(decl, next));
          }}
        />
      </label>
    );
  }
  if (decl.type === "string" && control === "select") {
    return (
      <label className="hb-widget-field" htmlFor={id}>
        <span className="hb-widget-label">{label}</span>
        <select id={id} className="hb-input" value={typeof value === "string" ? value : decl.initial} onChange={(e) => context.set(name, e.target.value)}>
          {(decl.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  if (decl.type === "string") {
    return (
      <label className="hb-widget-field" htmlFor={id}>
        <span className="hb-widget-label">{label}</span>
        <input
          id={id}
          className="hb-input"
          type="text"
          maxLength={decl.maxLength}
          value={typeof value === "string" ? value : decl.initial}
          onChange={(e) => context.set(name, e.target.value.slice(0, decl.maxLength))}
        />
      </label>
    );
  }
  return null;
}

/** A number kept inside its declaration's bounds. */
function within(decl: NumberDecl, value: number): number {
  return Math.min(decl.max, Math.max(decl.min, value));
}

/** The value a `set` would write, or null when it does not fit the declaration and nothing should change. */
function typedValue(decl: StateDecl, value: unknown): number | string | boolean | null {
  if (decl.type === "number") return typeof value === "number" && isFinite(value) ? within(decl, value) : null;
  if (decl.type === "boolean") return typeof value === "boolean" ? value : null;
  if (typeof value !== "string") return null;
  const text = value.slice(0, decl.maxLength);
  if (decl.options && !decl.options.includes(text)) return null;
  return text;
}

function runAction(action: WidgetAction, context: Context, item: Item, scope: ExprScope): void {
  if (action.op === "reset") {
    context.reset();
    return;
  }
  if (action.op === "fill") {
    context.fill(fillMessage(action, context));
    return;
  }
  const decl = context.block.state[action.state];
  if (!decl) return;
  const result = evaluate(action.value, { ...scope, item });
  if (result.error || result.value === null) return;
  const value = typedValue(decl, result.value);
  if (value !== null) context.set(action.state, value);
}

/** The composer text a fill button prepares: its message, then one labelled line per state field it lists. */
export function fillMessage(action: FillAction, context: Pick<Context, "block" | "values">): string {
  const lines = action.fields.map((name) => {
    const decl = context.block.state[name];
    return `${decl?.label ?? name}: ${shownText(context.values[name])}`;
  });
  return lines.length ? `${action.message}\n\n${lines.join("\n")}` : action.message;
}

/** A value as text: numbers the way the user reads them, unknown as "unknown" (never as 0 or an empty line). */
export function shownText(value: unknown): string {
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return "unknown";
}

function chipClass(tone: WidgetTone | undefined): string {
  if (tone === "good") return "hb-chip-good";
  if (tone === "warn") return "hb-chip-warn";
  if (tone === "bad") return "hb-widget-chip-bad";
  if (tone === "info") return "hb-chip-soft";
  return "hb-chip-plain";
}

/** One embedded block, with its bound values written in from the current state. An embedded block that cannot be
 *  read (or a binding that could not be evaluated) is a short note, never a broken card. */
function Embedded({ spec, bindings, scope }: { spec: Record<string, unknown>; bindings: Record<string, Expr>; scope: ExprScope }) {
  const { spec: bound, errors } = applyBindings(spec, bindings, scope);
  const block = readEmbed(spec.type as EmbedKind, bound);
  return (
    <>
      {block && drawn(block)}
      {errors.map((why) => <div key={why} className="hb-widget-note" role="note">{why}</div>)}
    </>
  );
}

function drawn(block: EmbedBlock): ReactNode {
  switch (block.type) {
    case "stat":
      return <KpiCard item={block} />;
    case "bar":
      return <Bar {...block} />;
    case "chart":
      return <Chart spec={block.spec} />;
    case "table":
      return <Table {...block} />;
    case "source":
      return <Source {...block} />;
  }
}
