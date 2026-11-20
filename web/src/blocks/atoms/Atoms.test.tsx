import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { readBlocks } from "../../core/readBlocks";
import { barAmount } from "./Atoms";
import { Blocks } from "../../core/Blocks";

afterEach(cleanup);

const draw = (blocks: unknown[]) => render(<Blocks blocks={readBlocks(blocks)} />).container;

describe("badge, link, image and bar", () => {
  it("draws a badge in its tone, and a plain one without", () => {
    const c = draw([{ type: "badge", text: "Open now", tone: "good" }, { type: "badge", text: "Plain" }]);
    expect(screen.getByText("Open now").className).toContain("hb-chip-good");
    expect(screen.getByText("Plain").className).toContain("hb-chip-plain");
    expect(c.querySelectorAll(".hb-badge").length).toBe(2);
  });

  it("draws a link that opens in a new tab", () => {
    draw([{ type: "link", text: "Book on IRCTC", url: "https://www.irctc.co.in" }]);
    const a = screen.getByRole("link", { name: /Book on IRCTC/ });
    expect(a.getAttribute("href")).toBe("https://www.irctc.co.in");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noreferrer");
  });

  it("draws an image with its caption, and nothing once it fails to load", () => {
    const c = draw([{ type: "image", url: "https://x.example/a.jpg", caption: "Ooty lake" }]);
    const img = c.querySelector(".hb-image img") as HTMLImageElement;
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(screen.getByText("Ooty lake")).toBeTruthy();
    fireEvent.error(img);
    expect(c.querySelector(".hb-image")).toBeNull();
  });

  it("writes a bar's amount: a share, a count with its unit, or money", () => {
    expect(barAmount(62, 100)).toBe("62%");
    expect(barAmount(6, 9, "items")).toBe("6 / 9 items");
    expect(barAmount(7200, 8000, "₹")).toBe("₹7,200 / ₹8,000");
    expect(barAmount(3, 4)).toBe("3 / 4");
    expect(barAmount(null, 500, "₹")).toBe("no data");  // a value nobody measured, not a 0
  });

  it("draws a bar filled to its share, never past full", () => {
    const c = draw([{ type: "bar", label: "Packed", value: 6, max: 9, unit: "items" }, { type: "bar", label: "Over", value: 12, max: 10 }]);
    const fills = [...c.querySelectorAll(".hb-bar-fill")] as HTMLElement[];
    expect(fills[0].style.width).toMatch(/^66\.6+\d*%$/);
    expect(fills[1].style.width).toBe("100%");
    expect(screen.getByText("6 / 9 items")).toBeTruthy();
  });

  it("leaves the track empty and says no data when the value is unknown", () => {
    const c = draw([{ type: "bar", label: "Spent", value: null, max: 500, unit: "₹" }]);
    const fill = c.querySelector(".hb-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("0%");
    expect(screen.getByText("no data")).toBeTruthy();
  });
});

describe("bar amounts in the user's locale", () => {
  afterEach(() => vi.restoreAllMocks());
  it("groups the local way", () => {
    pinLocale("de-DE");
    expect(barAmount(1234.5, 2000, "steps")).toBe("1.234,5 / 2.000 steps");
    pinLocale("en-IN");
    expect(barAmount(4000000, 5000000)).toBe("40,00,000 / 50,00,000");
  });
});
