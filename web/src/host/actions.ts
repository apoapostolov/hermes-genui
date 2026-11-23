// What blocks in a reply can do in the app: send a message as the user, put text in the composer for them to send, and
// reach the plugin's backend for the board they belong to (a checklist's saved ticks).
import { createContext } from "react";
import { actsBeforeTheModel } from "../core/fields";

export type Rest = (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;

export type Actions = {
  /** Sends the text as the user's next message. */
  send(text: string): void;
  /** Puts the text in the composer for the user to edit and send. */
  fill(text: string): void;
  /** The id of the stored board these blocks were drawn from ("7f3a09bc"); absent outside a `::blocks` tag. */
  blockId?: string;
  /** The conversation this board is drawn in (the host's sessionId, when the carrier knows it). Living
   *  boards' one-live-view-per-address rule is scoped to it: an address is THE CHAT's visual memory, and
   *  two conversations open on one page (or a session switch mid-mount) never pointer each other. */
  sessionScope?: string;
  /** The plugin's REST door (ctx.rest); absent in tests and previews, where nothing is saved. */
  rest?: Rest;
};

// With no app around the blocks (tests, a preview), a tap does nothing rather than throwing.
export const BlockActions = createContext<Actions>({ send: () => {}, fill: () => {} });

/** The slice of the SDK's host.composer these actions use. */
export type Composer = {
  submit(sessionId: string | null, text: string): boolean;
  insertText(sessionId: string | null, text: string, opts?: { mode?: "block" | "inline" | "prefix" }): Promise<boolean>;
  focus(sessionId: string | null): void;
};

// The longest message a tap sends at once. A longer one is put in the composer for the user to read and send.
export const MAX_SENT = 120;

/**
 * send and fill on the composer the user is typing in (sessionId null). Every call is guarded: an app build without
 * the composer API, or a composer that throws, leaves the reply as it was.
 *   send("Plan day 2"): submitted → done;  submit says false (no live composer took it) → the text is put in the
 *   composer instead, so it isn't lost
 *   send(a 121-character message) or send("/reset") or send("read @file:x") → not submitted: filled instead, so the
 *   user sees it and decides (the block readers drop such buttons already; this is the last guard)
 *   fill("Add Gion"): the text is put in the composer as its own block, then the caret goes there
 */
export function composerActions(composer: Composer | undefined): Pick<Actions, "send" | "fill"> {
  const insert = async (text: string) => {
    await composer?.insertText(null, text, { mode: "block" });
  };
  const fill = (text: string) => {
    insert(text).then(() => composer?.focus(null)).catch(() => {});
  };
  return {
    send(text) {
      if (text.length > MAX_SENT || actsBeforeTheModel(text)) {
        fill(text);
        return;
      }
      try {
        if (composer?.submit(null, text)) return;
        insert(text).catch(() => {});
      } catch {
        insert(text).catch(() => {});
      }
    },
    fill,
  };
}
