// What a widget reads and what it does: the three shared fixtures are read and drawn here exactly as the Python side
// checks them, so a fixture the renderer cannot read is a failing test rather than a blank card.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Trail } from "../../core/fields";
import { drawWithActions } from "../../core/testing";
import { readBlocksNoted } from "../../core/readBlocks";
import type { Expr } from "./expr";
import { applyBindings, readWidget } from "./read";

afterEach(cleanup);

// The shared fixture file is JSON, imported so a changed value is a changed test, not a copied constant.
import fixturesJson from "./fixtures.json";

type Raw = Record<string, any>;
const widgets = fixturesJson.widgets as unknown as Raw[];
const byId = (id: string) => JSON.parse(JSON.stringify(widgets.find((w) => w.id === id))) as Raw;

/** A widget built in the test, for the pieces the three fixtures do not each show (reset, stat, source, errors). */
const handMade = (view: unknown[], over: Raw = {}): Raw => ({
  type: "widget",
  version: 1,
  id: "hand-made",
  title: "Hand made",
  data: { total: 12, note: "Fixture note" },
  state: { nights: { type: "number", label: "Nights", initial: 2, min: 0, max: 10, step: 1 } },
  computed: {},
  view,
  ...over,
});

/** The drawn value of one `number` element, by its label (a bar's label is not a figure). */
function figure(label: string): string {
  const figures = Array.from(document.querySelectorAll<HTMLElement>(".hb-widget-figure"));
  const one = figures.find((f) => f.querySelector(".hb-widget-figure-label")?.textContent === label);
  return one?.querySelector(".hb-widget-figure-value")?.textContent ?? "";
}

describe("the shared widgets", () => {
  it("reads all three without dropping anything", () => {
    const { blocks, dropped } = readBlocksNoted(widgets);
    expect(dropped).toEqual([]);
    expect(blocks.map((b) => b.type)).toEqual(["widget", "widget", "widget"]);
    expect(blocks.map((b) => (b as any).id)).toEqual(["trip-budget", "capacity-planner", "issue-triage"]);
  });

  it("keeps the element tree the fixture wrote", () => {
    const widget = readWidget(byId("trip-budget"), new Trail());
    expect(widget?.id).toBe("trip-budget");
    expect(widget?.view.map((node) => node.kind)).toEqual(["text", "text", "stack", "row", "block", "when", "button"]);
  });
});

describe("reading a widget", () => {
  it("refuses a version other than 1", () => {
    const { blocks, dropped } = readBlocksNoted([{ ...byId("trip-budget"), version: 2 }]);
    expect(blocks).toEqual([]);
    expect(dropped[0].why).toBe("widget version must be 1");
  });

  it("refuses data that would fetch, call a tool or include another board", () => {
    for (const smuggled of [{ fetch: "https://x.example" }, { tools: [] }, { include: "abc" }, { nested: { type: "include" } }]) {
      const raw = byId("trip-budget");
      raw.data = { ...raw.data, ...smuggled };
      const { blocks, dropped } = readBlocksNoted([raw]);
      expect(blocks).toEqual([]);
      expect(dropped[0].why).toContain("widget data can't carry");
    }
  });

  it("refuses a computed cycle", () => {
    const raw = byId("trip-budget");
    raw.computed = { a: { get: "computed.b" }, b: { op: "add", args: [{ get: "computed.a" }, 1] } };
    const { blocks, dropped } = readBlocksNoted([raw]);
    expect(blocks).toEqual([]);
    expect(dropped[0].why).toContain("cycle");
  });

  it("refuses state that cannot be drawn: a bad range, a step of zero, too many entries", () => {
    const cases: Raw[] = [
      { nights: { type: "number", label: "Nights", initial: 20, min: 1, max: 10, step: 1 } },
      { nights: { type: "number", label: "Nights", initial: 2, min: 1, max: 10, step: 0 } },
      { nights: { type: "string", label: "Nights", initial: "a", maxLength: 0 } },
      { nights: { type: "boolean", label: "Nights", initial: "yes" } },
      Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`s${i}`, { type: "boolean", label: `S${i}`, initial: false }])),
    ];
    for (const state of cases) {
      const raw = { ...byId("trip-budget"), state, computed: {}, view: [] };
      const { blocks } = readBlocksNoted([raw]);
      expect(blocks).toEqual([]);
    }
  });

  it("drops a binding the contract does not allow, and keeps the widget", () => {
    const raw = byId("trip-budget");
    raw.view = [{ kind: "block", id: "spend", spec: { type: "bar", label: "Spent", value: 0, max: 100 },
      bindings: { "/label": { get: "data.note" }, "/type": "bar" } }];
    const { blocks, dropped } = readBlocksNoted([raw]);
    expect(blocks).toHaveLength(1);
    expect(dropped.map((d) => d.why)).toEqual([
      'binding "/label" is not allowed on bar',
      'binding "/type" is not allowed on bar',
    ]);
  });

  it("drops a binding that points outside its embedded block", () => {
    const raw = byId("capacity-planner");
    raw.view = [{ kind: "block", id: "chart", spec: { type: "chart", x: ["A"], series: [{ name: "S", data: [1] }] },
      bindings: { "/series/0/data/4": { get: "computed.capacity" } } }];
    const { blocks, dropped } = readBlocksNoted([raw]);
    expect(blocks).toHaveLength(1);
    expect(dropped[0].why).toBe('binding "/series/0/data/4" points outside the chart');
  });

  it("refuses include, a nested widget and a page-only block", () => {
    for (const type of ["include", "widget", "briefing"]) {
      const raw = handMade([{ kind: "block", id: "b", spec: { type } }]);
      const { blocks, dropped } = readBlocksNoted([raw]);
      expect(blocks).toHaveLength(1);
      expect(dropped[0].why).toMatch(/widget can't embed|widget can embed/);
    }
  });

  it("refuses a nested repeat and a control that does not match its state, and allows a when without else", () => {
    const nested = handMade([{ kind: "repeat", id: "outer", items: { get: "data.list" }, key: "id",
      template: [{ kind: "repeat", id: "inner", items: { get: "data.list" }, key: "id", template: [] }] }],
    { data: { list: [{ id: "a" }] } });
    const noElse = handMade([{ kind: "when", id: "w", test: true, then: [] }]);
    const badControl = handMade([{ kind: "input", id: "i", control: "select", state: "nights", label: "Nights" }]);
    expect(readBlocksNoted([nested]).dropped[0].why).toContain("cannot nest");
    const noElseRead = readBlocksNoted([noElse]);
    expect(noElseRead.dropped).toHaveLength(0);
    expect(noElseRead.blocks).toHaveLength(1);
    expect(readBlocksNoted([badControl]).dropped[0].why).toContain("select");
  });

  it("refuses a set that targets something other than declared state", () => {
    for (const state of ["item.id", "data.total", "computed.total", "state.missing"]) {
      const raw = handMade([{ kind: "button", id: "b", label: "Pick", action: { op: "set", state, value: 1 } }]);
      const { dropped } = readBlocksNoted([raw]);
      expect(dropped[0].why).toBe("set needs a declared state name");
    }
  });

  it("refuses a fill that would be acted on as a command, or names an undeclared field", () => {
    const command = handMade([{ kind: "button", id: "b", label: "Go", action: { op: "fill", message: "/reset", fields: [] } }]);
    const unknown = handMade([{ kind: "button", id: "b", label: "Go", action: { op: "fill", message: "Go", fields: ["nope"] } }]);
    expect(readBlocksNoted([command]).dropped[0].why).toContain("can't start with");
    expect(readBlocksNoted([unknown]).dropped[0].why).toBe("fill fields must name declared state entries");
  });

  it("refuses a repeat whose items share a key", () => {
    const raw = handMade([{ kind: "repeat", id: "r", items: { get: "data.list" }, key: "id",
      template: [{ kind: "text", id: "t", expr: { get: "item.id" } }] }], { data: { list: [{ id: "a" }, { id: "a" }] } });
    const { dropped } = readBlocksNoted([raw]);
    expect(dropped[0].why).toContain('unique "id"');
  });

  it("keeps a node's id unique across the whole tree", () => {
    const raw = handMade([{ kind: "text", id: "same", text: "one" }, { kind: "text", id: "same", text: "two" }]);
    const { dropped } = readBlocksNoted([raw]);
    expect(dropped[0].why).toBe('element id "same" is used twice');
  });

  it("stops nesting at eight levels", () => {
    let node: Raw = { kind: "text", id: "deep", text: "deep" };
    for (let i = 0; i < 9; i++) node = { kind: "stack", id: `s${i}`, children: [node] };
    const { dropped } = readBlocksNoted([handMade([node])]);
    expect(dropped.some((d) => d.why.includes("nest 8 deep"))).toBe(true);
  });
});

describe("the trip budget", () => {
  it("starts at the fixture's values", () => {
    const { container } = drawWithActions([byId("trip-budget")]);
    expect(figure("Remaining")).toBe("400 USD");
    expect(figure("Planned spend")).toBe("800 USD");
    expect(container.querySelector(".hb-bar-amount")!.textContent).toBe("800 / 1,200");
    expect(screen.getByText("Within budget")).toBeTruthy();
    expect(screen.queryByText("Over budget")).toBeNull();
  });

  it("follows the slider through the computed values, the bar and a conditional warning", () => {
    const { container } = drawWithActions([byId("trip-budget")]);
    const slider = screen.getByRole("slider", { name: /Nights/ });
    fireEvent.change(slider, { target: { value: "7" } });
    expect(figure("Remaining")).toBe("-200 USD");
    expect(figure("Planned spend")).toBe("1,400 USD");
    expect(container.querySelector(".hb-bar-amount")!.textContent).toBe("1,400 / 1,200");
    expect(screen.getByText("Over budget")).toBeTruthy();
    expect(screen.queryByText("Within budget")).toBeNull();
  });

  it("fills the composer with only the listed state, and never sends", () => {
    const { fill, send } = drawWithActions([byId("trip-budget")]);
    fireEvent.change(screen.getByRole("slider", { name: /Nights/ }), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Hermes to revise" }));
    expect(fill).toHaveBeenCalledWith("Please revise this trip budget.\n\nNights: 7");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("the capacity planner", () => {
  const seats = () => {
    const table = document.querySelector(".hb-table") as HTMLElement;
    const row = Array.from(table.querySelectorAll("tbody tr")).find((tr) => tr.textContent?.includes("Day 3")) as HTMLElement;
    return row.querySelectorAll("td")[1].textContent;
  };

  it("feeds a bound table cell and a bound chart point from the controls", () => {
    drawWithActions([byId("capacity-planner")]);
    expect(figure("Daily capacity")).toBe("4");
    expect(seats()).toBe("4");
    fireEvent.change(screen.getByRole("spinbutton", { name: /Guests/ }), { target: { value: "5" } });
    expect(figure("Daily capacity")).toBe("10");
    expect(seats()).toBe("10");
    fireEvent.change(screen.getByRole("combobox", { name: /Room/ }), { target: { value: "suite" } });
    expect(figure("Daily capacity")).toBe("20");
    expect(seats()).toBe("20");
  });
});

describe("the issue triage", () => {
  it("shows one item's details at a time, from a set that reads the repeat item", () => {
    drawWithActions([byId("issue-triage")]);
    expect(screen.getByText("Add a short empty view.")).toBeTruthy();
    expect(screen.queryByText("Keep the focus ring on the range input.")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Select" })[1]);
    expect(screen.getByText("Keep the focus ring on the range input.")).toBeTruthy();
    expect(screen.queryByText("Add a short empty view.")).toBeNull();
  });

  it("draws the empty view of a repeat with no items", () => {
    drawWithActions([byId("issue-triage")]);
    expect(screen.getByText("No archived issues.")).toBeTruthy();
    expect(screen.queryByText("No issues in this list.")).toBeNull();
  });

  it("fills with the selected item", () => {
    const { fill } = drawWithActions([byId("issue-triage")]);
    fireEvent.click(screen.getAllByRole("button", { name: "Select" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Prepare follow-up" }));
    expect(fill).toHaveBeenCalledWith("Please triage this issue.\n\nSelected: GEN-2");
  });
});

describe("a hand-made widget", () => {
  it("resets to the declared starting values", () => {
    drawWithActions([handMade([
      { kind: "number", id: "n", label: "Nights", expr: { get: "state.nights" } },
      { kind: "button", id: "nine", label: "Nine", action: { op: "set", state: "state.nights", value: 9 } },
      { kind: "button", id: "reset", label: "Reset", action: { op: "reset" } },
    ])]);
    expect(figure("Nights")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Nine" }));
    expect(figure("Nights")).toBe("9");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(figure("Nights")).toBe("2");
  });

  it("keeps a typed set inside the declaration's bounds", () => {
    drawWithActions([handMade([
      { kind: "number", id: "n", label: "Nights", expr: { get: "state.nights" } },
      { kind: "button", id: "far", label: "Far", action: { op: "set", state: "state.nights", value: 99 } },
    ])]);
    fireEvent.click(screen.getByRole("button", { name: "Far" }));
    expect(figure("Nights")).toBe("10");
  });

  it("draws a stat and a source it was given, and nothing that was not allowed", () => {
    drawWithActions([handMade([
      { kind: "block", id: "total", spec: { type: "stat", label: "Total", value: 0 }, bindings: { "/value": { get: "data.total" } } },
      { kind: "block", id: "where", spec: { type: "source", text: "Fixture data", url: "https://x.example/data" } },
    ])]);
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Fixture data")).toBeTruthy();
  });

  it("shows a division by zero as an unavailable figure with its reason", () => {
    drawWithActions([handMade([{ kind: "number", id: "ratio", label: "Ratio", expr: { op: "div", args: [1, 0] } }])]);
    expect(figure("Ratio")).toBe("unavailable");
    expect(screen.getByText("divided by zero")).toBeTruthy();
  });

  it("draws neither branch of a when whose test is unknown", () => {
    drawWithActions([handMade([{ kind: "when", id: "w", test: { op: "eq", args: [{ get: "state.nights" }, null] },
      then: [{ kind: "text", id: "t", text: "then branch" }], else: [{ kind: "text", id: "e", text: "else branch" }] }])]);
    expect(screen.queryByText("then branch")).toBeNull();
    expect(screen.queryByText("else branch")).toBeNull();
  });
});

describe("applyBindings", () => {
  it("writes a chart point and a table cell, and leaves structure alone", () => {
    const chart = { type: "chart", x: ["a", "b", "c"], series: [{ name: "S", data: [1, 2, 3] }] };
    const scope = { state: { guests: 5 } };
    const boundChart = applyBindings(chart, { "/series/0/data/2": { op: "mul", args: [{ get: "state.guests" }, 2] } as Expr }, scope);
    expect((boundChart.spec.series as any)[0].data).toEqual([1, 2, 10]);
    expect(boundChart.errors).toEqual([]);

    const table = { type: "table", columns: ["Day", "Seats"], rows: [["Day 1", "4"], ["Day 2", "6"]] };
    const boundTable = applyBindings(table, { "/rows/1/1": { get: "state.guests" } as Expr }, scope);
    expect((boundTable.spec.rows as any)[1][1]).toBe(5);
    expect(boundTable.errors).toEqual([]);
  });

  it("reports a binding that could not be evaluated and keeps the written value", () => {
    const bar = { type: "bar", label: "Spent", value: 3, max: 100 };
    const bound = applyBindings(bar, { "/value": { op: "div", args: [1, 0] } as Expr }, {});
    expect(bound.spec.value).toBe(3);
    expect(bound.errors).toEqual(["/value: divided by zero"]);
  });

  it("does not mutate the spec it was handed", () => {
    const bar = { type: "bar", label: "Spent", value: 3, max: 100 };
    applyBindings(bar, { "/max": 10 as Expr }, {});
    expect(bar).toEqual({ type: "bar", label: "Spent", value: 3, max: 100 });
  });
});
