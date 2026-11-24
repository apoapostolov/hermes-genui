// The selection tap against the REAL composer actions on a fake app composer — no send() mock anywhere.
// What must hold: every word the board says is the host's own answer, never an assumption. A pick posts to the
// chat (short or long — three phones rows are 122 characters) when submit says yes; text that reads like a
// command or a file reference is never submitted, and when the composer acknowledges holding it the board says
// BLOCKED plainly; a draft is claimed only after insertText resolves true — if it resolves false or rejects,
// the board says the text is nowhere and keeps the ticks so the tap can be retried. (Round 1's review caught
// the long path silently drafting; round 2's caught "In the composer" being claimed before the host agreed.
// These tests are the bar for both.)
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readBlocks } from "../../core/readBlocks";
import { Blocks } from "../../core/Blocks";
import { BlockActions, MAX_SENT, composerActions, type Composer } from "../../host/actions";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const phones = (extra: object = {}) => [
  {
    type: "table",
    caption: "Phones under ₹50k",
    columns: ["Phone", "Price", "Camera"],
    rows: [["Pixel 10a", "₹44,999", "Great"], ["Nothing 4", "₹39,999", "OK"], ["Galaxy A56", "₹42,999", "Fine"]],
    ...extra,
  },
];
const pickTwo = "Phones under ₹50k:\nPhone | Price | Camera\nPixel 10a | ₹44,999 | Great\nGalaxy A56 | ₹42,999 | Fine";
// the message lists picked rows in board order (indices ascending), whatever the ticking order was
const pickAll = "Phones under ₹50k:\nPhone | Price | Camera\nPixel 10a | ₹44,999 | Great\nNothing 4 | ₹39,999 | OK\nGalaxy A56 | ₹42,999 | Fine";

type Insert = boolean | "rejects";

function fakeComposer(takes = true, inserts: Insert = true) {
  return {
    submit: vi.fn((_session: string | null, _text: string) => takes),
    insertText: vi.fn(async () => {
      if (inserts === "rejects") throw new Error("no mounted surface answered");
      return inserts;
    }),
    focus: vi.fn(),
  };
}

/** The board wired exactly as the app wires it: BlockActions from the real composerActions, no send mock. */
function drawReal(board: unknown[], composer: Composer | undefined) {
  const actions = composerActions(composer);
  return render(
    <BlockActions.Provider value={{ send: actions.send, fill: actions.fill }}>
      <Blocks blocks={readBlocks(board)} />
    </BlockActions.Provider>,
  );
}

const pill = () => screen.getByRole("button", { name: "Send selected rows as context" });
const said = () => screen.getByRole("status").textContent;
const tick = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name: `Select row ${name}` }));
const isTicked = (name: string) =>
  (screen.getByRole("checkbox", { name: `Select row ${name}` }) as HTMLInputElement).checked;
/** One tap, settled: the word can only appear once the host has answered, so let the microtasks run first. */
const tap = async () => { await act(async () => { fireEvent.click(pill()); }); };

describe("one tap posts the picked rows to the chat — on the real seam", () => {
  it("a short pick is submitted whole; nothing reaches the composer", async () => {
    const composer = fakeComposer();
    drawReal(phones({ interactive: true }), composer);
    tick("Pixel 10a");
    tick("Galaxy A56");
    await tap();
    expect(composer.submit).toHaveBeenCalledTimes(1);
    expect(composer.submit.mock.calls[0][1]).toBe(pickTwo);
    expect(pickTwo.length).toBeLessThanOrEqual(MAX_SENT);
    expect(composer.insertText).not.toHaveBeenCalled();
    expect(said()).toBe("Sent to chat.");
  });

  it("the ordinary three-row pick — 122 characters, past MAX_SENT — is submitted too, not drafted", async () => {
    const composer = fakeComposer();
    drawReal(phones({ interactive: true }), composer);
    for (const name of ["Pixel 10a", "Nothing 4", "Galaxy A56"]) tick(name);
    await tap();
    expect(composer.submit.mock.calls[0][1]).toBe(pickAll);
    expect(pickAll.length).toBeGreaterThan(MAX_SENT); // the review's case: three phones rows = 122 chars
    expect(composer.insertText).not.toHaveBeenCalled(); // the first cut drafted here instead of posting
    expect(said()).toBe("Sent to chat.");
  });

  it("a pick carrying a file reference is never submitted: the composer ACKS holding it, and the board says blocked", async () => {
    const composer = fakeComposer();
    drawReal(
      phones({ interactive: true, rows: [["Pixel 10a", "@file:notes.md", "Great"], ["Nothing 4", "₹39,999", "OK"]] }),
      composer,
    );
    tick("Pixel 10a");
    await tap();
    expect(composer.submit).not.toHaveBeenCalled();
    expect(composer.insertText).toHaveBeenCalledWith(
      null, "Phones under ₹50k:\nPhone | Price | Camera\nPixel 10a | @file:notes.md | Great", { mode: "block" });
    expect(composer.focus).toHaveBeenCalledWith(null);
    expect(said()).toBe("Blocked from sending — in the composer — press Send.");
  });

  it("a pick whose board starts like a command is never submitted either, and is named as blocked", async () => {
    const composer = fakeComposer();
    drawReal([{ ...phones({ interactive: true })[0], caption: "/etc updates" }], composer);
    tick("Pixel 10a");
    await tap();
    expect(composer.submit).not.toHaveBeenCalled();
    expect(said()).toBe("Blocked from sending — in the composer — press Send.");
  });

  it("when the host refuses the submit but ACKS the draft, the text is kept — and said out loud", async () => {
    const composer = fakeComposer(false);
    drawReal(phones({ interactive: true }), composer);
    tick("Pixel 10a");
    await tap();
    expect(composer.submit).toHaveBeenCalledTimes(1);
    expect(composer.insertText).toHaveBeenCalledWith(null, expect.stringContaining("Pixel 10a"), { mode: "block" });
    expect(composer.focus).toHaveBeenCalledWith(null);
    expect(said()).toBe("In the composer — press Send.");
  });

  it("a draft the surface REFUSED (insertText resolves false) says failed — no caret, ticks kept for a retry", async () => {
    const composer = fakeComposer(false, false);
    drawReal(phones({ interactive: true }), composer);
    tick("Pixel 10a");
    tick("Galaxy A56");
    await tap();
    expect(composer.submit).toHaveBeenCalledTimes(1);
    expect(composer.insertText).toHaveBeenCalledTimes(1);
    expect(composer.focus).not.toHaveBeenCalled(); // nothing was inserted: the caret does not pretend
    expect(said()).toBe("Send failed — nothing was sent or kept.");
    expect(isTicked("Pixel 10a")).toBe(true); // the selection is kept: the tap can be retried
    expect(isTicked("Galaxy A56")).toBe(true);
    expect(pill().hasAttribute("disabled")).toBe(false);
  });

  it("a draft whose insert REJECTS says failed too — handled, never an uncaught rejection, ticks kept", async () => {
    const composer = fakeComposer(false, "rejects");
    drawReal(phones({ interactive: true }), composer);
    tick("Pixel 10a");
    await tap();
    expect(said()).toBe("Send failed — nothing was sent or kept.");
    expect(composer.focus).not.toHaveBeenCalled();
    expect(isTicked("Pixel 10a")).toBe(true);
  });

  it("even a guarded pick whose draft the surface refused says failed — a hold that saved nothing is not a draft", async () => {
    const composer = fakeComposer(true, false);
    drawReal(
      phones({ interactive: true, rows: [["Pixel 10a", "@file:notes.md", "Great"], ["Nothing 4", "₹39,999", "OK"]] }),
      composer,
    );
    tick("Pixel 10a");
    await tap();
    expect(composer.submit).not.toHaveBeenCalled(); // the guard still holds
    expect(said()).toBe("Send failed — nothing was sent or kept.");
    expect(isTicked("Pixel 10a")).toBe(true);
  });

  it("with no app around the tap does nothing, throws nothing, and admits there is no chat here", async () => {
    drawReal(phones({ interactive: true }), undefined);
    tick("Pixel 10a");
    expect(() => fireEvent.click(pill())).not.toThrow(); // the send itself must not reject either
    await tap();
    expect(said()).toBe("No chat here.");
  });

  it("a slow first answer cannot mislabel a newer tap: the word is the LAST tap's truth", async () => {
    // tap 1's insert acknowledges LATE with true; tap 2's insert refuses immediately. Without a guard the late
    // "In the composer" would overwrite the newer honest "Send failed" — which is exactly the false success again.
    let releaseFirst: (ok: boolean) => void = () => {};
    let calls = 0;
    const composer: Composer = {
      submit: vi.fn(() => false),
      insertText: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            calls += 1;
            if (calls === 1) releaseFirst = resolve;
            else resolve(false);
          }),
      ),
      focus: vi.fn(),
    };
    drawReal(phones({ interactive: true }), composer);
    tick("Pixel 10a");
    fireEvent.click(pill()); // tap 1: still in flight — no word claimed yet
    expect(said()).toBe("");
    await tap(); // tap 2: refused insert lands first
    expect(said()).toBe("Send failed — nothing was sent or kept.");
    await act(async () => { releaseFirst(true); }); // the stale ack arrives late
    expect(said()).toBe("Send failed — nothing was sent or kept."); // and is ignored: it was not the last tap
  });

  it("the word clears when the pick changes again, and a second tap posts afresh", async () => {
    const composer = fakeComposer();
    drawReal(phones({ interactive: true }), composer);
    for (const name of ["Pixel 10a", "Nothing 4", "Galaxy A56"]) tick(name);
    await tap();
    expect(said()).toBe("Sent to chat.");
    tick("Nothing 4"); // untick: the stale word goes, and the next pick is a fresh message
    expect(said()).toBe("");
    await tap();
    expect(composer.submit).toHaveBeenCalledTimes(2);
    expect(composer.submit.mock.calls[1][1]).toBe(pickTwo);
    expect(said()).toBe("Sent to chat.");
  });

  it("the word is ANNOUNCED, not just drawn: the status region is a polite live region", async () => {
    // Review round 3: the feedback must stay readable AND reachable — role=status carries the
    // announcement; the explicit aria-live pins it so no restyle or refactor can quietly drop it.
    const composer = fakeComposer();
    drawReal(phones({ interactive: true }), composer);
    tick("Pixel 10a");
    await tap();
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("Sent to chat.");
  });

  it("a static table grows no status line at all", () => {
    const composer = fakeComposer();
    drawReal(phones(), composer);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
