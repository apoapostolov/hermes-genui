// The Today page: the dashboard the plugin assembles from its own blocks (GET /dashboard), drawn with the same
// renderer as any board in chat. Nothing here is bespoke: the blocks come from the catalog, the layout from the spec a
// skill wrote. Taps only fill a chat (there is no chat on this page), and a checklist tick is saved by the item's id,
// so it follows the item even as the list changes.
import { useCallback, useEffect, useRef, useState } from "react";
import { Blocks } from "../core/Blocks";
import { readBlocks } from "../core/readBlocks";
import { BlockActions, type Rest } from "../host/actions";
import { RefreshBar } from "./RefreshBar";

export type Snapshot = { at: string | null; refreshing: boolean; error: string | null; schedule?: string | null };
/** A board from GET /dashboard (Today: `snapshots` when it has work sections) or GET /pages/<slug> (at, refreshing,
 *  error: its snapshot's status). */
export type Board = { title: string | null; blocks: unknown[]; live?: boolean; greeting?: string | null;
  snapshots?: Snapshot; at?: string | null; refreshing?: boolean; error?: string | null; schedule?: string | null };
type Drawn = { title: string | null; greeting: string | null; blocks: ReturnType<typeof readBlocks>; live: boolean;
  at: Date; snapshot: Snapshot | null };

/** The snapshot status a board carries, if it is (or holds) a designed page. */
function snapshotOf(b: Board): Snapshot | null {
  if (b.snapshots) return b.snapshots;
  if (b.at !== undefined || b.refreshing !== undefined) {
    return { at: b.at ?? null, refreshing: Boolean(b.refreshing), error: b.error ?? null, schedule: b.schedule ?? null };
  }
  return null;
}

const EMPTY = [{ type: "callout", tone: "info", text:
  "No dashboard yet. Ask Hermes: “Create my personal dashboard”, or “put my bills and NVDA on my Today page”." }];

/** Every checklist on a board, by where it sits ("1", "3.tabs.0.children.0"), with its items' ids in order. */
export function checklistsByPath(node: unknown, found: Record<string, (string | undefined)[]> = {}) {
  if (Array.isArray(node)) node.forEach((n) => checklistsByPath(n, found));
  else if (node && typeof node === "object") {
    const block = node as { type?: string; path?: string; items?: { id?: string }[] };
    if (block.type === "checklist" && typeof block.path === "string" && Array.isArray(block.items)) {
      found[block.path] = block.items.map((i) => i.id);
    }
    Object.values(node).forEach((v) => { if (v && typeof v === "object") checklistsByPath(v, found); });
  }
  return found;
}

/** A short, stable name for a set of checklists and their items: the board remounts (and its ticks start fresh) only
 *  when this changes. */
function signature(ids: Record<string, (string | undefined)[]>): string {
  const text = JSON.stringify(ids);
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function DashboardView({ load, fill, saveTicks, post, refreshNow = 0, refresh, refreshLabel = "Snapshot" }: {
  load: () => Promise<Board | undefined>; fill: (text: string) => void;
  saveTicks: (ticks: Record<string, boolean>) => Promise<void>;
  /** A block's POST to the plugin (the tracker's Reopen); the board reloads after it. */
  post?: Rest;
  /** A designed page's Refresh (starts its job); shown with the snapshot's status when the board has one. */
  refresh?: () => Promise<void>; refreshLabel?: string;
  /** Changing it refreshes at once (after an action elsewhere; tests). */
  refreshNow?: number;
}) {
  const [board, setBoard] = useState<Drawn | null>(null);
  const [missing, setMissing] = useState(false);
  const live = useRef(false);
  const lastTicks = useRef<Record<string, number[]>>({});
  const reload = useCallback(async () => {
    try {
      const next = await load();
      if (!next) return;
      setMissing(false);
      const snapshot = snapshotOf(next);
      live.current = Boolean(next.live) || Boolean(snapshot?.refreshing);
      setBoard({ title: next.title, greeting: next.greeting ?? null, blocks: readBlocks(next.title ? next.blocks : EMPTY),
        live: live.current, at: new Date(), snapshot });
    } catch {
      setMissing(true); // keep what's on screen; with nothing on screen yet, say why
    }
  }, [load]);
  useEffect(() => { if (refreshNow) void reload(); }, [refreshNow, reload]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!(typeof document !== "undefined" && document.hidden)) await reload();
      if (!stop) timer = setTimeout(tick, live.current ? 5000 : 30000);
    };
    void tick();
    return () => { stop = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  if (!board) {
    return (
      <div className="hb-blocks hb-dash">
        <p className="hb-dash-sub">{missing
          ? "This page isn't in this profile. Switch back to the profile it was made in, or ask Hermes to make it here."
          : "Loading…"}</p>
      </div>
    );
  }
  const ids = checklistsByPath(board.blocks);
  const sig = signature(ids);
  // The checklist block saves {state: {"<path>": [ticked item numbers]}}. Send only what changed since the last save,
  // as {"<item id>": ticked}, so a tap never touches the other items.
  const rest: Rest = async (path, init) => {
    if (init?.method === "POST" && post && path.startsWith("/assistant/items/")) {
      try { return await post(path, init); } finally { void reload(); }
    }
    if (init?.method !== "PUT") return {};
    const state = ((init.body as { state?: Record<string, unknown> } | undefined)?.state) ?? {};
    const ticks: Record<string, boolean> = {};
    for (const [where, ticked] of Object.entries(state)) {
      const now = Array.isArray(ticked) ? (ticked as number[]) : [];
      const before = new Set(lastTicks.current[`${sig}:${where}`] ?? []);
      const after = new Set(now);
      (ids[where] ?? []).forEach((id, n) => {
        if (id && before.has(n) !== after.has(n)) ticks[id] = after.has(n);
      });
      lastTicks.current[`${sig}:${where}`] = now;
    }
    if (Object.keys(ticks).length) await saveTicks(ticks);
    return { ok: true };
  };
  return (
    <div className="hb-blocks hb-dash">
      {(board.blocks[0] as { type?: string } | undefined)?.type !== "briefing" && (
        <header className="hb-dash-head">
          <div className="hb-dash-date">
            {board.at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1>{board.greeting ?? board.title ?? "Today"}</h1>
        </header>
      )}
      {refresh && board.snapshot && (
        <RefreshBar label={refreshLabel} {...board.snapshot} onRefresh={async () => {
          setBoard((b) => (b ? { ...b, snapshot: { ...b.snapshot!, refreshing: true, error: null } } : b));
          try { await refresh(); } finally { void reload(); }
        }} />
      )}
      {/* Keyed by its checklists' items: when they change, the board remounts and ticks start from what's open now,
          so a tick never stays on a list whose items have moved. Same items, same board: tabs and scroll stay. */}
      <BlockActions.Provider value={{ send: fill, fill, rest, blockId: `dashboard-${sig}` }}>
        <Blocks key={sig} blocks={board.blocks} />
      </BlockActions.Provider>
    </div>
  );
}
