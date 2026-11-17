import { describe, expect, it, vi } from "vitest";
import { registerLive } from "./register";

let head: unknown = { title: null };
let pagesList: unknown = { pages: [] };
let failing = false;

function fakeCtx() {
  const live = new Map<string, { area: string; data?: unknown }>();
  const ticks: Array<() => void> = [];
  const ctx = {
    rest: vi.fn(async (path: string, init?: unknown) => {
      if (failing) throw new Error("404");
      return path === "/dashboard/head" ? head : path === "/pages" ? pagesList : { path, init };
    }),
    setInterval: vi.fn((fn: () => void) => { ticks.push(fn); return () => {}; }),
    register: vi.fn((c: { id: string; area: string; data?: unknown }) => {
      live.set(c.id, c);
      return () => live.delete(c.id);
    }),
  };
  return { ctx, live, tick: () => ticks.forEach((fn) => fn()) };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("registerLive", () => {
  it("adds nothing visible while there is no dashboard; the page's address is known from the start", async () => {
    const { ctx, live } = fakeCtx();
    registerLive(ctx, () => {});
    expect([...live.values()].map((c) => c.area)).toEqual(["routes"]); // before any answer: a reload on the page works
    await settle();
    expect(ctx.rest).toHaveBeenCalledWith("/dashboard/head");
    expect([...live.values()].map((c) => c.area)).toEqual(["routes"]);
    expect(ctx.setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
  });

  it("asks only whether Today and kept pages exist: nothing in the status bar, no tracked items fetched", async () => {
    head = { title: "Today" };
    const { ctx, live, tick } = fakeCtx();
    registerLive(ctx, () => {});
    await settle();
    tick();
    await settle();
    expect([...live.values()].map((c) => c.area)).not.toContain("statusBar.right");
    expect([...new Set(ctx.rest.mock.calls.map(([path]) => path))].sort()).toEqual(["/dashboard/head", "/pages"]);
    head = { title: null };
  });

  it("gives each designed dashboard a sidebar row and a page, and takes them away when it goes", async () => {
    pagesList = { pages: [{ slug: "executive", title: "Executive", kind: "dashboard" }] };
    const { ctx, live, tick } = fakeCtx();
    registerLive(ctx, () => {});
    await settle();
    expect(live.get("hermes-genui-page-executive")?.data).toEqual({ path: "/genui-board/executive" });
    expect(live.get("hermes-genui-page-executive-nav")?.data).toEqual(
      { codicon: "dashboard", label: "Executive", path: "/genui-board/executive" });
    pagesList = { pages: [] };
    tick();
    await settle();
    expect(live.has("hermes-genui-page-executive")).toBe(false);
    expect(live.has("hermes-genui-page-executive-nav")).toBe(false);
  });

  it("a profile that can't list pages (another profile, an older plugin) takes the rows away", async () => {
    pagesList = { pages: [{ slug: "executive", title: "Executive", kind: "dashboard" }] };
    head = { title: "Today" };
    const { ctx, live, tick } = fakeCtx();
    registerLive(ctx, () => {});
    await settle();
    expect(live.has("hermes-genui-page-executive-nav")).toBe(true);
    expect(live.has("hermes-genui-today-nav")).toBe(true);
    failing = true;
    tick();
    await settle();
    expect(live.has("hermes-genui-page-executive-nav")).toBe(false);
    expect(live.has("hermes-genui-today-nav")).toBe(false);
    failing = false;
    pagesList = { pages: [] };
    head = { title: null };
  });

  it("adds the sidebar row once a dashboard exists, and the page draws it", async () => {
    head = { title: "Today" };
    const { ctx, live } = fakeCtx();
    registerLive(ctx, () => {});
    await settle();
    expect(ctx.rest).toHaveBeenCalledWith("/dashboard/head");
    expect([...live.values()].map((c) => c.area).sort()).toEqual(["routes", "sidebar.nav"]);
    expect(live.get("hermes-genui-today-nav")?.data).toEqual({ codicon: "pulse", label: "Today", path: "/genui-today" });
    expect(live.get("hermes-genui-today")?.data).toEqual({ path: "/genui-today" });
    head = { title: null };
  });

  it("doesn't ask while the window is hidden", async () => {
    const { ctx, tick } = fakeCtx();
    registerLive(ctx, () => {});
    await settle();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    tick();
    await settle();
    expect(ctx.rest.mock.calls.filter(([path]) => path === "/dashboard/head")).toHaveLength(1);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });

});
