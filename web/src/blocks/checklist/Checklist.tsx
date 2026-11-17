// Things to tick off, with "3 of 9 done" and a bar above them; items of one group sit under its heading. Inside a
// `::blocks` tag the ticks are saved with the board (savedState.ts), so they're there after a reload and on the laptop.
import { useContext, useEffect, useRef, useState } from "react";
import { BlockActions } from "../../host/actions";
import type { ChecklistBlock, ChecklistItem } from "./read";
import { InlineText } from "../../lib/InlineText";
import { Icon } from "../../lib/Icon";
import { loadBoardState, readTicks, saveBoardValue, ticksAfterLoad, toggleTick } from "./savedState";
import { useNamed } from "../../core/a11y";

export function Checklist({ title, numbered, items, ticked, path }: ChecklistBlock) {
  const [ticks, tap] = useSavedTicks(path, ticked, items.length);
  const done = ticks.length;
  const allDone = done === items.length;
  const named = useNamed("checklist", title);
  return (
    <div className="hb-card hb-checklist" role="group" {...named.root}>
      <div className="hb-checklist-head">
        {title && <span id={named.title.id} className="hb-card-title"><InlineText text={title} /></span>}
        <span className={allDone ? "hb-checklist-count hb-checklist-count-done" : "hb-checklist-count"} aria-live="polite">
          {allDone ? "All done" : `${done} of ${items.length} done`}
        </span>
      </div>
      <div className="hb-checklist-track"><span className="hb-checklist-fill" style={{ width: `${(done / items.length) * 100}%` }} /></div>
      {items.map((item, i) => (
        <div key={i}>
          {startsGroup(items, i) && <div className="hb-checklist-group"><InlineText text={item.group!} /></div>}
          <button type="button" role="checkbox" aria-checked={ticks.includes(i)} onClick={() => tap(i)}
            aria-labelledby={`${named.title.id}-item-${i}`}
            className={ticks.includes(i) ? "hb-check hb-check-on" : "hb-check"}>
            <span className="hb-check-mark" aria-hidden="true">{ticks.includes(i) ? <Icon name="check" size={13} stroke={3} /> : numbered ? i + 1 : null}</span>
            <span id={`${named.title.id}-item-${i}`} className="hb-check-text"><InlineText text={item.text} /></span>
          </button>
        </div>
      ))}
    </div>
  );
}

/** Whether item i starts a new group heading: it has a group, and the item before it has a different one (or none).
 *  [Jacket (Clothes), Socks (Clothes), Passport (Papers)]: at 0 → yes, at 1 → no, at 2 → yes */
function startsGroup(items: ChecklistItem[], i: number): boolean {
  const group = items[i].group;
  if (!group) return false;
  return items[i - 1]?.group !== group;
}

/** The ticks on screen and a tap handler. With a board and a REST door (inside a `::blocks` tag) the saved ticks are
 *  loaded and every tap is saved; without them (or when the server fails) the ticks just live on screen. */
function useSavedTicks(path: string, ticked: number[], count: number): [number[], (i: number) => void] {
  const { rest, blockId } = useContext(BlockActions);
  const [ticks, setTicks] = useState(ticked);
  const shown = useRef(ticked);
  const tapped = useRef(false);
  shown.current = ticks;

  useEffect(() => {
    if (!rest || !blockId) return;
    let live = true;
    loadBoardState(rest, blockId).then((state) => {
      if (live) setTicks(ticksAfterLoad(readTicks(state[path], count), shown.current, tapped.current));
    });
    return () => {
      live = false;
    };
  }, [rest, blockId, path, count]);

  function tap(i: number) {
    tapped.current = true;
    const next = toggleTick(shown.current, i);
    shown.current = next;
    setTicks(next);
    if (rest && blockId) void saveBoardValue(rest, blockId, path, next);
  }
  return [ticks, tap];
}
