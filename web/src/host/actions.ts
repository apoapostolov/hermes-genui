// What blocks in a reply can do in the app: send a message as the user, put text in the composer for them to send, and
// reach the plugin's backend for the board they belong to (a checklist's saved ticks).
import { createContext } from "react";
import { actsBeforeTheModel } from "../core/fields";

export type Rest = (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;

/** Where a send actually went. Every answer except "nowhere" is the host's own:
 *  "sent" — submit returned true, the chat has the message; "drafted" — insertText acknowledged (resolved true)
 *  a text the length convention held back, or one a refused submit fell back to; "blocked" — the same
 *  acknowledged draft, but an explicit send the command/file guard held back — the user hears the real reason;
 *  "failed" — the host acknowledged nothing: insertText resolved false (no mounted surface took it) or rejected,
 *  so the text landed nowhere and the tap should offer a retry rather than a lie;
 *  "nowhere" — no app around (tests, a preview), so the tap did nothing. */
export type SendResult = "sent" | "drafted" | "blocked" | "failed" | "nowhere";

export type SendOptions = {
  /** The text IS the user's own message — a follow-up they tapped with its whole message already shown on the
   *  pill (title and all). Length no longer holds it back; the command/file guard still does, because that one
   *  is about trust, not about who typed it. */
  force?: boolean;
};

export type Actions = {
  /** Sends the text as the user's next message. Resolves once the host has said where it actually went (see
   *  SendResult) — never with a claim the host has not acknowledged, and never as a rejected promise. */
  send(text: string, opts?: SendOptions): Promise<SendResult>;
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
export const BlockActions = createContext<Actions>({ send: async () => "nowhere", fill: () => {} });

/** The slice of the SDK's host.composer these actions use. */
export type Composer = {
  submit(sessionId: string | null, text: string): boolean;
  insertText(sessionId: string | null, text: string, opts?: { mode?: "block" | "inline" | "prefix" }): Promise<boolean>;
  focus(sessionId: string | null): void;
};

// The longest message a tap sends at once. A longer one is put in the composer for the user to read and send.
// A send the user composed themselves (a follow-up tapped from a board's strip) says so with force and may be any length.
export const MAX_SENT = 120;

// Where the last tap went, told plainly — and only once the host has said so. A word never claims more than the
// host acknowledged: no draft without an ack, no send without a yes, and a refusal that saved nothing says so.
// Every board that speaks a send's outcome says it with these words — the follow-up strip under a board today,
// and any future one — one answer, one vocabulary.
export const SENT_WORDS: Record<SendResult, string> = {
  sent: "Sent to chat.",
  drafted: "In the composer — press Send.",
  blocked: "Blocked from sending — in the composer — press Send.",
  failed: "Send failed — nothing was sent or kept.",
  nowhere: "No chat here.",
};

/**
 * send and fill on the composer the user is typing in (sessionId null). Every call is guarded: an app build without
 * the composer API, or a composer that throws, leaves the reply as it was. Where the text went is only ever
 * answered after the host has said it: submit is sync, but insertText is a promise that can resolve false (no
 * mounted surface took the text) or reject (the call died) — neither is a draft, and the send says so.
 *   send("Plan day 2"): submit says true → "sent"; false (no live composer took it) → drafted and the insert
 *   acknowledges → "drafted"; the insert refuses or dies → "failed" — nothing was sent and nothing was kept
 *   send(a 121-character message) or send("/reset") or send("read @file:x") → not submitted: drafted, so the
 *   user sees it and decides — "drafted" once the insert acknowledges (or "blocked", when the guard rather than
 *   mere length held an explicit send back), and "failed" if the insert was refused: the text is nowhere (the
 *   block readers drop such buttons already; this is the last guard)
 *   send(a tapped follow-up, { force: true }): length does not hold it back — the board offered this whole
 *   message and the pill showed it in full — but command and file text is still only drafted, and it answers
 *   "blocked" once the composer acknowledges the hold; a refused submit falls back to a draft the same way;
 *   nothing is ever claimed before the host agrees
 *   fill("Add Gion"): the text is put in the composer as its own block, then the caret goes there
 */
export function composerActions(composer: Composer | undefined): Pick<Actions, "send" | "fill"> {
  const insert = async (text: string) => {
    await composer?.insertText(null, text, { mode: "block" });
  };
  const fill = (text: string) => {
    insert(text).then(() => composer?.focus(null)).catch(() => {});
  };
  // Put the text in the composer and answer only what the host acknowledged: true means the surface took it
  // (the caret may follow); false or a rejection means the text is nowhere, and no word may claim otherwise.
  const draft = async (text: string): Promise<boolean> => {
    let taken = false;
    try {
      taken = (await composer?.insertText(null, text, { mode: "block" })) === true;
    } catch {
      taken = false; // the surface rejected the call: nothing was inserted
    }
    if (taken) composer?.focus(null);
    return taken;
  };
  return {
    async send(text, opts) {
      if (!composer) return "nowhere";
      const guarded = actsBeforeTheModel(text);
      if (guarded || (!opts?.force && text.length > MAX_SENT)) {
        return (await draft(text)) ? (guarded ? "blocked" : "drafted") : "failed";
      }
      try {
        if (composer.submit(null, text)) return "sent";
      } catch {
        // the composer went away mid-tap: the draft below tries to keep the text, and reports honestly
      }
      return (await draft(text)) ? "drafted" : "failed";
    },
    fill,
  };
}
