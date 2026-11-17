/// <reference types="vite/client" />
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { drawWithActions as draw } from "../../core/testing";
import { readBlocks } from "../../core/readBlocks";
import css from "./briefing.css?raw";

afterEach(cleanup);

const BRIEF = { type: "briefing", greeting: "Good morning, Sam.", date: "Monday 16 November", place: "Seattle",
  temp: 9.4, condition: "Light rain", high: 11, low: 6, sky: "rain", counts: { overdue: 1, need: 9, handled: 4 } };

describe("briefing", () => {
  it("draws the greeting, the weather and one sentence about the day", () => {
    draw([BRIEF]);
    const band = document.querySelector(".hb-brief")!;
    expect(band.classList.contains("hb-brief-rain")).toBe(true);
    expect(band.querySelector("h2")?.textContent).toBe("Good morning, Sam.");
    expect(band.querySelector(".hb-brief-temp")?.textContent).toBe("9°");
    expect(band.querySelector(".hb-brief-line")?.textContent).toBe("1 overdue, 9 need you, and ✓ 4 handled.");
    expect(band.querySelector(".hb-brief-bad")?.textContent).toBe("1 overdue");
  });

  it("says nothing needs you, and works without weather", () => {
    draw([{ type: "briefing", greeting: "Hi.", sky: "clear", counts: { overdue: 0, need: 0, handled: 2 } }]);
    expect(document.querySelector(".hb-brief-line")?.textContent).toBe("Nothing needs you today, and ✓ 2 handled.");
    expect(document.querySelector(".hb-brief-temp")).toBeNull();
  });

  it("drops a briefing with no greeting and an unknown sky becomes clear", () => {
    expect(readBlocks([{ type: "briefing", sky: "rain" }])).toEqual([]);
    const [b] = readBlocks([{ ...BRIEF, sky: "lava" }]) as any[];
    expect(b.sky).toBe("clear");
  });

  it("every sky keeps white text readable (4.5:1 on each gradient stop)", () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const skies = [...css.matchAll(/\.hb-brief-(\w+) \{ background: linear-gradient\(([^)]*)\)/g)];
    expect(skies.length).toBeGreaterThanOrEqual(7);
    for (const [, sky, stops] of skies) {
      for (const hex of stops.match(/#[0-9a-f]{6}/gi) ?? []) {
        expect([sky, hex, 1.05 / (lum(hex) + 0.05) >= 4.5]).toEqual([sky, hex, true]);
      }
    }
  });
});

