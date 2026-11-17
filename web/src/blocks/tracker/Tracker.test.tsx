import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawWithActions as draw } from "../../core/testing";
import { readBlocks } from "../../core/readBlocks";

afterEach(cleanup);
beforeEach(() => { try { localStorage.clear(); } catch { /* none */ } });

const CARD = { id: "cl", title: "Seattle City Light", amount: "$142.36", state: "overdue", stateText: "Overdue · 1 day",
  help: "Help me pay City Light", link: { label: "Pay on citylight.example", url: "https://citylight.example/pay" },
  details: { from: "City Light <billing@citylight.example>", received: "Wed 11 Nov, 8:15 AM",
    about: ["Amount $142.36", "Due Sun 15 Nov"], trail: ["Noticed Wed 11 Nov", "Overdue since Mon 16 Nov"] } };
const SOON = { id: "xf", title: "Xfinity", state: "soon", stateText: "In 3 days", help: "Help me pay Xfinity" };
const ROW = { id: "xp", title: "Xfinity", amount: "$89.98", kind: "closed", verb: "Paid",
  why: "confirmation mail 16 Nov", reopen: true };
const TRACK = { id: "o", title: "Following your Amazon order", kind: "tracking", verb: "Tracking", why: "Shipped" };
const BLOCK = { type: "tracker", need: [CARD, SOON], handled: [ROW, TRACK] };

describe("tracker", () => {
  it("switches between Needs you and Handled, with count badges", () => {
    draw([BLOCK]);
    const need = screen.getByRole("tab", { name: /Needs you/ });
    const done = screen.getByRole("tab", { name: /Handled/ });
    expect(need.getAttribute("aria-selected")).toBe("true");
    expect(need.querySelector(".hb-tr-badge")?.textContent).toBe("2");
    expect(need.querySelector(".hb-tr-badge-red")).toBeTruthy();
    expect(done.querySelector(".hb-tr-badge")?.textContent).toBe("✓ 2");
    expect(document.querySelectorAll(".hb-tr-card")).toHaveLength(2);
    fireEvent.click(done);
    expect(document.querySelectorAll(".hb-tr-row")).toHaveLength(2);
    expect(document.querySelector(".hb-tr-row .hb-tr-verb")?.textContent).toBe("✓ Paid");
  });

  it("a card: state pill, the pay link, a help button that fills, and Details", () => {
    const { fill } = draw([BLOCK]);
    const card = document.querySelector(".hb-tr-card")!;
    expect(card.classList.contains("hb-tr-overdue")).toBe(true);
    expect(card.querySelector(".hb-tr-pill")?.textContent).toBe("Overdue · 1 day");
    const link = card.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://citylight.example/pay");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toContain("Pay on citylight.example");
    fireEvent.click(screen.getByRole("button", { name: "Help me pay City Light" }));
    expect(fill).toHaveBeenCalledWith("Help me pay City Light");
    const details = card.querySelector("details")!;
    expect(details.querySelector("summary")?.textContent).toBe("Details");
    expect(details.textContent).toContain("billing@citylight.example");
    expect(details.textContent).toContain("Amount $142.36 · Due Sun 15 Nov");
    expect(details.textContent).toContain("Noticed Wed 11 Nov → Overdue since Mon 16 Nov");
  });

  it("Reopen asks the plugin and hides the row", async () => {
    const rest = vi.fn(async () => ({}));
    draw([BLOCK], { rest });
    fireEvent.click(screen.getByRole("tab", { name: /Handled/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(rest).toHaveBeenCalledWith("/assistant/items/xp", { method: "POST", body: { status: "suggested" } });
    await Promise.resolve();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
  });

  it("remembers the chosen view", () => {
    draw([BLOCK]);
    fireEvent.click(screen.getByRole("tab", { name: /Handled/ }));
    cleanup();
    draw([BLOCK]);
    expect(screen.getByRole("tab", { name: /Handled/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("the reader drops bad cards and non-https links", () => {
    const [b] = readBlocks([{ type: "tracker", need: [{ ...CARD, link: { label: "Pay", url: "http://x.example" } },
      { title: "no id" }, { ...SOON, state: "panic" }], handled: [{ ...ROW, kind: "magic" }] }]) as any[];
    expect(b.need.map((c: any) => c.id)).toEqual(["cl", "xf"]);
    expect(b.need[0].link).toBeUndefined();
    expect(b.need[1].state).toBe("open");
    expect(b.handled).toEqual([]);
  });

  it("shows an empty Needs you kindly", () => {
    draw([{ type: "tracker", need: [], handled: [TRACK] }]);
    expect(document.querySelector(".hb-tr-empty")?.textContent).toContain("Nothing needs you");
  });
});
