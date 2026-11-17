import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { drawWithActions as draw } from "../../core/testing";

afterEach(cleanup);

describe("weather", () => {
  it("draws the temperature, the sky and place, and the high and tonight's low", () => {
    draw([{ type: "weather", temp: 17.4, place: "Pimpri Chinchwad", condition: "Cloudy", high: 30, low: 16 }]);
    const strip = document.querySelector(".hb-weather");
    expect(strip?.querySelector(".hb-weather-temp")?.textContent).toBe("17°");
    expect(strip?.textContent).toContain("Cloudy in Pimpri Chinchwad");
    expect(strip?.textContent).toContain("High 30° · 16° tonight");
  });

  it("without a sky shows just the place", () => {
    draw([{ type: "weather", temp: 9, place: "Seattle" }]);
    expect(document.querySelector(".hb-weather-where")?.textContent).toBe("Seattle");
  });

  it("drops a strip without a numeric temperature", () => {
    draw([{ type: "weather", temp: "warm", place: "Pune" }]);
    expect(document.querySelector(".hb-weather")).toBeNull();
  });
});
