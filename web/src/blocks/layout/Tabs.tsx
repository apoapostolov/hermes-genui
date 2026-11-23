// Tabs: a bar of tab buttons above one panel. Only the picked tab's blocks are drawn. The pick is the BOARD's
// answer from the click itself (core/blockState.ts): a never-updated board, a living update, a move, or a reopen
// lands on the tab the reader left open — the door holds it from the edit onward, mounted or headless alike.
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useStoredValue } from "../../core/blockState";
import { InlineText } from "../../lib/InlineText";

/**
 * Which tab an arrow key moves to: Right is the next one, Left the one before, wrapping at the ends; any other key
 * stays put. (0 of 3, "ArrowRight") → 1;  (2 of 3, "ArrowRight") → 0;  (0 of 3, "ArrowLeft") → 2;  (1, "Enter") → 1
 */
export function tabAfterKey(current: number, count: number, key: string): number {
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  return current;
}

/** `labels` name the tabs; `badges[i]`, when set, is a count shown beside tab i's label; `panel(i)` draws tab i's
 *  blocks, called only for the picked tab. */
export function Tabs({ labels, badges = [], panel }: {
  labels: string[]; badges?: (number | undefined)[]; panel: (i: number) => ReactNode;
}) {
  const [answer, pick] = useStoredValue<number>({
    door: "identity",
    initial: () => 0,
    revive: (saved) => (Number.isInteger(saved) && (saved as number) >= 0 ? (saved as number) : null),
    stored: (value) => value,
  });
  const picked = answer < labels.length ? answer : 0;   // a bar that shrank falls back to the first tab, honestly
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const onKey = (e: KeyboardEvent) => {
    const next = tabAfterKey(picked, labels.length, e.key);
    if (next === picked) return;
    e.preventDefault();
    pick(next);
    buttons.current[next]?.focus();
  };
  return (
    <div className="hb-tabs">
      <div className="hb-tab-bar" role="tablist" onKeyDown={onKey}>
        {labels.map((label, i) => (
          <button key={i} type="button" role="tab" id={`${base}-tab-${i}`} aria-controls={`${base}-panel`}
            aria-selected={i === picked} tabIndex={i === picked ? 0 : -1}
            className={i === picked ? "hb-tab hb-tab-on" : "hb-tab"}
            ref={(el) => { buttons.current[i] = el; }} onClick={() => pick(i)}
            aria-label={badges[i] ? `${label}, ${badges[i]} open` : undefined}>
            <InlineText text={label} />
            {badges[i] ? <span className="hb-tab-badge" aria-hidden="true">{badges[i]}</span> : null}
          </button>
        ))}
      </div>
      <div className="hb-tab-panel hb-appear" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${picked}`} key={picked}>
        {panel(picked)}
      </div>
    </div>
  );
}
