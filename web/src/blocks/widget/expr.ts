// A widget block's expressions: a literal, a reference into `data`/`state`/`computed`/`item`, or one of a dozen
// operations. Evaluation never throws: every call gives a value and, when the expression cannot produce one, the exact
// error string the Python side gives ("divided by zero", "unknown reference" and the rest). A null value is an unknown
// (the model wrote nothing down, or a figure has no answer), never a zero.
//
// The same fixtures feed both sides (fixtures.json), so the two implementations are checked against one list of
// values and errors rather than against each other's prose.

/** Where a reference can read from: declared data, the current state, the computed values, and the repeat item. */
export type ExprScope = {
  data?: Record<string, unknown>;
  state?: Record<string, unknown>;
  computed?: Record<string, unknown>;
  item?: Record<string, unknown> | null;
};

/** A literal a widget may write: null, a boolean, a finite number or a short string. */
export type ExprLiteral = null | boolean | number | string;
/** A reference to one declared name: `state.nights`, `data.note`, `computed.total`, `item.id`. */
export type ExprRef = { get: string };
/** An operation over fixed-arity arguments. */
export type ExprOpNode = { op: ExprOp; args: Expr[] };
export type Expr = ExprLiteral | ExprRef | ExprOpNode;

/** What one evaluation gave: the value (null when unknown) and the reason when there is no value. */
export type ExprResult = { value: unknown; error: string | null };

/** The exact error strings. The Python side prints these, so they are not rewritten for the screen. */
export const DIVIDED_BY_ZERO = "divided by zero";
export const NON_FINITE = "non-finite result";
export const UNKNOWN_REFERENCE = "unknown reference";
export const UNKNOWN_OPERATOR = "unknown operator";
export const WRONG_OPERAND_TYPE = "wrong operand type";

/** Every operator and how many arguments it takes. */
export const ARITY: Record<ExprOp, number> = { add: 2, sub: 2, mul: 2, div: 2, eq: 2, lt: 2, lte: 2, and: 2, or: 2, not: 1, if: 3 };
export type ExprOp = "add" | "sub" | "mul" | "div" | "eq" | "lt" | "lte" | "and" | "or" | "not" | "if";
export const OPS = Object.keys(ARITY) as ExprOp[];

/** A reference's name: a letter, then letters, digits, `_` or `-`, at most 64 characters. */
const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
/** Segments that would reach the prototype rather than a declared name. */
const PROTO = new Set(["__proto__", "prototype", "constructor"]);

/** The longest literal string, and the deepest nesting an expression may reach. */
export const MAX_EXPR_STRING = 200;
export const MAX_EXPR_DEPTH = 6;

type Resolver = (name: string) => ExprResult | undefined;

const ok = (value: unknown): ExprResult => ({ value, error: null });
const fail = (error: string): ExprResult => ({ value: null, error });

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && isFinite(v);
}

/** Whether `path` names one declared value: `state.nights` yes; `state.a.b`, `state[0]` and `__proto__` no. */
export function isReference(path: unknown): path is string {
  if (typeof path !== "string") return false;
  const parts = path.split(".");
  if (parts.length !== 2) return false;
  const [root, key] = parts;
  if (PROTO.has(root) || PROTO.has(key)) return false;
  return (root === "data" || root === "state" || root === "computed" || root === "item") && NAME.test(key);
}

/** The computed names an expression reads, so a reader can refuse a cycle before anything draws. */
export function computedReferences(expr: unknown, found: string[] = []): string[] {
  if (!isObject(expr)) return found;
  if (typeof (expr as ExprRef).get === "string") {
    const path = (expr as ExprRef).get;
    if (path.startsWith("computed.")) found.push(path.slice("computed.".length));
    return found;
  }
  const args = (expr as ExprOpNode).args;
  if (Array.isArray(args)) for (const arg of args) computedReferences(arg, found);
  return found;
}

/**
 * Why an expression cannot be read, or null when it can. Checked before a widget is drawn, so a malformed expression
 * is a note on the block rather than a surprise inside a render.
 *   7 → null;  {"op": "div", "args": [1, 0]} → null;  Infinity → "non-finite literal"
 *   {"op": "pow", "args": [2, 3]} → "unknown operator";  {"get": "state.a.b"} → "bad reference"
 *   {"op": "not", "args": [true, false]} → "wrong arity"
 */
export function checkExpr(expr: unknown, depth = 0): string | null {
  if (depth > MAX_EXPR_DEPTH) return "expression nested too deep";
  if (expr === null || typeof expr === "boolean") return null;
  if (typeof expr === "number") return isFinite(expr) ? null : "non-finite literal";
  if (typeof expr === "string") return expr.length <= MAX_EXPR_STRING ? null : "string too long";
  if (!isObject(expr)) return "not an expression";
  if ("get" in expr) return isReference((expr as ExprRef).get) ? null : "bad reference";
  const op = (expr as ExprOpNode).op;
  if (typeof op !== "string" || !Object.hasOwn(ARITY, op)) return "unknown operator";
  const args = (expr as ExprOpNode).args;
  if (!Array.isArray(args) || args.length !== ARITY[op as ExprOp]) return "wrong arity";
  for (const arg of args) {
    const why = checkExpr(arg, depth + 1);
    if (why) return why;
  }
  return null;
}

/**
 * One expression in a scope.
 *   ({"get": "state.nights"}, {state: {nights: 4}}) → {value: 4, error: null}
 *   ({"op": "add", "args": [null, 2]}, {}) → {value: null, error: null}   (unknown stays unknown)
 *   ({"op": "div", "args": [1, 0]}, {}) → {value: null, error: "divided by zero"}
 *   ({"get": "state.missing"}, {state: {}}) → {value: null, error: "unknown reference"}
 * `resolveComputed` lets a computed definition read another one without this file knowing the graph.
 */
export function evaluate(expr: unknown, scope: ExprScope, resolveComputed?: Resolver): ExprResult {
  if (expr === null) return ok(null);
  if (typeof expr === "boolean" || typeof expr === "string") return ok(expr);
  if (typeof expr === "number") return isFinite(expr) ? ok(expr) : fail(NON_FINITE);
  if (!isObject(expr)) return fail(WRONG_OPERAND_TYPE);
  if ("get" in expr) return reference((expr as ExprRef).get, scope, resolveComputed);
  const op = (expr as Record<string, unknown>).op;
  if (typeof op !== "string" || !Object.hasOwn(ARITY, op)) return fail(UNKNOWN_OPERATOR);
  const args = (expr as Record<string, unknown>).args;
  const arity = ARITY[op as ExprOp];
  if (!Array.isArray(args) || args.length !== arity) return fail(WRONG_OPERAND_TYPE);
  const arg = (i: number) => evaluate(args[i], scope, resolveComputed);
  switch (op as ExprOp) {
    case "add":
    case "sub":
    case "mul":
    case "div":
      return arithmetic(op as "add" | "sub" | "mul" | "div", arg(0), arg(1));
    case "eq":
      return equal(arg(0), arg(1));
    case "lt":
    case "lte":
      return compare(op as "lt" | "lte", arg(0), arg(1));
    case "and":
    case "or":
      return logical(op as "and" | "or", arg(0), arg(1));
    case "not": {
      const value = arg(0);
      if (value.error) return value;
      if (value.value === null) return ok(null);
      if (typeof value.value !== "boolean") return fail(WRONG_OPERAND_TYPE);
      return ok(!value.value);
    }
    case "if": {
      const test = arg(0);
      if (test.error) return test;
      if (test.value === null) return ok(null);
      if (typeof test.value !== "boolean") return fail(WRONG_OPERAND_TYPE);
      return arg(test.value ? 1 : 2);  // the branch not taken is never evaluated
    }
  }
}

function reference(path: unknown, scope: ExprScope, resolve: Resolver | undefined): ExprResult {
  if (!isReference(path)) return fail(UNKNOWN_REFERENCE);
  const [root, key] = path.split(".");
  if (root === "computed" && resolve) {
    const defined = resolve(key);
    if (defined) return defined;
  }
  const bag = root === "data" ? scope.data : root === "state" ? scope.state : root === "computed" ? scope.computed : scope.item;
  if (!isObject(bag) || !Object.hasOwn(bag, key)) return fail(UNKNOWN_REFERENCE);
  const value = bag[key];
  return value === undefined ? fail(UNKNOWN_REFERENCE) : ok(value);
}

function arithmetic(op: "add" | "sub" | "mul" | "div", a: ExprResult, b: ExprResult): ExprResult {
  if (a.error) return a;
  if (b.error) return b;
  if (a.value === null || b.value === null) return ok(null);      // unknown in, unknown out
  if (!isNumber(a.value) || !isNumber(b.value)) return fail(WRONG_OPERAND_TYPE);
  if (op === "div" && b.value === 0) return fail(DIVIDED_BY_ZERO);
  const value = op === "add" ? a.value + b.value
    : op === "sub" ? a.value - b.value
    : op === "mul" ? a.value * b.value
    : a.value / b.value;
  return isFinite(value) ? ok(value) : fail(NON_FINITE);
}

function equal(a: ExprResult, b: ExprResult): ExprResult {
  if (a.error) return a;
  if (b.error) return b;
  if (a.value === null || b.value === null) return ok(null);
  if (isNumber(a.value) && isNumber(b.value)) return ok(a.value === b.value);
  if (typeof a.value === "string" && typeof b.value === "string") return ok(a.value === b.value);
  if (typeof a.value === "boolean" && typeof b.value === "boolean") return ok(a.value === b.value);
  if (isPrimitive(a.value) && isPrimitive(b.value)) return ok(false);
  return ok(null);  // a list or an object has no equality here
}

function compare(op: "lt" | "lte", a: ExprResult, b: ExprResult): ExprResult {
  if (a.error) return a;
  if (b.error) return b;
  if (a.value === null || b.value === null) return ok(null);
  const sameNumbers = isNumber(a.value) && isNumber(b.value);
  const sameStrings = typeof a.value === "string" && typeof b.value === "string";
  if (!sameNumbers && !sameStrings) return fail(WRONG_OPERAND_TYPE);
  const left = a.value as number | string;
  const right = b.value as number | string;
  return ok(op === "lt" ? left < right : left <= right);
}

function logical(op: "and" | "or", a: ExprResult, b: ExprResult): ExprResult {
  if (a.error) return a;
  if (a.value === null) return ok(null);
  if (typeof a.value !== "boolean") return fail(WRONG_OPERAND_TYPE);
  if (op === "and" && !a.value) return ok(false);   // decided: the right side is not evaluated
  if (op === "or" && a.value) return ok(true);
  if (b.error) return b;
  if (b.value === null) return ok(null);
  if (typeof b.value !== "boolean") return fail(WRONG_OPERAND_TYPE);
  return ok(op === "and" ? a.value && b.value : a.value || b.value);
}

function isPrimitive(v: unknown): boolean {
  return v === null || typeof v === "number" || typeof v === "string" || typeof v === "boolean";
}

/**
 * Every computed value, each definition evaluated once and in whatever order its references demand.
 *   {planned: {op: "mul", args: [{"get": "state.nights"}, 200]}, remaining: {op: "sub", args: [1200, {"get": "computed.planned"}]}}
 *   with state.nights 4 → {values: {planned: 800, remaining: 400}, errors: {planned: null, remaining: null}}
 * A definition that reads itself (a cycle the reader should have refused) comes back as "unknown reference" rather
 * than hanging.
 */
export function evaluateComputed(
  definitions: Record<string, unknown>,
  base: { data?: Record<string, unknown>; state?: Record<string, unknown>; item?: Record<string, unknown> | null },
): { values: Record<string, unknown>; errors: Record<string, string | null> } {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string | null> = {};
  const visiting = new Set<string>();
  const find = (name: string): ExprResult | undefined => {
    if (!Object.hasOwn(definitions, name)) return undefined;
    if (Object.hasOwn(values, name)) return { value: values[name], error: errors[name] };
    if (visiting.has(name)) return fail(UNKNOWN_REFERENCE);
    visiting.add(name);
    const result = evaluate(definitions[name], { ...base, computed: values }, find);
    visiting.delete(name);
    values[name] = result.value;
    errors[name] = result.error;
    return result;
  };
  for (const name of Object.keys(definitions)) find(name);
  return { values, errors };
}
