import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drawWithActions } from "../../core/testing";
import { forgetBoards } from "../checklist/savedState";
import { readBlocks } from "../../core/readBlocks";
import { Blocks } from "../../core/Blocks";

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
  it("send their run on a tap; a url row stays a link", () => {
    const { send, container } = drawWithActions([{ type: "list", items: [
      { title: "Third Wave", run: "Directions to Third Wave" }, { title: "Dyu", url: "https://dyu.example" }] }]);
    fireEvent.click(screen.getByRole("button", { name: /Third Wave/ }));
    expect(send).toHaveBeenCalledWith("Directions to Third Wave");
    expect(container.querySelector("a.hb-list-row")!.getAttribute("href")).toBe("https://dyu.example");
  });
});
