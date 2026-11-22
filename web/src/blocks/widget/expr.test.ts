// The expression language, checked against the fixtures both sides share. Every case in fixtures.json is one expected
// value and one expected error string; the Python side reads the same file, so a change in either implementation shows
// up here as a failed case rather than as two screens disagreeing.
import { describe, expect, it } from "vitest";
import fixtures from "./fixtures.json";
import { checkExpr, computedReferences, evaluate, evaluateComputed, isReference, type ExprScope } from "./expr";

type ExpressionFixture = { name: string; expr: unknown; scope: ExprScope; value: unknown; error: string | null };

const cases = fixtures.expressions as unknown as ExpressionFixture[];

describe("the shared expression fixtures", () => {
  it("has the cases both sides are pinned to", () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
    expect(cases.map((c) => c.name)).toEqual(expect.arrayContaining([
      "null-propagation", "if-short-circuit", "division-by-zero", "wrong-operand-type", "unknown-reference",
      "unknown-operator", "non-finite-result",
    ]));
  });

  for (const one of cases) {
    it(`${one.name} gives ${JSON.stringify(one.value)} and ${JSON.stringify(one.error)}`, () => {
      expect(evaluate(one.expr, one.scope)).toEqual({ value: one.value, error: one.error });
    });
  }
});

describe("evaluation", () => {
  it("reads only declared names, never a prototype segment or an index", () => {
    expect(evaluate({ get: "state.nights" }, { state: { nights: 4 } }).value).toBe(4);
    for (const path of ["state.__proto__", "state.constructor", "state.a.b", "state[0]", "other.x", "state."]) {
      expect(evaluate({ get: path }, { state: { nights: 4 } })).toEqual({ value: null, error: "unknown reference" });
      expect(isReference(path)).toBe(false);
    }
  });

  it("keeps a value written as null apart from a name that was never declared", () => {
    expect(evaluate({ get: "data.note" }, { data: { note: null } })).toEqual({ value: null, error: null });
    expect(evaluate({ get: "data.note" }, { data: {} })).toEqual({ value: null, error: "unknown reference" });
  });

  it("evaluates only the branch an if selects, on either side", () => {
    const broken = { op: "div", args: [1, 0] };
    expect(evaluate({ op: "if", args: [true, "taken", broken] }, {})).toEqual({ value: "taken", error: null });
    expect(evaluate({ op: "if", args: [false, "taken", broken] }, {})).toEqual({ value: null, error: "divided by zero" });
    expect(evaluate({ op: "if", args: [null, "taken", "other"] }, {})).toEqual({ value: null, error: null });
    expect(evaluate({ op: "if", args: [1, "taken", "other"] }, {})).toEqual({ value: null, error: "wrong operand type" });
  });

  it("stops and/or once the answer is decided", () => {
    const broken = { op: "div", args: [1, 0] };
    expect(evaluate({ op: "and", args: [false, broken] }, {})).toEqual({ value: false, error: null });
    expect(evaluate({ op: "or", args: [true, broken] }, {})).toEqual({ value: true, error: null });
    expect(evaluate({ op: "and", args: [true, broken] }, {})).toEqual({ value: null, error: "divided by zero" });
  });

  it("compares like with like and refuses a mixed comparison", () => {
    expect(evaluate({ op: "lte", args: ["a", "b"] }, {})).toEqual({ value: true, error: null });
    expect(evaluate({ op: "lt", args: [1, "2"] }, {})).toEqual({ value: null, error: "wrong operand type" });
    expect(evaluate({ op: "eq", args: [1, "1"] }, {})).toEqual({ value: false, error: null });
    expect(evaluate({ op: "eq", args: [{ get: "data.a" }, { get: "data.b" }] }, { data: { a: [1], b: [1] } }))
      .toEqual({ value: null, error: null });
  });

  it("gives one error string per failure", () => {
    expect(evaluate({ op: "mul", args: [1e308, 10] }, {})).toEqual({ value: null, error: "non-finite result" });
    expect(evaluate({ op: "not", args: [1] }, {})).toEqual({ value: null, error: "wrong operand type" });
    expect(evaluate({ op: "pow", args: [2, 3] }, {})).toEqual({ value: null, error: "unknown operator" });
    expect(evaluate({ op: "add", args: [1] }, {})).toEqual({ value: null, error: "wrong operand type" });
    expect(evaluate({ other: 1 }, {})).toEqual({ value: null, error: "unknown operator" });
  });
});

describe("checkExpr", () => {
  it("accepts what the contract allows", () => {
    expect(checkExpr(7)).toBeNull();
    expect(checkExpr("text")).toBeNull();
    expect(checkExpr(null)).toBeNull();
    expect(checkExpr({ get: "computed.total" })).toBeNull();
    expect(checkExpr({ op: "if", args: [true, { get: "item.id" }, "none"] })).toBeNull();
  });

  it("names what it refuses", () => {
    expect(checkExpr({ op: "pow", args: [2, 3] })).toBe("unknown operator");
    expect(checkExpr({ get: "state.a.b" })).toBe("bad reference");
    expect(checkExpr({ get: "__proto__" })).toBe("bad reference");
    expect(checkExpr({ op: "not", args: [true, false] })).toBe("wrong arity");
    expect(checkExpr(Number.POSITIVE_INFINITY)).toBe("non-finite literal");
    expect(checkExpr("x".repeat(201))).toBe("string too long");
    expect(checkExpr([1, 2])).toBe("not an expression");
    expect(checkExpr({ op: "if", args: [{ op: "not", args: [{ op: "not", args: [{ op: "not", args: [true] }] }] }] })).toBe("wrong arity");
  });

  it("lists the computed names an expression reads, at any depth", () => {
    expect(computedReferences({ op: "if", args: [{ get: "computed.a" }, { get: "computed.b" }, 0] })).toEqual(["a", "b"]);
    expect(computedReferences({ get: "state.nights" })).toEqual([]);
  });
});

describe("evaluateComputed", () => {
  const computed = {
    planned: { op: "mul", args: [{ get: "state.nights" }, { get: "data.nightly" }] },
    remaining: { op: "sub", args: [{ get: "data.budget" }, { get: "computed.planned" }] },
    over: { op: "lt", args: [{ get: "computed.remaining" }, 0] },
  };

  it("works out a definition's dependencies first", () => {
    const { values, errors } = evaluateComputed(computed, { data: { nightly: 200, budget: 1200 }, state: { nights: 7 } });
    expect(values).toEqual({ planned: 1400, remaining: -200, over: true });
    expect(errors).toEqual({ planned: null, remaining: null, over: null });
  });

  it("keeps the error on the definition that failed and still resolves the rest", () => {
    const { values, errors } = evaluateComputed(
      { bad: { op: "div", args: [1, 0] }, good: { op: "add", args: [1, 2] } },
      {},
    );
    expect(values).toEqual({ bad: null, good: 3 });
    expect(errors).toEqual({ bad: "divided by zero", good: null });
  });

  it("does not hang on a cycle the reader should have refused", () => {
    const { values, errors } = evaluateComputed(
      { a: { get: "computed.b" }, b: { get: "computed.a" } },
      {},
    );
    expect(values.a).toBeNull();
    expect(values.b).toBeNull();
    expect(errors.a).toBe("unknown reference");
    expect(errors.b).toBe("unknown reference");
  });
});
