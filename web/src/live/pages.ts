// Designed dashboards in the sidebar: each saved page gets a row and a page of its own (/genui-board/<slug>), added
// when GET /pages lists it and taken away when it goes. The page itself is a DashboardView of /pages/<slug>.
export type PageEntry = { slug: string; title: string; kind: string };
export const BOARD_PATH = "/genui-board";

type Register = (c: { id: string; area: string; title?: string; data?: unknown; render?: () => unknown }) => () => void;

/** Keeps one route and one sidebar row per listed dashboard; `view(slug)` draws a page. Returns `sync(list)`. */
export function pageRoutes(register: Register, view: (slug: string) => unknown) {
  const shown = new Map<string, { title: string; off: Array<() => void> }>();
  return (list: PageEntry[]) => {
    const wanted = new Map(list.filter((p) => p.kind === "dashboard" && /^[a-z0-9-]{1,40}$/.test(p.slug))
      .map((p) => [p.slug, p.title]));
    for (const [slug, entry] of shown) {
      if (wanted.get(slug) !== entry.title) {
        entry.off.forEach((off) => off());
        shown.delete(slug);
      }
    }
    for (const [slug, title] of wanted) {
      if (shown.has(slug)) continue;
      const path = `${BOARD_PATH}/${slug}`;
      shown.set(slug, { title, off: [
        register({ id: `hermes-genui-page-${slug}`, area: "routes", title, data: { path }, render: () => view(slug) }),
        register({ id: `hermes-genui-page-${slug}-nav`, area: "sidebar.nav",
          data: { codicon: "dashboard", label: title, path } }),
      ] });
    }
  };
}
