// Buttons that act for the user: a row of up to three (actions) or one on its own (button). A tap sends the button's
// message as the user's (hovering shows it exactly, as the title); a button with a url instead opens that page.
import { useContext } from "react";
import { BlockActions } from "../../host/actions";
import type { ActionItem, ButtonBlock } from "./read";
import { Icon } from "../../lib/Icon";
import { useNamed } from "../../core/a11y";

/** A row of up to three buttons, named by the model's group `name` when it gives one and by what it is when it
 *  doesn't ("Actions"). */
export function Actions({ items, name }: { items: ActionItem[]; name?: string }) {
  const { send } = useContext(BlockActions);
  const named = useNamed("actions", undefined, [name]);
  return (
    <div className="hb-actions" role="group" {...named.root}>
      {items.map((a, i) => (
        <button key={i} type="button" className="hb-pill" title={a.run} onClick={() => send(a.run)}>
          <Icon name="spark" size={14} stroke={2.2} />{a.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ label, run, url }: ButtonBlock) {
  const { send } = useContext(BlockActions);
  if (run) {
    return (
      <div className="hb-actions">
        <button type="button" className="hb-pill" title={run} onClick={() => send(run)}><Icon name="spark" size={14} stroke={2.2} />{label}</button>
      </div>
    );
  }
  return (
    <div className="hb-actions">
      <a className="hb-pill" href={url} target="_blank" rel="noreferrer"><Icon name="globe" size={14} stroke={2.2} />{label}</a>
    </div>
  );
}
