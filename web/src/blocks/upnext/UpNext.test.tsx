import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { drawWithActions as draw } from "../../core/testing";
import { kindOf } from "./read";

afterEach(cleanup);

const ROW = { type: "upnext", items: [
  { date: "2026-11-17", title: "Emma's birthday", kind: "birthday", time: "08:00", source: "mail" },
  { date: "2026-11-18", title: "Xfinity bill", kind: "bill", amount: "$89.98", ask: "Pay the Xfinity bill of $89.98" }] };

describe("upnext", () => {
  it("draws a card per item: weekday, big day, illustration, title, time or amount", () => {
    draw([ROW]);
    const cards = [...document.querySelectorAll(".hb-up-card")];
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector(".hb-up-day")?.textContent).toBe("17");
    expect(cards[0].querySelector(".hb-up-weekday")?.textContent).toContain("Tue");
    expect(cards[0].querySelector("svg")).toBeTruthy();
    expect(cards[0].querySelector(".hb-up-source")).toBeTruthy();
    expect(cards[1].querySelector(".hb-up-meta")?.textContent).toBe("$89.98");
  });

  it("a tap puts its question (or 'Tell me about …') in the message box", () => {
    const { fill } = draw([ROW]);
    fireEvent.click(screen.getByRole("button", { name: /Xfinity bill/ }));
    fireEvent.click(screen.getByRole("button", { name: /Emma's birthday/ }));
    expect(fill).toHaveBeenNthCalledWith(1, "Pay the Xfinity bill of $89.98");
    expect(fill).toHaveBeenNthCalledWith(2, "Tell me about Emma's birthday");
  });

  it("maps everyday kind words onto the illustrations", () => {
    expect(kindOf("flight")).toBe("travel");
    expect(kindOf("dentist")).toBe("medical");
    expect(kindOf("order")).toBe("delivery");
    expect(kindOf("whatever")).toBe("general");
  });

  it("draws a state pill and keeps unknown states out", () => {
    draw([{ type: "upnext", items: [
      { date: "2026-11-15", title: "City Light", kind: "bill", state: "overdue", stateText: "Overdue · 1 day" },
      { date: "2026-11-19", title: "Xfinity", kind: "bill", state: "panic", stateText: "Nope" }] }]);
    const pills = [...document.querySelectorAll(".hb-up-state")];
    expect(pills).toHaveLength(1);
    expect(pills[0].textContent).toBe("Overdue · 1 day");
    expect(pills[0].classList.contains("hb-up-state-overdue")).toBe(true);
  });

  it("compact rows wrap instead of scrolling", () => {
    draw([{ ...ROW, compact: true }]);
    const row = document.querySelector(".hb-up-row");
    expect(row?.classList.contains("hb-up-compact")).toBe(true);
  });
});

