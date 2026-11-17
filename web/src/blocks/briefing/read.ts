// briefing (Today only): the sky band at the top of Today, built by the plugin from its own data.
import { clean, firstText, num, type Trail } from "../../core/fields";

export const SKIES = ["clear", "cloud", "rain", "snow", "storm", "fog", "night"] as const;
export type Sky = (typeof SKIES)[number];
export type Counts = { overdue: number; need: number; handled: number };
export type BriefingBlock = { type: "briefing"; greeting: string; date?: string; place?: string; temp?: number;
  condition?: string; high?: number; low?: number; sky: Sky; counts: Counts };

const count = (v: unknown) => { const n = num(v); return n !== null && n >= 0 ? Math.floor(n) : 0; };

/**
 * briefing: greeting, date, place, temp, condition, high, low, sky (clear | cloud | rain | snow | storm | fog | night;
 * anything else is clear), counts {overdue, need, handled}.
 * Dropped: no greeting.
 */
export function readBriefing(raw: any, here: Trail): BriefingBlock | null {
  const greeting = firstText([raw.greeting], 80);
  if (!greeting) return here.drop("briefing needs a greeting");
  const c = raw.counts ?? {};
  return clean({ type: "briefing" as const, greeting, date: firstText([raw.date], 40), place: firstText([raw.place], 60),
    temp: num(raw.temp) ?? undefined, condition: firstText([raw.condition], 40), high: num(raw.high) ?? undefined,
    low: num(raw.low) ?? undefined, sky: (SKIES as readonly string[]).includes(raw.sky) ? raw.sky : "clear",
    counts: { overdue: count(c.overdue), need: count(c.need), handled: count(c.handled) } });
}
