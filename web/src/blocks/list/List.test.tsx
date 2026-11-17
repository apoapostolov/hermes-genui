import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drawWithActions, withStyles } from "../../core/testing";
import { forgetBoards } from "../checklist/savedState";
import { readBlocks } from "../../core/readBlocks";
import { Blocks } from "../../core/Blocks";
import listCss from "./list.css?raw";

afterEach(cleanup);
beforeEach(() => forgetBoards());

const draw = (block: unknown) => render(<Blocks blocks={readBlocks([block])} />).container;

describe("List", () => {
  it("draws a letter circle for a row without an icon, and the icon for a row with one", () => {
    const c = draw({ type: "list", title: "Needs you", items: [
      { title: "Asha · Lease renewal", subtitle: "Sign by Friday", value: "11:30am", icon: "alert" },
      { title: "Ravi · Dinner on Sat", subtitle: "Asks if 8pm works", value: "Yesterday" },
    ] });
    expect(screen.getByText("Needs you")).toBeTruthy();
    const rows = c.querySelectorAll(".hb-list-row");
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector(".hb-list-icon svg")).toBeTruthy();
    expect(rows[0].querySelector(".hb-list-initial")).toBeNull();
    const letter = rows[1].querySelector(".hb-list-initial") as HTMLElement;
    expect(letter.textContent).toBe("R");
    expect(letter.style.background).toMatch(/var\(--hb-chart-\d\)/);
    expect(screen.getByText("Yesterday")).toBeTruthy();
  });

  it("numbers a ranked list, with no letter circles", () => {
    const c = draw({ type: "list", ranked: true, items: ["Third Wave", "Dyu"] });
    expect([...c.querySelectorAll(".hb-list-rank")].map((r) => r.textContent)).toEqual(["1", "2"]);
    expect(c.querySelector(".hb-list-initial")).toBeNull();
  });

  it("draws a fixed-width bar beside numeric rows and keeps other rows unchanged", () => {
    const c = draw({ type: "list", title: "Budget used", max: 100, items: [
      { title: "Rent", bar: 62, value: "62 of 100" },
      { title: "Travel", bar: 128, value: "128 of 100" },
      { title: "Zero", bar: 0 },
      { title: "Unknown", bar: null, value: "no data" }] });
    const rows = c.querySelectorAll(".hb-list-row");
    expect(rows.length).toBe(4);
    const fills = [...c.querySelectorAll(".hb-list-bar-fill")] as HTMLElement[];
    expect(fills.map((f) => f.style.width)).toEqual(["62%", "100%", "0%"]);
    expect(c.querySelectorAll(".hb-list-bar").length).toBe(3);
    expect(rows[3].querySelector(".hb-list-bar")).toBeNull();
    expect(rows[3].querySelector(".hb-list-value")!.textContent).toBe("no data");
    expect(rows[0].querySelector(".hb-list-bar")!.getAttribute("aria-hidden")).toBe("true");
    // One shared value column, so every track starts at the same x whatever the value's width.
    expect(c.querySelector(".hb-list")!.classList.contains("hb-list-bars")).toBe(true);
    expect([...rows].every((row) => row.querySelector(".hb-list-tail"))).toBe(true);
  });

  it("draws an empty track when every bar is 0 and no max was written", () => {
    const c = draw({ type: "list", items: [{ title: "Rent", bar: 0, value: "0" }, { title: "Travel", bar: 0 }] });
    const bars = [...c.querySelectorAll(".hb-list-bar")] as HTMLElement[];
    expect(bars.length).toBe(2);
    expect([...c.querySelectorAll(".hb-list-bar-fill")].map((f) => (f as HTMLElement).style.width)).toEqual(["0%", "0%"]);
  });

  it("keeps a list without bars exactly as it was", () => {
    const c = draw({ type: "list", items: [{ title: "Rent", value: "₹62,000" }, { title: "Travel", value: "₹9,800" }] });
    expect(c.querySelector(".hb-list")!.classList.contains("hb-list-bars")).toBe(false);
    expect(c.querySelector(".hb-list-bar")).toBeNull();
    expect([...c.querySelectorAll(".hb-list-value")].map((v) => v.textContent)).toEqual(["₹62,000", "₹9,800"]);
  });

  it("gives the value a fixed width in a list with bars, and its natural width without", () => {
    const unstyle = withStyles(listCss);
    try {
      const withBars = draw({ type: "list", max: 100, items: [
        { title: "One", bar: 62, value: "₹62,000" }, { title: "Two", bar: 90, value: "₹1,20,000" }] });
      const fixed = getComputedStyle(withBars.querySelector(".hb-list-value") as HTMLElement);
      expect(fixed.width).toMatch(/6\.5rem|104px/);
      expect(fixed.textAlign).toBe("right");
      expect(getComputedStyle(withBars.querySelector(".hb-list-tail") as HTMLElement).display).toBe("flex");
      const plain = draw({ type: "list", items: [{ title: "One", value: "₹62,000" }] });
      // jsdom leaves an undeclared width alone: "auto", or "" for a property it does not compute.
      expect(getComputedStyle(plain.querySelector(".hb-list-value") as HTMLElement).width).not.toMatch(/6\.5rem|104px/);
    } finally {
      unstyle();
    }
  });

  it("opens a row's url as a plain link, and shows a letter when its photo fails to load", () => {
    const c = draw({ type: "list", items: [{ title: "Dyu Art Café", image: "https://x.example/dyu.jpg", url: "https://dyu.example" }] });
    const link = c.querySelector("a.hb-list-row") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://dyu.example");
    expect(link.getAttribute("rel")).toBe("noreferrer");
    const img = c.querySelector(".hb-list-row img") as HTMLImageElement;
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    fireEvent.error(img);
    expect(c.querySelector(".hb-list-row img")).toBeNull();
    expect(c.querySelector(".hb-list-initial")!.textContent).toBe("D");
  });

  it("draws **bold** in a title", () => {
    const c = draw({ type: "list", items: [{ text: "**MTR**, the gold standard" }] });
    expect(c.querySelector(".hb-list-title strong")!.textContent).toBe("MTR");
  });
});

describe("list rows", () => {
  it("show a dash where a row's value is unknown", () => {
    const c = draw({ type: "list", items: [{ title: "Shop A", subtitle: "Closed", value: null }, { title: "Shop B", value: 0 }] });
    const rows = c.querySelectorAll(".hb-list-row");
    expect(rows[0].textContent).toContain("–");
    expect(rows[1].textContent).toContain("0");
  });
  it("send their run on a tap; a url row stays a link", () => {
    const { send, container } = drawWithActions([{ type: "list", items: [
      { title: "Third Wave", run: "Directions to Third Wave" }, { title: "Dyu", url: "https://dyu.example" }] }]);
    fireEvent.click(screen.getByRole("button", { name: /Third Wave/ }));
    expect(send).toHaveBeenCalledWith("Directions to Third Wave");
    expect(container.querySelector("a.hb-list-row")!.getAttribute("href")).toBe("https://dyu.example");
  });
});
