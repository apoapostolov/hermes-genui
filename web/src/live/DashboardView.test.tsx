import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardView, type Board } from "./DashboardView";

afterEach(cleanup);

const BOARD = { title: "Today", live: false, blocks: [
  { type: "kpis", items: [{ label: "Needs you", value: 2 }] },
  { type: "checklist", title: "Needs you", items: [{ text: "Pay Xfinity", id: "a1" }, { text: "Reply to Emma", id: "b2" }] },
  { type: "list", items: [{ title: "Pay the Xfinity bill of $89.98", run: "Pay the Xfinity bill of $89.98" }] },
] };

function draw(board: Board = BOARD) {
  const load = vi.fn(async (): Promise<Board | undefined> => board);
  const fill = vi.fn();
  const saveTicks = vi.fn(async () => {});
  render(<DashboardView load={load} fill={fill} saveTicks={saveTicks} />);
  return { load, fill, saveTicks };
}

describe("DashboardView", () => {
  it("draws the assembled board with the plugin's own blocks", async () => {
    draw();
    await screen.findByText("Pay Xfinity");
    expect(screen.getByRole("heading", { name: "Today" })).toBeTruthy();
    expect(document.querySelector(".hb-kpi")).toBeTruthy();
    expect(document.querySelector(".hb-dash")?.classList.contains("hb-blocks")).toBe(true);
  });

  it("greets by the time of day above the board, the date line still above it", async () => {
    draw({ ...BOARD, greeting: "Good morning, Sagar." });
    expect(await screen.findByRole("heading", { name: "Good morning, Sagar." })).toBeTruthy();
    expect(document.querySelector(".hb-dash-date")).toBeTruthy();
  });

  it("a dashboard page shows its Refresh bar, and Refresh asks for a new snapshot", async () => {
    const refresh = vi.fn(async () => {});
    const load = vi.fn(async (): Promise<Board | undefined> => ({ ...BOARD, title: "Executive",
      at: "2026-11-15T09:12:00", refreshing: false, error: null }));
    render(<DashboardView load={load} fill={vi.fn()} saveTicks={vi.fn(async () => {})} refresh={refresh} />);
    fireEvent.click(await screen.findByRole("button", { name: /Refresh/ }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(document.querySelector(".hb-refresh-label")?.textContent).toBe("Snapshot");
  });

  it("Today shows a Work sections bar only when it has work sections", async () => {
    const refresh = vi.fn(async () => {});
    const withWork = { ...BOARD, snapshots: { at: "2026-11-15T09:12:00", refreshing: false, error: null } };
    render(<DashboardView load={async () => withWork} fill={vi.fn()} saveTicks={vi.fn(async () => {})}
      refresh={refresh} refreshLabel="Work sections" />);
    expect(await screen.findByText(/Work sections/)).toBeTruthy();
    cleanup();
    render(<DashboardView load={async () => BOARD} fill={vi.fn()} saveTicks={vi.fn(async () => {})}
      refresh={refresh} refreshLabel="Work sections" />);
    await screen.findByText("Pay Xfinity");
    expect(screen.queryByText(/Work sections/)).toBeNull();
  });

  it("a page this profile doesn't have says so instead of loading forever", async () => {
    render(<DashboardView load={async () => { throw new Error("404"); }} fill={vi.fn()}
      saveTicks={vi.fn(async () => {})} />);
    expect(await screen.findByText(/isn't in this profile/)).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("a tap only fills a chat, it never sends", async () => {
    const { fill } = draw();
    fireEvent.click(await screen.findByRole("button", { name: /Pay the Xfinity bill/ }));
    expect(fill).toHaveBeenCalledWith("Pay the Xfinity bill of $89.98");
  });

  it("a tick is saved by item id, and only the item that changed", async () => {
    const { saveTicks } = draw();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Reply to Emma/ }));
    await vi.waitFor(() => expect(saveTicks).toHaveBeenCalledWith({ b2: true }));
  });

  it("without a dashboard, says how to make one", async () => {
    draw({ title: null, blocks: [], live: false });
    expect(await screen.findByText(/Create my personal dashboard/)).toBeTruthy();
  });

  it("after a refresh drops a ticked item, no tick moves onto another item", async () => {
    const list = (ids: string[]) => ({ title: "Today", live: false, blocks: [
      { type: "checklist", items: ids.map((id) => ({ text: `Item ${id}`, id })) }] });
    const boards = [list(["a", "b", "c", "d"]), list(["a", "c", "d"])];
    const load = vi.fn(async (): Promise<Board | undefined> => boards[0]);
    const saveTicks = vi.fn(async () => {});
    const { rerender } = render(<DashboardView load={load} fill={vi.fn()} saveTicks={saveTicks} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Item b/ }));
    await vi.waitFor(() => expect(saveTicks).toHaveBeenLastCalledWith({ b: true }));
    boards.shift();
    rerender(<DashboardView load={load} fill={vi.fn()} saveTicks={saveTicks} refreshNow={1} />);
    await vi.waitFor(() => expect(screen.queryByRole("checkbox", { name: /Item b/ })).toBeNull());
    expect((screen.getByRole("checkbox", { name: /Item c/ }) as HTMLInputElement).getAttribute("aria-checked"))
      .not.toBe("true");
    fireEvent.click(screen.getByRole("checkbox", { name: /Item d/ }));
    await vi.waitFor(() => expect(saveTicks).toHaveBeenLastCalledWith({ d: true }));
  });

  it("a board with live sections refreshes every 5 seconds", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async (): Promise<Board | undefined> => ({ title: "Today", live: true, blocks: BOARD.blocks }));
    render(<DashboardView load={load} fill={vi.fn()} saveTicks={vi.fn(async () => {})} />);
    await vi.advanceTimersByTimeAsync(5100);
    await vi.advanceTimersByTimeAsync(5100);
    expect(load.mock.calls.length).toBeGreaterThanOrEqual(3);
    vi.useRealTimers();
  });

  it("Reopen on the tracker reaches the plugin, then the board reloads", async () => {
    const tracker = { title: "Today", blocks: [{ type: "tracker", need: [], handled: [
      { id: "xp", title: "Xfinity", kind: "closed", verb: "Paid", why: "receipt", reopen: true }] }] };
    const load = vi.fn(async (): Promise<Board | undefined> => tracker);
    const post = vi.fn(async () => ({}));
    render(<DashboardView load={load} fill={vi.fn()} saveTicks={vi.fn(async () => {})} post={post} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Handled/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith("/assistant/items/xp", { method: "POST",
      body: { status: "suggested" } }));
    await vi.waitFor(() => expect(load.mock.calls.length).toBeGreaterThan(1));
  });

  it("a board that opens with the sky band leaves out its own header", async () => {
    const board = { title: "Today", greeting: "Good morning, Sam.", blocks: [{ type: "briefing",
      greeting: "Good morning, Sam.", sky: "clear", counts: { overdue: 0, need: 1, handled: 1 } }] };
    render(<DashboardView load={async () => board} fill={vi.fn()} saveTicks={vi.fn(async () => {})} />);
    await screen.findByText("Good morning, Sam.");
    expect(document.querySelector(".hb-dash-head")).toBeNull();
    expect(screen.getAllByText("Good morning, Sam.")).toHaveLength(1);
  });
});

