import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefreshBar } from "./RefreshBar";

afterEach(cleanup);

// 09:12 today, so "updated 09:12" (today's format) holds whatever day the tests run.
const TODAY_0912 = (() => { const d = new Date(); d.setHours(9, 12, 0, 0); return d.toISOString(); })();

describe("RefreshBar", () => {
  it("shows when the page was last filled, and Refresh calls back", () => {
    const onRefresh = vi.fn();
    render(<RefreshBar label="Executive" at={TODAY_0912} refreshing={false} error={null} onRefresh={onRefresh} />);
    expect(screen.getByText(/updated 09:12/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("while refreshing says so and can't be pressed again", () => {
    render(<RefreshBar label="Executive" at={TODAY_0912} refreshing error={null} onRefresh={() => {}} />);
    expect(screen.getByText("Refreshing…")).toBeTruthy();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("a failed refresh shows why, beside the last good time", () => {
    render(<RefreshBar label="Executive" at={TODAY_0912} refreshing={false}
      error="The last refresh didn't finish." onRefresh={() => {}} />);
    expect(screen.getByText("The last refresh didn't finish.")).toBeTruthy();
    expect(screen.getByText(/updated 09:12/)).toBeTruthy();
  });

  it("never filled says so", () => {
    render(<RefreshBar label="Executive" at={null} refreshing={false} error={null} onRefresh={() => {}} />);
    expect(screen.getByText(/not filled yet/)).toBeTruthy();
  });
});

describe("RefreshBar dates", () => {
  it("an older snapshot shows its day, so stale numbers don't look current", () => {
    const old = new Date();
    old.setDate(old.getDate() - 3);
    old.setHours(9, 12, 0, 0);
    render(<RefreshBar label="Snapshot" at={old.toISOString()} refreshing={false} error={null} onRefresh={() => {}} />);
    const day = old.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    expect(screen.getByText(`updated ${day}, 09:12`)).toBeTruthy();
  });
});


describe("RefreshBar schedule", () => {
  it("a page that refreshes itself says when", () => {
    render(<RefreshBar label="Snapshot" at={null} refreshing={false} error={null} schedule="every day at 8am"
      onRefresh={() => {}} />);
    expect(screen.getByText(/refreshes every day at 8am/)).toBeTruthy();
  });
});
