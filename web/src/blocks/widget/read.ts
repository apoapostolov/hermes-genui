// One `widget` block: a small piece of local state, expressions over it, and an authored tree of layout, content,
// control and structure elements. This file reads the stored JSON into that tree and refuses everything the contract
// does not allow; Widget.tsx draws it. Nothing here sends, fetches or writes to the host: the only outward action a
// widget can take is the composer's guarded `fill`.
//
// The reader drops what does not fit and notes why, as every reader here does (core/readBlocks.ts). A widget with a
// broken version, id, state or computed graph is dropped whole: those decide whether anything can be drawn safely.
// A broken element is dropped on its own, so the rest of the widget still draws.
import { actsBeforeTheModel, firstText, https, num, str, Trail } from "../../core/fields";
import { checkExpr, computedReferences, evaluate, isReference, type Expr, type ExprScope } from "./expr";
import { readBar, type BarBlock } from "../atoms/read";
import { readChart, type ChartBlock } from "../chart/read";
import { readStat, type StatBlock } from "../kpis/read";
import { readSource, type SourceBlock } from "../source/read";
import { readTable, type TableBlock } from "../table/read";

export const WIDGET_VERSION = 1;
export const MAX_STATE = 16;
export const MAX_COMPUTED = 32;
export const MAX_NODES = 200;
export const MAX_DEPTH = 8;
export const MAX_REPEAT_ITEMS = 100;
export const MAX_FILL_FIELDS = 8;

/** A state name, an element id, a repeat key: a letter, then letters, digits, `_` or `-`, at most 64 characters. */
const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
/** A segment that would reach the prototype instead of a declared name. */
const PROTO = new Set(["__proto__", "prototype", "constructor"]);
/** Keys that would turn agent-written JSON into an instruction. */
const FORBIDDEN_KEYS = new Set(["fetch", "tool", "tools", "include"]);

export type WidgetGap = "xs" | "sm" | "md" | "lg";
export type WidgetTone = "muted" | "good" | "warn" | "bad" | "info";
export type ControlKind = "number" | "slider" | "select" | "checkbox" | "text";
export type EmbedKind = "stat" | "bar" | "chart" | "table" | "source";

export const GAPS: WidgetGap[] = ["xs", "sm", "md", "lg"];
export const TONES: WidgetTone[] = ["muted", "good", "warn", "bad", "info"];
export const CONTROLS: ControlKind[] = ["number", "slider", "select", "checkbox", "text"];
export const EMBED_KINDS: EmbedKind[] = ["stat", "bar", "chart", "table", "source"];

/** One declaration in `state`. Numbers carry their bounds, strings their length and options, booleans just a value. */
export type NumberDecl = { type: "number"; label: string; initial: number; min: number; max: number; step: number };
export type StringDecl = { type: "string"; label: string; initial: string; maxLength: number; options?: string[] };
export type BooleanDecl = { type: "boolean"; label: string; initial: boolean };
export type StateDecl = NumberDecl | StringDecl | BooleanDecl;
export type StateValues = Record<string, number | string | boolean>;

export type SetAction = { op: "set"; state: string; value: Expr };
export type ResetAction = { op: "reset" };
export type FillAction = { op: "fill"; message: string; fields: string[] };
export type WidgetAction = SetAction | ResetAction | FillAction;

type NodeBase = { id: string };
export type StackNode = NodeBase & { kind: "stack"; gap?: WidgetGap; children: WidgetNode[] };
export type RowNode = NodeBase & { kind: "row"; gap?: WidgetGap; children: WidgetNode[] };
export type GridNode = NodeBase & { kind: "grid"; gap?: WidgetGap; columns: number; children: WidgetNode[] };
export type SurfaceNode = NodeBase & { kind: "surface"; gap?: WidgetGap; children: WidgetNode[] };
export type TextNode = NodeBase & { kind: "text"; text?: string; expr?: Expr; tone?: WidgetTone };
export type NumberNode = NodeBase & { kind: "number"; expr: Expr; label?: string; unit?: string; tone?: WidgetTone };
export type BadgeNode = NodeBase & { kind: "badge"; text?: string; expr?: Expr; tone?: WidgetTone };
export type DividerNode = NodeBase & { kind: "divider" };
export type ImageNode = NodeBase & { kind: "image"; url: string; alt: string };
export type LinkNode = NodeBase & { kind: "link"; text: string; url: string };
export type InputNode = NodeBase & { kind: "input"; control: ControlKind; state: string; label: string };
export type ButtonNode = NodeBase & { kind: "button"; label: string; action: WidgetAction };
export type WhenNode = NodeBase & { kind: "when"; test: Expr; then: WidgetNode[]; else: WidgetNode[] };
export type RepeatNode = NodeBase & { kind: "repeat"; items: Expr; key: string; template: WidgetNode[]; empty: WidgetNode[] };
export type EmbedNode = NodeBase & { kind: "block"; spec: Record<string, unknown>; bindings: Record<string, Expr> };

export type WidgetNode =
  | StackNode | RowNode | GridNode | SurfaceNode | TextNode | NumberNode | BadgeNode | DividerNode | ImageNode
  | LinkNode | InputNode | ButtonNode | WhenNode | RepeatNode | EmbedNode;

export type EmbedBlock = StatBlock | BarBlock | ChartBlock | TableBlock | SourceBlock;

export type WidgetBlock = {
  type: "widget";
  version: typeof WIDGET_VERSION;
  id: string;
  title: string;
  data: Record<string, unknown>;
  state: Record<string, StateDecl>;
  computed: Record<string, Expr>;
  view: WidgetNode[];
};

/** What a reader carries down the authored tree. */
type ReadContext = {
  data: Record<string, unknown>;
  state: Record<string, StateDecl>;
  seen: Set<string>;
  budget: { used: number };
  depth: number;
  inRepeat: boolean;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function ident(v: unknown): string | undefined {
  return typeof v === "string" && NAME.test(v) ? v : undefined;
}

function gap(v: unknown): WidgetGap | undefined {
  return GAPS.includes(v as WidgetGap) ? (v as WidgetGap) : undefined;
}

function tone(v: unknown): WidgetTone | undefined {
  return TONES.includes(v as WidgetTone) ? (v as WidgetTone) : undefined;
}

/**
 * widget: one composable block with local state. Version 1 only; the id and title name it for a screen reader.
 * State, computed values and the authored view are read here; Widget.tsx evaluates and draws them.
 *   {type: "widget", version: 1, id: "trip", title: "Trip", state: {nights: {…}}, computed: {…}, view: [{kind: "text", …}]}
 * Dropped: any other version, a missing or malformed id/title, unusable state or computed, a cycle in computed, a
 * view that is not a list, data carrying fetch/tool/tools/include, or more than 200 elements.
 */
export function readWidget(raw: any, here: Trail): WidgetBlock | null {
  if (!isObject(raw)) return here.drop("widget must be an object");
  if (raw.version !== WIDGET_VERSION) return here.drop("widget version must be 1");
  const id = ident(raw.id);
  if (!id) return here.drop("widget needs an id");
  const title = firstText([raw.title], 120);
  if (!title) return here.drop("widget needs a title");

  const data = readData(raw.data, here.at("data"));
  if (!data) return null;
  const state = readState(raw.state, here.at("state"));
  if (!state) return null;
  const computed = readComputed(raw.computed, here.at("computed"));
  if (!computed) return null;
  if (!Array.isArray(raw.view)) return here.drop("widget needs a view list");

  const context: ReadContext = { data, state, seen: new Set(), budget: { used: 0 }, depth: 1, inRepeat: false };
  const view = readNodes(raw.view, here.at("view"), context);
  return { type: "widget", version: WIDGET_VERSION, id, title, data, state, computed, view };
}

/** Agent-written data: plain JSON, with no key or block that would ask the host to do something. */
function readData(raw: unknown, here: Trail): Record<string, unknown> | null {
  if (raw === undefined || raw === null) return {};
  if (!isObject(raw)) return here.drop("widget data must be an object");
  const why = forbidden(raw, 0);
  if (why) return here.drop(why);
  return raw;
}

function forbidden(value: unknown, depth: number): string | null {
  if (depth > 12) return "widget data is nested too deep";
  if (Array.isArray(value)) {
    for (const item of value) {
      const why = forbidden(item, depth + 1);
      if (why) return why;
    }
    return null;
  }
  if (!isObject(value)) return null;
  if (value.type === "include") return "widget data can't carry an include block";
  for (const [key, inner] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return `widget data can't carry "${key}"`;
    const why = forbidden(inner, depth + 1);
    if (why) return why;
  }
  return null;
}

function readState(raw: unknown, here: Trail): Record<string, StateDecl> | null {
  if (raw === undefined || raw === null) return {};
  if (!isObject(raw)) return here.drop("widget state must be an object");
  const names = Object.keys(raw);
  if (names.length > MAX_STATE) return here.drop(`widget state keeps ${MAX_STATE} entries`);
  const state: Record<string, StateDecl> = {};
  for (const name of names) {
    if (!NAME.test(name) || PROTO.has(name)) return here.at(name).drop("state name must be a letter, then letters, digits, _ or -");
    const decl = readDecl(raw[name], here.at(name));
    if (!decl) return null;
    state[name] = decl;
  }
  return state;
}

function readDecl(raw: unknown, here: Trail): StateDecl | null {
  if (!isObject(raw)) return here.drop("a state entry must be an object");
  const label = firstText([raw.label], 40);
  if (!label) return here.drop("a state entry needs a label");
  if (raw.type === "number") {
    const initial = num(raw.initial);
    const min = num(raw.min);
    const max = num(raw.max);
    const step = num(raw.step);
    if (initial === null || min === null || max === null || step === null) return here.drop("a number needs finite initial, min, max and step");
    if (min > max) return here.drop("a number's min is above its max");
    if (initial < min || initial > max) return here.drop("a number's initial is outside min and max");
    if (step <= 0) return here.drop("a number's step must be above zero");
    return { type: "number", label, initial, min, max, step };
  }
  if (raw.type === "string") {
    if (typeof raw.initial !== "string") return here.drop("a string's initial must be text");
    const maxLength = num(raw.maxLength);
    if (maxLength === null || maxLength < 1 || !Number.isInteger(maxLength)) return here.drop("a string needs a whole maxLength above zero");
    if (raw.initial.length > maxLength) return here.drop("a string's initial is longer than maxLength");
    const decl: StringDecl = { type: "string", label, initial: raw.initial, maxLength };
    const options = readOptions(raw.options, maxLength, here);
    if (options) decl.options = options;
    return decl;
  }
  if (raw.type === "boolean") {
    if (typeof raw.initial !== "boolean") return here.drop("a boolean's initial must be true or false");
    return { type: "boolean", label, initial: raw.initial };
  }
  return here.drop('a state entry type must be "number", "string" or "boolean"');
}

/** A select's choices: short strings, at most 24, no repeats; anything else is a note and no options. */
function readOptions(raw: unknown, maxLength: number, here: Trail): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    here.drop("options must be a list of text");
    return undefined;
  }
  const options: string[] = [];
  for (const option of raw) {
    const text = str(option, maxLength);
    if (text === undefined) {
      here.drop("an option must be text within maxLength");
      continue;
    }
    if (!options.includes(text)) options.push(text);
  }
  if (options.length > 24) here.drop("options keeps 24 entries");
  return options.slice(0, 24);
}

function readComputed(raw: unknown, here: Trail): Record<string, Expr> | null {
  if (raw === undefined || raw === null) return {};
  if (!isObject(raw)) return here.drop("widget computed must be an object");
  const names = Object.keys(raw);
  if (names.length > MAX_COMPUTED) return here.drop(`widget computed keeps ${MAX_COMPUTED} entries`);
  const computed: Record<string, Expr> = {};
  for (const name of names) {
    if (!NAME.test(name) || PROTO.has(name)) return here.at(name).drop("computed name must be a letter, then letters, digits, _ or -");
    const why = checkExpr(raw[name]);
    if (why) return here.at(name).drop(`computed "${name}": ${why}`);
    computed[name] = raw[name] as Expr;
  }
  const cycle = findCycle(computed);
  if (cycle) return here.drop(`computed has a cycle through "${cycle}"`);
  return computed;
}

/** The first computed name that leads back to itself, or null. */
function findCycle(computed: Record<string, Expr>): string | null {
  const state = new Map<string, "open" | "done">();
  const walk = (name: string): string | null => {
    if (state.get(name) === "done") return null;
    if (state.get(name) === "open") return name;
    state.set(name, "open");
    for (const next of computedReferences(computed[name])) {
      if (!Object.hasOwn(computed, next)) continue;
      const found = walk(next);
      if (found) return found;
    }
    state.set(name, "done");
    return null;
  };
  for (const name of Object.keys(computed)) {
    const found = walk(name);
    if (found) return found;
  }
  return null;
}

function readNodes(list: unknown[], here: Trail, context: ReadContext): WidgetNode[] {
  const nodes: WidgetNode[] = [];
  list.forEach((raw, i) => {
    const node = readNode(raw, here.at(i), context);
    if (node) nodes.push(node);
  });
  return nodes;
}

function readNode(raw: unknown, here: Trail, context: ReadContext): WidgetNode | null {
  if (!isObject(raw)) return here.drop("an element must be an object");
  if (context.depth > MAX_DEPTH) return here.drop(`widget elements nest ${MAX_DEPTH} deep`);
  if (context.budget.used >= MAX_NODES) return here.drop(`widget keeps ${MAX_NODES} elements`);
  const id = ident(raw.id);
  if (!id) return here.drop("an element needs an id (a letter, then letters, digits, _ or -)");
  if (context.seen.has(id)) return here.drop(`element id "${id}" is used twice`);
  context.seen.add(id);
  context.budget.used += 1;

  switch (raw.kind) {
    case "stack":
    case "row":
    case "grid":
    case "surface":
      return readBox(raw, here, context, id);
    case "text":
      return readText(raw, here, id);
    case "number":
      return readNumber(raw, here, id);
    case "badge":
      return readBadge(raw, here, id);
    case "divider":
      return { kind: "divider", id };
    case "image":
      return readImage(raw, here, id);
    case "link":
      return readLink(raw, here, id);
    case "input":
      return readInput(raw, here, context, id);
    case "button":
      return readButton(raw, here, context, id);
    case "when":
      return readWhen(raw, here, context, id);
    case "repeat":
      return readRepeat(raw, here, context, id);
    case "block":
      return readEmbedded(raw, here, id);
    default:
      return here.drop(`unknown element kind "${String(raw.kind)}"`);
  }
}

function readBox(raw: Record<string, unknown>, here: Trail, context: ReadContext, id: string): WidgetNode | null {
  if (!Array.isArray(raw.children)) return here.drop(`${raw.kind} needs a children list`);
  const children = readNodes(raw.children, here.at("children"), { ...context, depth: context.depth + 1 });
  const box = { id, gap: gap(raw.gap), children };
  if (raw.kind === "grid") {
    const columns = num(raw.columns) ?? 2;
    if (!Number.isInteger(columns) || columns < 1 || columns > 4) return here.drop("a grid has 1 to 4 columns");
    return { kind: "grid", ...box, columns };
  }
  return { kind: raw.kind as "stack" | "row" | "surface", ...box };
}

function readText(raw: Record<string, unknown>, here: Trail, id: string): WidgetNode | null {
  const text = str(raw.text, 600);
  const expr = readExpr(raw.expr);
  if (expr === null) return here.drop("text expression is malformed");
  if (text === undefined && expr === undefined) return here.drop("text needs text or an expression");
  return cleanNode({ kind: "text" as const, id, text, expr, tone: tone(raw.tone) });
}

function readNumber(raw: Record<string, unknown>, here: Trail, id: string): WidgetNode | null {
  const expr = readExpr(raw.expr);
  if (expr === null) return here.drop("number expression is malformed");
  if (expr === undefined) return here.drop("number needs an expression");
  return cleanNode({ kind: "number" as const, id, expr, label: str(raw.label, 40), unit: str(raw.unit, 12), tone: tone(raw.tone) });
}

function readBadge(raw: Record<string, unknown>, here: Trail, id: string): WidgetNode | null {
  const text = str(raw.text, 40);
  const expr = readExpr(raw.expr);
  if (expr === null) return here.drop("badge expression is malformed");
  if (text === undefined && expr === undefined) return here.drop("badge needs text or an expression");
  return cleanNode({ kind: "badge" as const, id, text, expr, tone: tone(raw.tone) });
}

function readImage(raw: Record<string, unknown>, here: Trail, id: string): ImageNode | null {
  const url = https(raw.url);
  if (!url) return here.drop("image needs a literal https url");
  const alt = str(raw.alt, 200);
  if (!alt) return here.drop("image needs alt text");
  return { kind: "image", id, url, alt };
}

function readLink(raw: Record<string, unknown>, here: Trail, id: string): LinkNode | null {
  const url = https(raw.url);
  if (!url) return here.drop("link needs a literal https url");
  const text = str(raw.text, 80);
  if (!text) return here.drop("link needs text");
  return { kind: "link", id, text, url };
}

function readInput(raw: Record<string, unknown>, here: Trail, context: ReadContext, id: string): InputNode | null {
  const control = CONTROLS.includes(raw.control as ControlKind) ? (raw.control as ControlKind) : null;
  if (!control) return here.drop("input control must be number, slider, select, checkbox or text");
  const name = stateName(raw.state);
  if (!name || !Object.hasOwn(context.state, name)) return here.drop("input needs a declared state name");
  const decl = context.state[name];
  const expected = control === "number" || control === "slider" ? "number" : control === "checkbox" ? "boolean" : "string";
  if (decl.type !== expected) return here.drop(`a ${control} input needs a ${expected} state entry`);
  if (control === "select" && (!("options" in decl) || !decl.options?.length)) return here.drop("a select input needs options on its state entry");
  const label = str(raw.label, 40);
  if (!label) return here.drop("input needs a visible label");
  return { kind: "input", id, control, state: name, label };
}

function readButton(raw: Record<string, unknown>, here: Trail, context: ReadContext, id: string): ButtonNode | null {
  const label = str(raw.label, 60);
  if (!label) return here.drop("button needs a label");
  const action = readAction(raw.action, here.at("action"), context);
  if (!action) return null;
  return { kind: "button", id, label, action };
}

function readAction(raw: unknown, here: Trail, context: ReadContext): WidgetAction | null {
  if (!isObject(raw)) return here.drop("button needs an action");
  if (raw.op === "reset") return { op: "reset" };
  if (raw.op === "set") {
    const name = stateName(raw.state);
    if (!name || !Object.hasOwn(context.state, name)) return here.drop("set needs a declared state name");
    const value = readExpr(raw.value);
    if (value === null) return here.drop("set value expression is malformed");
    if (value === undefined) return here.drop("set needs a value expression");
    return { op: "set", state: name, value };
  }
  if (raw.op === "fill") {
    const message = str(raw.message, 300);
    if (!message) return here.drop("fill needs a message");
    if (actsBeforeTheModel(message)) return here.drop("a fill message can't start with / @ or ! or carry @-references");
    const fields = readFillFields(raw.fields, context, here);
    if (!fields) return null;
    return { op: "fill", message, fields };
  }
  return here.drop("a button action must be set, reset or fill");
}

function readFillFields(raw: unknown, context: ReadContext, here: Trail): string[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return here.drop("fill fields must be a list of state names");
  const fields: string[] = [];
  for (const entry of raw) {
    const name = stateName(entry);
    if (!name || !Object.hasOwn(context.state, name)) return here.drop("fill fields must name declared state entries");
    if (!fields.includes(name)) fields.push(name);
  }
  if (fields.length > MAX_FILL_FIELDS) return here.drop(`fill keeps ${MAX_FILL_FIELDS} fields`);
  return fields;
}

function readWhen(raw: Record<string, unknown>, here: Trail, context: ReadContext, id: string): WhenNode | null {
  const test = readExpr(raw.test);
  if (test === null) return here.drop("when test expression is malformed");
  if (test === undefined) return here.drop("when needs a test expression");
  if (!Array.isArray(raw.then)) return here.drop("when needs a then list");
  if (raw.else !== undefined && !Array.isArray(raw.else)) return here.drop("else must be a list");
  const branch = { ...context, depth: context.depth + 1 };
  return {
    kind: "when",
    id,
    test,
    then: readNodes(raw.then, here.at("then"), branch),
    else: Array.isArray(raw.else) ? readNodes(raw.else, here.at("else"), branch) : [],
  };
}

function readRepeat(raw: Record<string, unknown>, here: Trail, context: ReadContext, id: string): RepeatNode | null {
  if (context.inRepeat) return here.drop("a repeat cannot nest inside another repeat");
  const items = readExpr(raw.items);
  if (items === null) return here.drop("repeat items expression is malformed");
  const path = items === undefined ? "" : (items as { get?: string }).get;
  if (!isReference(path) || !path.startsWith("data.")) return here.drop("repeat items must reference a data list");
  const list = context.data[path.slice("data.".length)];
  if (!Array.isArray(list)) return here.drop("repeat items must reference a data list");
  const key = ident(raw.key);
  if (!key) return here.drop("repeat needs a key field name");
  if (!Array.isArray(raw.template) || !raw.template.length) return here.drop("repeat needs a template list");
  if (raw.empty !== undefined && !Array.isArray(raw.empty)) return here.drop("repeat empty must be a list");
  const branch = { ...context, depth: context.depth + 1, inRepeat: true };
  const node: RepeatNode = {
    kind: "repeat",
    id,
    items: items as Expr,
    key,
    template: readNodes(raw.template, here.at("template"), branch),
    empty: Array.isArray(raw.empty) ? readNodes(raw.empty, here.at("empty"), branch) : [],
  };
  if (list.length > MAX_REPEAT_ITEMS) here.drop(`repeat keeps the first ${MAX_REPEAT_ITEMS} items`);
  const shown = list.slice(0, MAX_REPEAT_ITEMS);
  if (shown.length && !itemsKeyed(node, shown)) return here.drop(`repeat needs a unique "${key}" on every item`);
  return node;
}

/** The data list a repeat walks, at read time, so the key can be checked before anything draws. */
export function repeatItems(block: WidgetBlock, node: RepeatNode): unknown[] {
  const path = (node.items as { get: string }).get;
  const value = block.data[path.slice("data.".length)];
  return Array.isArray(value) ? value.slice(0, MAX_REPEAT_ITEMS) : [];
}

function readEmbedded(raw: Record<string, unknown>, here: Trail, id: string): EmbedNode | null {
  if (!isObject(raw.spec)) return here.drop("block needs a spec object");
  const kind = raw.spec.type;
  if (kind === "include" || kind === "widget") return here.drop(`widget can't embed ${kind}`);
  if (!EMBED_KINDS.includes(kind as EmbedKind)) {
    return here.drop("widget can embed stat, bar, chart, table or source");
  }
  const embed = kind as EmbedKind;
  const bindings = readBindings(raw.bindings, embed, raw.spec, here.at("bindings"));
  if (bindings === null) return null;
  if (!readEmbed(embed, raw.spec)) return here.drop(`embedded ${embed} doesn't read`);
  return { kind: "block", id, spec: raw.spec, bindings };
}

function readBindings(
  raw: unknown,
  kind: EmbedKind,
  spec: Record<string, unknown>,
  here: Trail,
): Record<string, Expr> | null {
  if (raw === undefined) return {};
  if (!isObject(raw)) return here.drop("bindings must be an object of pointer → expression");
  const bindings: Record<string, Expr> = {};
  for (const [pointer, expr] of Object.entries(raw)) {
    const target = bindingTarget(pointer, kind);
    if (!target) {
      here.drop(`binding "${pointer}" is not allowed on ${kind}`);
      continue;
    }
    const value = readExpr(expr);
    if (value === null) {
      here.drop(`binding "${pointer}" is not a valid expression`);
      continue;
    }
    if (value === undefined) {
      here.drop(`binding "${pointer}" needs an expression`);
      continue;
    }
    if (!target.exists(spec)) {
      here.drop(`binding "${pointer}" points outside the ${kind}`);
      continue;
    }
    bindings[pointer] = value;
  }
  return bindings;
}

/** Where a binding may write: the pointers the contract allows, and whether the written spec has that slot. */
function bindingTarget(pointer: string, kind: EmbedKind): { exists: (spec: Record<string, unknown>) => boolean } | null {
  if (kind === "stat") return pointer === "/value" ? { exists: () => true } : null;
  if (kind === "bar") {
    if (pointer === "/value" || pointer === "/max") return { exists: () => true };
    return null;
  }
  if (kind === "chart") {
    const match = /^\/series\/(\d+)\/data\/(\d+)$/.exec(pointer);
    if (!match) return null;
    const series = Number(match[1]);
    const point = Number(match[2]);
    return {
      exists: (spec) => {
        const list = spec.series;
        if (!Array.isArray(list) || !isObject(list[series])) return false;
        const data = (list[series] as Record<string, unknown>).data;
        return Array.isArray(data) && point < data.length;
      },
    };
  }
  if (kind === "table") {
    const match = /^\/rows\/(\d+)\/(\d+|[A-Za-z0-9_-]+)$/.exec(pointer);
    if (!match) return null;
    const row = Number(match[1]);
    const cell = match[2];
    return {
      exists: (spec) => {
        const rows = spec.rows;
        if (!Array.isArray(rows)) return false;
        const one = rows[row];
        if (Array.isArray(one)) return Number(cell) < one.length;
        return isObject(one);  // a row written as an object takes the cell key it is given
      },
    };
  }
  return null;  // source is drawn unbound
}

/** An expression, `undefined` when the field is absent, or `null` when it is there but cannot be read. */
function readExpr(raw: unknown): Expr | null | undefined {
  if (raw === undefined) return undefined;
  return checkExpr(raw) === null ? (raw as Expr) : null;
}

function stateName(raw: unknown): string | undefined {
  const text = typeof raw === "string" ? raw.trim() : "";
  const name = text.startsWith("state.") ? text.slice("state.".length) : text;
  return NAME.test(name) && !PROTO.has(name) ? name : undefined;
}

/** A node without the fields the model left out, so the drawn tree holds only what it wrote. */
function cleanNode<T extends { id: string }>(node: T): T {
  return Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined)) as T;
}

/**
 * The embedded block with its bound values written in, and one note per binding that could not be evaluated. The
 * structural parts (type, labels, columns, urls) are never touched: only the numeric slots the contract lists.
 *   ({value: 0, max: 1200}, {"/value": {"get": "computed.planned"}}, {computed: {planned: 800}}) → spec.value 800
 */
export function applyBindings(
  spec: Record<string, unknown>,
  bindings: Record<string, Expr>,
  scope: ExprScope,
): { spec: Record<string, unknown>; errors: string[] } {
  const out = cloneJson(spec) as Record<string, unknown>;
  const errors: string[] = [];
  for (const [pointer, expr] of Object.entries(bindings)) {
    const result = evaluate(expr, scope);
    if (result.error) {
      errors.push(`${pointer}: ${result.error}`);
      continue;
    }
    const segments = pointer.split("/").slice(1);
    const why = writeBinding(out, segments, result.value);
    if (why) errors.push(`${pointer}: ${why}`);
  }
  return { spec: out, errors };
}

/** Writes one bound value into the copied spec; returns why it could not, or null. */
function writeBinding(spec: Record<string, unknown>, segments: string[], value: unknown): string | null {
  const head = segments[0];
  if (head === "value" || head === "max") {
    if (value === null) {
      if (head !== "value") return "max needs a number";
      spec[head] = null;
      return null;
    }
    if (typeof value !== "number" || !isFinite(value)) return "not a finite number";
    if (head === "max" && value <= 0) return "max must be above zero";
    spec[head] = value;
    return null;
  }
  if (head === "series" && segments.length === 4) {
    if (value !== null && (typeof value !== "number" || !isFinite(value))) return "a chart point must be a number or null";
    const series = spec.series;
    if (!Array.isArray(series)) return "the chart has no series";
    const one = series[Number(segments[1])];
    if (!isObject(one) || !Array.isArray(one.data)) return "the chart point is outside the series";
    one.data[Number(segments[3])] = value;
    return null;
  }
  if (head === "rows" && segments.length === 3) {
    const cell = value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
    if (!cell) return "not a table cell";
    const rows = spec.rows;
    if (!Array.isArray(rows)) return "the table has no rows";
    const row = rows[Number(segments[1])];
    if (Array.isArray(row)) {
      row[Number(segments[2])] = value;
      return null;
    }
    if (isObject(row)) {
      row[segments[2]] = value;
      return null;
    }
    return "the table row is outside the table";
  }
  return "not an allowed binding target";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The block a `block` element embeds, read by that block's own reader (so it draws exactly as it does elsewhere). */
export function readEmbed(kind: EmbedKind, spec: unknown): EmbedBlock | null {
  const here = new Trail();
  switch (kind) {
    case "stat":
      return readStat(spec, here);
    case "bar":
      return readBar(spec, here);
    case "chart":
      return readChart(spec, here);
    case "table":
      return readTable(spec, here);
    case "source":
      return readSource(spec, here);
  }
}

/** One repeat item as the key the widget renders it by, or null when the item cannot be keyed. */
export function itemKey(node: RepeatNode, item: unknown): string | null {
  if (!isObject(item)) return null;
  const value = item[node.key];
  if (typeof value === "string" && value) return value;
  if (typeof value === "number" && isFinite(value)) return String(value);
  return null;
}

/** Whether every item of a repeat list carries its own key (read time only: data does not change). */
export function itemsKeyed(node: RepeatNode, items: unknown[]): boolean {
  const keys = new Set<string>();
  for (const item of items) {
    const key = itemKey(node, item);
    if (key === null || keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}

/** The state values a widget starts with, and returns to on reset. */
export function initialState(state: Record<string, StateDecl>): StateValues {
  return Object.fromEntries(Object.entries(state).map(([name, decl]) => [name, decl.initial]));
}
