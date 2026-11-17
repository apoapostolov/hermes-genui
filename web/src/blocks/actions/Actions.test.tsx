// What a tap sends or fills.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetBoards } from "../checklist/savedState";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";
import { drawWithActions as draw } from "../../core/testing";

afterEach(cleanup);
beforeEach(() => forgetBoards());

describe("actions and button", () => {
  it("send their message on a tap", () => {
    const { send } = draw([{ type: "actions", items: [{ label: "Analyze", run: "Analyze TCS" }] },
      { type: "button", label: "Plan day 2", run: "Plan day 2 of my trip" }]);
    fireEvent.click(screen.getByRole("button", { name: /Analyze/ }));
    fireEvent.click(screen.getByRole("button", { name: /Plan day 2/ }));
    expect(send.mock.calls).toEqual([["Analyze TCS"], ["Plan day 2 of my trip"]]);
  });

  it("a button with a url is a link that opens in a new tab", () => {
    draw([{ type: "button", label: "Book", url: "https://www.irctc.co.in" }]);
    const a = screen.getByRole("link", { name: /Book/ });
    expect(a.getAttribute("href")).toBe("https://www.irctc.co.in");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noreferrer");
  });

  it("are safe to tap with no app around them (the default actions do nothing)", () => {
    render(<Blocks blocks={readBlocks([{ type: "actions", items: [{ label: "Go", run: "go" }] }])} />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: /Go/ }))).not.toThrow();
  });
});

describe("what a tap will send is shown on hover", () => {
  it("every button, tile and row with a run has the exact text as its title", () => {
    const { container } = draw([{ type: "actions", items: [{ label: "Analyze", run: "Analyze TCS" }] },
      { type: "button", label: "Plan", run: "Plan day 2" },
      { type: "tiles", items: [{ title: "Gion", run: "Add a Gion walk" }, { title: "Nara", ask: "Plan Nara" }] },
      { type: "list", items: [{ title: "MTR", run: "Tell me about MTR" }, { title: "CTR" }] }]);
    expect(screen.getByRole("button", { name: /Analyze/ }).getAttribute("title")).toBe("Analyze TCS");
    expect(screen.getByRole("button", { name: /Plan/ }).getAttribute("title")).toBe("Plan day 2");
    expect(screen.getByRole("button", { name: /Gion/ }).getAttribute("title")).toBe("Add a Gion walk");
    expect(screen.getByRole("button", { name: /MTR/ }).getAttribute("title")).toBe("Tell me about MTR");
    expect(container.querySelectorAll("[title]")).toHaveLength(4);
  });
});

describe("what a row of buttons is called", () => {
  it("takes the model's group name, and says what it is without one", () => {
    const row = (raw: object) => draw([{ type: "actions", ...raw, items: [{ label: "Weather", run: "Goa weather" }] }]);
    row({ name: "Next" });
    expect(screen.getByRole("group", { name: "Next" })).toBeTruthy();
    cleanup();
    row({});
    expect(screen.getByRole("group", { name: "Actions" })).toBeTruthy();
  });
});
