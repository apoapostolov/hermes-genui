import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { drawWithActions as draw } from "../../core/testing";
import { nextEvent, relativeDay } from "./Calendar";

afterEach(cleanup);

const DAY = { type: "calendar", date: "2026-11-14", ask: "What's on today?", events: [
  { title: "Farmers market", start: "09:00", end: "10:00", place: "Ballard Ave NW" },
  { title: "Dinner with Emma", start: "19:30", place: "Canlis" }],
  week: [{ date: "2026-11-14", count: 2 }, { date: "2026-11-15", count: 0 }, { date: "2026-11-16", count: 3 }] };

describe("calendar", () => {
  it("draws the big date, the day's events and the week strip", () => {
    draw([DAY]);
    expect(document.querySelector(".hb-cal-day")?.textContent).toBe("14");
    expect(document.querySelector(".hb-cal-month")?.textContent).toBe("November 2026");
    expect(document.querySelector(".hb-cal-weekday")?.textContent).toBe("Saturday");
    expect([...document.querySelectorAll(".hb-cal-event-title")].map((e) => e.textContent))
      .toEqual(["Farmers market", "Dinner with Emma"]);
    const days = [...document.querySelectorAll(".hb-cal-week li")];
    expect(days).toHaveLength(3);
    expect(days[0].classList.contains("is-selected")).toBe(true);
    expect(days.map((d) => d.classList.contains("has-events"))).toEqual([true, false, true]);
  });

  it("Ask about it puts the question in the message box", () => {
    const { fill } = draw([DAY]);
    fireEvent.click(screen.getByRole("button", { name: /Ask about it/ }));
    expect(fill).toHaveBeenCalledWith("What's on today?");
  });

  it("reads loose input: items for events, a day for the date, an ISO start", () => {
    draw([{ type: "calendar", day: "2026-11-14", items: [{ name: "Run", start: "2026-11-14T07:30:00" }] }]);
    expect(document.querySelector(".hb-cal-event-title")?.textContent).toBe("Run");
    expect(document.querySelector(".hb-cal-event-time")?.textContent).toBe("07:30");
  });

  it("says nothing is planned on an empty day", () => {
    draw([{ type: "calendar", date: "2026-11-14" }]);
    expect(screen.getByText("Nothing planned")).toBeTruthy();
  });

  it("picks the next event and says when it is", () => {
    const at = new Date(2026, 10, 14, 12, 0);
    expect(nextEvent(DAY.events, "2026-11-14", at)?.title).toBe("Dinner with Emma");
    expect(relativeDay("2026-11-14", at)).toBe("Today");
    expect(relativeDay("2026-11-15", at)).toBe("Tomorrow");
    expect(relativeDay("2026-11-18", at)).toBe("Wednesday");
  });
});
