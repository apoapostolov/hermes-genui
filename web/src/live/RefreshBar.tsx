// A designed page's snapshot line: when it was last filled, Refresh (which runs the page's job in the background),
// "Refreshing…" while that runs, and why the last refresh failed when it did. The old snapshot stays on screen.
/** "09:12" today; "Wed 12 Nov, 09:12" on another day, so an old snapshot never passes for today's. */
export function when(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (at.toDateString() === now.toDateString()) return time;
  return `${at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

export function RefreshBar({ label, at, refreshing, error, schedule, onRefresh }: {
  label: string; at: string | null; refreshing: boolean; error: string | null; schedule?: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="hb-refresh" role="status">
      <span className="hb-refresh-label">{label}</span>
      <span className="hb-refresh-when">{at ? `updated ${when(at)}` : "not filled yet"}</span>
      {schedule && <span className="hb-refresh-when">· refreshes {schedule}</span>}
      {error && <span className="hb-refresh-error">{error}</span>}
      <button type="button" className="hb-refresh-button" disabled={refreshing} onClick={onRefresh}
        aria-label={refreshing ? "Refreshing" : `Refresh ${label}`}>
        <span aria-hidden="true">↻</span> {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
