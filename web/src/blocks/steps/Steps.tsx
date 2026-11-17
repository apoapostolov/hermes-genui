// A walkthrough: one step at a time, with its place ("2 of 6"), a dot per step and Back / Next (← and → work while
// focus is inside it). When the block names a flow on the same board, it tells that flow which step it shows, and
// the flow lights the step's box and makes the step's changes (chips, packet, tick).
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { InlineText } from "../../lib/InlineText";
import { useSetWalk } from "../flow/highlight";
import { useNamed } from "../../core/a11y";
import type { StepsBlock } from "./read";

export function Steps({ title, for: flow, items }: StepsBlock) {
  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());
  const setWalk = useSetWalk();
  const named = useNamed("steps", title);
  const before = useRef<number | null>(null);
  const step = items[at];
  const go = (to: number) => setAt(Math.max(0, Math.min(items.length - 1, to)));

  // Tell the flow which step is shown and which was before, and take the walk away when the block goes.
  useEffect(() => {
    if (flow !== undefined) setWalk(flow, { steps: items, at, from: before.current });
    before.current = at;
  }, [flow, items, at, setWalk]);
  useEffect(() => () => {
    if (flow !== undefined) setWalk(flow, undefined);
  }, [flow, setWalk]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowRight") go(at + 1);
    else if (e.key === "ArrowLeft") go(at - 1);
    else return;
    e.preventDefault();
  }

  const photo = step.image && !failed.has(at) ? step.image : undefined;
  return (
    <div className="hb-card hb-steps" role="group" {...named.root} onKeyDown={onKeyDown}>
      <div className="hb-steps-head">
        {title && <div id={named.title.id} className="hb-card-title">{title}</div>}
        <span className="hb-steps-place">{`${at + 1} of ${items.length}`}</span>
      </div>
      <div className="hb-steps-body" aria-live="polite">
        <div className="hb-steps-title">{step.title}</div>
        {step.text && <p className="hb-steps-text"><InlineText text={step.text} /></p>}
        {photo && (
          <img key={at} className="hb-steps-photo" src={photo} alt="" loading="lazy" referrerPolicy="no-referrer"
            onError={() => setFailed((was) => new Set(was).add(at))} />
        )}
      </div>
      <div className="hb-steps-foot">
        <div className="hb-steps-dots">
          {items.map((s, i) => (
            <button key={i} type="button" className={i === at ? "hb-steps-dot hb-steps-dot-on" : "hb-steps-dot"}
              aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === at ? "step" : undefined} onClick={() => go(i)} />
          ))}
        </div>
        <div className="hb-steps-moves">
          <button type="button" className="hb-pill" disabled={at === 0} onClick={() => go(at - 1)}>Back</button>
          <button type="button" className="hb-pill hb-pill-solid" disabled={at === items.length - 1} onClick={() => go(at + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
