// Things to tick off, with "3 of 9 done" and a bar above them; items of one group sit under its heading and each item
// can say where its work stands (state), who holds it and why it waits. Inside a `::blocks` tag the ticks are saved
// with the board, so they're there after a reload and on the laptop. The ticks live on the BOARD keyed by the
// checklist's identity chain (core/blockState.ts) — an insertion, a reorder, a move to another container or a
// reopen all find them; a never-updated board still files them by position, exactly as before.
import { useId } from "react";
import { useStoredValue } from "../../core/blockState";
import type { ChecklistBlock, ChecklistItem, ItemState } from "./read";
import { InlineText } from "../../lib/InlineText";
import { Icon } from "../../lib/Icon";
import { readTicks, toggleTick } from "./savedState";

/** The word drawn beside an item (and read with it): pending has none, done is carried by the tick and the count. */
const STATE_WORDS: Record<ItemState, string | undefined> = {
  pending: undefined,
  active: "In progress",
  blocked: "Blocked",
  skipped: "Skipped",
};

/** The compact strip has no room for a state word, so the button's label and title carry it. */
function segmentName(item: ChecklistItem, on: boolean): string {
  const state = on ? "done" : item.state ? STATE_WORDS[item.state]?.toLowerCase() ?? item.state : "not started";
  const sources = item.sourceIds?.length ? `, sources ${item.sourceIds.join(", ")}` : "";
  return `${item.text}, ${state}${sources}`;
}

export function Checklist({ title, numbered, items, ticked, path, density }: ChecklistBlock) {
  const [ticks, tap] = useSavedTicks(path, ticked, items.length);
  const uid = useId();
  const done = ticks.length;
  const allDone = done === items.length;
  const open = items.filter((_, i) => !ticks.includes(i));
  const blocked = open.filter((item) => item.state === "blocked").length;
  const skipped = open.filter((item) => item.state === "skipped").length;
  const pointer = items.some((item) => item.state) ? pointerAt(items, ticks) : -1;

  function row(item: ChecklistItem, index: number) {
    const on = ticks.includes(index);
    const state = on ? undefined : item.state;
    const word = state ? STATE_WORDS[state] : undefined;
    const labelId = `${uid}-label-${index}`;
    const wordId = word ? `${uid}-state-${index}` : undefined;
    const ownerId = item.owner ? `${uid}-owner-${index}` : undefined;
    const noteId = item.note ? `${uid}-note-${index}` : undefined;
    const sourceId = item.sourceIds?.length ? `${uid}-source-${index}` : undefined;
    const describedBy = [wordId, ownerId, noteId, sourceId].filter(Boolean).join(" ") || undefined;
    const classes = ["hb-check", on ? "hb-check-on" : state ? `hb-check-${state}` : "", pointer === index ? "hb-check-pointer" : ""];
    return (
      <div key={index} className="hb-checklist-row">
        <button type="button" role="checkbox" aria-checked={on} aria-current={pointer === index ? "step" : undefined}
          aria-labelledby={labelId} aria-describedby={describedBy} onClick={() => tap(index)} className={classes.join(" ").trim()}>
          <span className="hb-check-mark">{on ? <Icon name="check" size={13} stroke={3} /> : numbered ? index + 1 : null}</span>
          <span className="hb-check-text">
            <span className="hb-check-line">
              <span className="hb-check-label" id={labelId}><InlineText text={item.text} /></span>
              {word && <span className="hb-check-state" id={wordId}>{word}</span>}
              {item.owner && <span className="hb-check-owner" id={ownerId}>{item.owner}</span>}
            </span>
            {item.note && <span className="hb-check-note" id={noteId}>{item.note}</span>}
            {item.sourceIds?.length && <span className="hb-check-source" id={sourceId}>sources {item.sourceIds.join(", ")}</span>}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="hb-card hb-checklist">
      <div className="hb-checklist-head">
        {title && <span className="hb-card-title"><InlineText text={title} /></span>}
        <span className={allDone ? "hb-checklist-count hb-checklist-count-done" : "hb-checklist-count"} aria-live="polite">
          {countText(done, items.length, blocked, skipped)}
        </span>
      </div>
      <div className="hb-checklist-track" aria-hidden="true">
        <span className="hb-checklist-fill" style={{ transform: `scaleX(${done / (items.length || 1)})` }} />
      </div>
      {density === "compact" && (
        <div className="hb-checklist-compact" role="group" aria-label={title ?? "Phases"}>
          {items.map((item, index) => {
            const on = ticks.includes(index);
            const state = on ? undefined : item.state;
            const classes = ["hb-check-seg", on ? "hb-check-on" : state ? `hb-check-${state}` : "",
              pointer === index ? "hb-check-pointer" : ""];
            return (
              <button type="button" key={index} role="checkbox" aria-checked={on}
                aria-current={pointer === index ? "step" : undefined}
                aria-label={segmentName(item, on)} title={segmentName(item, on)}
                onClick={() => tap(index)} className={classes.join(" ").trim()}>
                <span className="hb-sr">{segmentName(item, on)}</span>
              </button>
            );
          })}
        </div>
      )}
      {density !== "compact" && segmentsOf(items).map((segment, si) =>
        segment.label ? (
          <div key={si} className="hb-checklist-group" role="group" aria-labelledby={`${uid}-group-${si}`}>
            <div className="hb-checklist-group-label" id={`${uid}-group-${si}`}><InlineText text={segment.label} /></div>
            {segment.rows.map(({ item, index }) => row(item, index))}
          </div>
        ) : (
          <div key={si} className="hb-checklist-plain">{segment.rows.map(({ item, index }) => row(item, index))}</div>
        ),
      )}
    </div>
  );
}

/** "3 of 9 done", naming what is stuck beside it: "6 of 9 done, 1 blocked", "6 of 9 done, 2 skipped".
 *  (6, 9, 1, 0) → "6 of 9 done, 1 blocked";  (9, 9, 0, 0) → "All done" */
export function countText(done: number, total: number, blocked: number, skipped: number): string {
  const head = done === total ? "All done" : `${done} of ${total} done`;
  const beside = [blocked ? `${blocked} blocked` : "", skipped ? `${skipped} skipped` : ""].filter(Boolean);
  return beside.length ? `${head}, ${beside.join(", ")}` : head;
}

/** The row the block points at: the first item being worked on, else the first one not started, else -1 (no pointer).
 *  A ticked item is done, so it never holds the pointer. */
function pointerAt(items: ChecklistItem[], ticks: number[]): number {
  const open = (i: number) => !ticks.includes(i);
  const active = items.findIndex((item, i) => item.state === "active" && open(i));
  if (active >= 0) return active;
  return items.findIndex((item, i) => item.state === "pending" && open(i));
}

type Row = { item: ChecklistItem; index: number };

/** The items in drawing order, split where the group heading changes: one segment per heading, and one unlabelled
 *  segment for the items before, between or after headings. An ungrouped item never joins a labelled group.
 *  [Jacket (Clothes), Socks (Clothes), Passport] → [{label: "Clothes", rows: [0, 1]}, {rows: [2]}] */
function segmentsOf(items: ChecklistItem[]): { label?: string; rows: Row[] }[] {
  const segments: { label?: string; rows: Row[] }[] = [];
  items.forEach((item, index) => {
    const last = segments[segments.length - 1];
    const row = { item, index };
    if (item.group) {
      if (last?.label === item.group) last.rows.push(row);
      else segments.push({ label: item.group, rows: [row] });
    } else if (last && !last.label) last.rows.push(row);
    else segments.push({ rows: [row] });
  });
  return segments;
}

/** The ticks on screen and a tap handler. Inside a `::blocks` tag they are the BOARD's: saved at once on the
 *  door (by position until an update makes the board living, by identity after) and restored on every mount —
 *  a tap made while the door is still answering stays the truth the reader last touched. With no board and no
 *  door (or when the server fails) the ticks just live on screen. */
function useSavedTicks(path: string, ticked: number[], count: number): [number[], (i: number) => void] {
  const [ticks, setTicks] = useStoredValue<number[]>({
    path, door: "always",
    initial: () => ticked,
    revive: (saved) => readTicks(saved, count),
    stored: (value) => value,
  });
  return [ticks, (i) => setTicks(toggleTick(ticks, i))];
}
