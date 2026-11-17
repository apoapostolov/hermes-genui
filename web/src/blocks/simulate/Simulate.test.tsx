import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";
import { SimChart } from "./SimChart";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SIM = {
  type: "simulate", title: "₹1,00,000 left alone for 30 years",
  t: { name: "years", to: 30, step: 1, unit: "years", speed: 1.25 },
  inputs: [{ name: "rate", label: "Interest per year", min: 6, max: 14, step: 0.5, value: 10, unit: "%" }],
  values: { P: 100000 },
  view: { kind: "dots", per: 10000, start: "₹1,00,000 you put in", piles: [
    { name: "Simple interest", formula: "P * (1 + rate / 100 * years)", adds: "interest" },
    { name: "Compound interest", formula: "P * (1 + rate / 100) ^ years", adds: "interest on interest" },
  ] },
  unit: "₹",
};

const draw = (sim: unknown = SIM) => render(<Blocks blocks={readBlocks([sim])} />);
const amounts = (c: HTMLElement) => [...c.querySelectorAll(".hb-sim-amount")].map((n) => n.textContent);
const time = () => screen.getByRole("slider", { name: "years" });
const playButton = () => screen.getByRole("button", { name: /Play|Pause/ });

describe("Simulate", () => {
  it("opens finished: the whole run, each pile's amount and its dots", () => {
    const { container } = draw();
    expect(screen.getByText("30 of 30")).toBeTruthy();
    expect(amounts(container)).toEqual(["₹4,00,000", "₹17,44,940"]);
    expect(screen.getByRole("img", { name: "Compound interest: ₹17,44,940, 174 dots" })).toBeTruthy();
    expect(container.querySelector(".hb-legend")!.textContent).toContain("₹1,00,000 you put in (a dot is ₹10,000)");
    expect(container.querySelector(".hb-legend")!.textContent).toContain("interest on interest");
  });

  it("shows any moment from the scrubber, and new amounts as a slider moves", () => {
    const { container } = draw();
    fireEvent.change(time(), { target: { value: "10" } });
    expect(screen.getByText("10 of 30")).toBeTruthy();
    expect(amounts(container)).toEqual(["₹2,00,000", "₹2,59,374"]);
    fireEvent.change(screen.getByRole("slider", { name: /Interest per year/ }), { target: { value: "6" } });
    expect(amounts(container)).toEqual(["₹1,60,000", "₹1,79,085"]);
  });

  it("switches to a line chart with each value now, and back", () => {
    const { container } = draw();
    fireEvent.click(screen.getByRole("button", { name: "Line chart" }));
    expect(screen.getByRole("button", { name: "Line chart" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("img", { name: "Line chart at 30: Simple interest ₹4,00,000, Compound interest ₹17,44,940" })).toBeTruthy();
    expect(container.querySelectorAll(".hb-sim-line").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Dots" }));
    expect(container.querySelector(".hb-sim-piles")).not.toBeNull();
  });

  it("plays from the start, pauses on a second press, and pauses when scrolled out of view", () => {
    let seen: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal("IntersectionObserver", class { constructor(fn: any) { seen = fn; } observe() {} disconnect() {} });
    draw();
    fireEvent.click(playButton());
    expect(playButton().textContent).toBe("Pause");
    expect(screen.getByText("0 of 30")).toBeTruthy();
    act(() => seen!([{ isIntersecting: false }]));
    expect(playButton().textContent).toBe("Play");
    fireEvent.click(playButton());
    fireEvent.click(playButton());
    expect(playButton().textContent).toBe("Play");
  });

  it("makes each dot stand for more when the piles would pass 600 dots", () => {
    const { container } = draw({ ...SIM, view: { ...SIM.view, per: 1000 } });
    expect(container.querySelector(".hb-legend")!.textContent).toContain("(a dot is ₹10,000)");
  });
});

describe("SimChart with a sample a formula can't work out", () => {
  it("breaks the line where the value is unknown instead of bridging the gap", () => {
    const { container } = render(<SimChart piles={[{ name: "Simple", formula: "P" }]} lines={[[100, null, 120]]} times={[0, 1, 2]} index={2} />);
    const lines = [...container.querySelectorAll("polyline.hb-sim-line")];
    expect(lines.length).toBe(2);  // 0 … and … 2, with nothing drawn across the null
    expect(lines.every((line) => line.getAttribute("points")!.split(" ").length === 1)).toBe(true);
    expect(container.querySelector("circle.hb-sim-point")).toBeTruthy();
  });
});
