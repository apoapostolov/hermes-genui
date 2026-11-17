// Tabs: a bar of tab buttons above one panel. Only the picked tab's blocks are drawn; nothing is sent or saved.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
  const [picked, setPicked] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const onKey = (e: KeyboardEvent) => {
    const next = tabAfterKey(picked, labels.length, e.key);
    if (next === picked) return;
    e.preventDefault();
    setPicked(next);
    buttons.current[next]?.focus();
  };
  return (
    <div className="hb-tabs">
      <div className="hb-tab-bar" role="tablist" onKeyDown={onKey}>
        {labels.map((label, i) => (
          <button key={i} type="button" role="tab" id={`${base}-tab-${i}`} aria-controls={`${base}-panel`}
            aria-selected={i === picked} tabIndex={i === picked ? 0 : -1}
            className={i === picked ? "hb-tab hb-tab-on" : "hb-tab"}
            ref={(el) => { buttons.current[i] = el; }} onClick={() => setPicked(i)}
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
