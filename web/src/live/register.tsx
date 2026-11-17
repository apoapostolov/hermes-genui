// Puts the plugin's pages into Hermes Desktop and the Webapp: the Today page, an assembled dashboard, with its sidebar
// row while a dashboard exists, and a page with a sidebar row for each kept dashboard. Asks every 5 seconds which of
// them exist (skipped while the window is hidden).
import type { ReactNode } from "react";
import { DashboardView, type Board } from "./DashboardView";
import { pageRoutes, type PageEntry } from "./pages";

export const POLL_MS = 5000;
export const TODAY_PATH = "/genui-today";

type Contribution = { id: string; area: string; order?: number; title?: string; data?: unknown;
  render?: () => ReactNode };
export type LiveCtx = {
  rest: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;
  setInterval: (fn: () => void, ms: number) => () => void;
  register: (c: Contribution) => () => void;
};

export function registerLive(ctx: LiveCtx, fill: (text: string) => void): void {
  let hasDashboard = false;
  let nav: (() => void) | null = null;
  // The page's address is known from the start, so a reload on it works; without the sidebar row nobody sees it.
  ctx.register({ id: "hermes-genui-today", area: "routes", title: "Today", data: { path: TODAY_PATH },
    render: () => (
      <DashboardView fill={fill} load={() => ctx.rest("/dashboard") as Promise<Board | undefined>}
        post={(path, init) => ctx.rest(path, init)}
        saveTicks={async (ticks) => { await ctx.rest("/dashboard/state", { method: "PUT", body: { ticks } }); }}
        refresh={async () => { await ctx.rest("/pages/today/refresh", { method: "POST" }); }}
        refreshLabel="Work sections" />
    ) });

  const sync = () => {
    if (hasDashboard && !nav) {
      nav = ctx.register({ id: "hermes-genui-today-nav", area: "sidebar.nav",
        data: { codicon: "pulse", label: "Today", path: TODAY_PATH } });
    } else if (!hasDashboard && nav) {
      nav();
      nav = null;
    }
  };
  const checkHead = async () => {
    try {
      const head = (await ctx.rest("/dashboard/head")) as { title?: string | null } | undefined;
      hasDashboard = Boolean(head?.title);
      sync();
    } catch {
      // this profile can't answer (another profile, or an older copy of the plugin): no Today row here
      hasDashboard = false;
      sync();
    }
  };

  const syncPages = pageRoutes(ctx.register as never, (slug) => (
    <DashboardView fill={fill} load={() => ctx.rest(`/pages/${slug}`) as Promise<Board | undefined>}
      saveTicks={async () => {}}
      refresh={async () => { await ctx.rest(`/pages/${slug}/refresh`, { method: "POST" }); }} />
  ));
  const checkPages = async () => {
    try {
      const listed = (await ctx.rest("/pages")) as { pages?: PageEntry[] } | undefined;
      if (Array.isArray(listed?.pages)) syncPages(listed.pages);
    } catch {
      syncPages([]); // this profile can't list pages: its rows go; the next answer brings them back
    }
  };
  const poll = () => Promise.all([checkHead(), checkPages()]);
  void poll();
  ctx.setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    void poll();
  }, POLL_MS);
}
