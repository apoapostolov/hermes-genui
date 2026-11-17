import { describe, expect, it, vi } from "vitest";
import { openAndFill } from "./open";

describe("openAndFill", () => {
  it("fills the message box when one is there", async () => {
    const host = { composer: { insertText: vi.fn(async () => true), focus: vi.fn() }, navigate: vi.fn() };
    expect(await openAndFill("Pay Airtel", host)).toBe(true);
    expect(host.navigate).not.toHaveBeenCalled();
    expect(host.composer.focus).toHaveBeenCalled();
  });

  it("opens a new chat first when there is no message box, then fills it", async () => {
    let ready = false;
    const host = {
      composer: { insertText: vi.fn(async () => ready), focus: vi.fn() },
      navigate: vi.fn(() => { setTimeout(() => { ready = true; }, 30); }),
    };
    expect(await openAndFill("Pay Airtel", host, { waitMs: 500, stepMs: 10 })).toBe(true);
    expect(host.navigate).toHaveBeenCalledWith("/");
  });

  it("gives up and says so when no message box appears", async () => {
    const host = { composer: { insertText: vi.fn(async () => false), focus: vi.fn() }, navigate: vi.fn() };
    expect(await openAndFill("Pay Airtel", host, { waitMs: 60, stepMs: 10 })).toBe(false);
  });
});
