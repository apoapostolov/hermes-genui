// weather: the weather now at a place, as one wide strip after Odie's Today.
import { clean, firstText, num, type Trail } from "../../core/fields";

export type WeatherBlock = { type: "weather"; temp: number; place: string; condition?: string; high?: number;
  low?: number };

/**
 * weather: temp (a number), place (also `city`), condition (also `sky`), high, low.
 *   {type: "weather", temp: 17.4, city: "Pune", sky: "Cloudy"} → {type: "weather", temp: 17.4, place: "Pune",
 *   condition: "Cloudy"}
 * Dropped: no numeric temp, or no place.
 */
export function readWeather(raw: any, here: Trail): WeatherBlock | null {
  const temp = num(raw.temp);
  const place = firstText([raw.place, raw.city], 80);
  if (temp === null || !place) {
    here.drop("weather needs a temp and a place");
    return null;
  }
  return clean({ type: "weather" as const, temp, place, condition: firstText([raw.condition, raw.sky], 40),
    high: num(raw.high) ?? undefined, low: num(raw.low) ?? undefined });
}
