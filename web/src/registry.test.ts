import { describe, expect, it } from "vitest";
import catalog from "../../core/catalog.json";
import { PAGE_KINDS, REGISTRY } from "./registry";

describe("registry", () => {
  it("has exactly one entry per catalog type (include is swapped for its board before storing, so never drawn)", () => {
    const kinds = catalog.blocks.map((b) => b.kind).filter((k) => k !== "include");
    expect(new Set(kinds).size).toBe(kinds.length);
    // Plus the Today page's own blocks (briefing, tracker, prepared), drawn from the plugin's data, never the model's.
    expect(Object.keys(REGISTRY).sort()).toEqual([...kinds, ...PAGE_KINDS].sort());
  });

  it("gives every type a reader and a drawing", () => {
    for (const [kind, entry] of Object.entries(REGISTRY)) {
      expect([kind, typeof entry.read, typeof entry.Component]).toEqual([kind, "function", "function"]);
    }
  });
});
