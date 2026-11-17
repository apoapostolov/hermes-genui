// actions: a short row of buttons, each sending a message as the user; button: one on its own.
import { actsBeforeTheModel, clean, firstList, firstText, https, keepFirst, NO_SEND, str, type Trail } from "../../core/fields";

export type ActionItem = { label: string; run: string };
export type ActionsBlock = { type: "actions"; name?: string; items: ActionItem[] };
export type ButtonBlock = { type: "button"; label: string; run?: string; url?: string };

const MAX_BUTTONS = 3;

/**
 * actions: up to 3 buttons that send a message. Items (also `buttons`): {label (also `text`), run (also `ask`,
 * `message`)}; a button without both a label and a message is dropped. `name` is the group's heading ("Next"): it is
 * not drawn, but it names the row of buttons for a screen reader.
 *   {type: "actions", name: "Next", buttons: [{text: "Weather", ask: "Goa weather this week"}, {label: "Empty"}]}
 *   → {type: "actions", name: "Next", items: [{label: "Weather", run: "Goa weather this week"}]}
 * Dropped: no list, or no usable button. A button whose message is a command or an @-reference
 * ({label: "Go", run: "/reset"}) is dropped with the note NO_SEND.
 */
export function readActions(raw: any, here: Trail): ActionsBlock | null {
  const list = firstList([raw.items, raw.buttons]);
  if (!list) return here.drop("actions needs items");
  const items: ActionItem[] = [];
  list.forEach((item: any, i) => {
    const label = firstText([item?.label, item?.text], 40);
    const run = firstText([item?.run, item?.ask, item?.message], 300);
    if (!label || !run) {
      here.at("items").at(i).drop("button needs a label and a run message");
      return;
    }
    if (actsBeforeTheModel(run)) {
      here.at("items").at(i).drop(NO_SEND);
      return;
    }
    items.push({ label, run });
  });
  if (!items.length) return here.drop("actions has no usable button");
  return clean({ type: "actions" as const, name: str(raw.name, 60), items: keepFirst(items, MAX_BUTTONS, here, "buttons") });
}

/**
 * button: one button. Label (also `text`); run sends a message (also `ask`, `message`), else url opens an https page.
 *   {type: "button", text: "Book", url: "https://x.example/book"} → {type: "button", label: "Book", url: "https://x.example/book"}
 * Dropped: no label, neither run nor an https url, or a run that is a command or an @-reference
 * ({label: "Go", run: "@file:notes.md"} → dropped, noted NO_SEND).
 */
export function readButton(raw: any, here: Trail): ButtonBlock | null {
  const label = firstText([raw.label, raw.text], 40);
  if (!label) return here.drop("button needs a label");
  const run = firstText([raw.run, raw.ask, raw.message], 300);
  const url = https(raw.url);
  if (!run && !url) return here.drop("button needs run or an https url");
  if (actsBeforeTheModel(run)) return here.drop(NO_SEND);
  return clean({ type: "button" as const, label, run, url });
}
