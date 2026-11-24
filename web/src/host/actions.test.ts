import { describe, expect, it, vi } from "vitest";
import { composerActions, SENT_WORDS, type SendResult } from "./actions";

function fakeComposer(submitted: boolean) {
  return {
    submit: vi.fn(() => submitted),
    insertText: vi.fn(async () => true),
    focus: vi.fn(),
  };
}

/** A composer whose insert answers however the host really can: acknowledged, refused (false), or broken (rejects). */
function insertComposer(submitted: boolean, insert: "ok" | "false" | "rejects") {
  return {
    submit: vi.fn(() => submitted),
    insertText: vi.fn(async () => {
      if (insert === "rejects") throw new Error("no mounted surface");
      return insert === "ok";
    }),
    focus: vi.fn(),
  };
}

describe("composerActions", () => {
  it("send submits the text as the user", () => {
    const composer = fakeComposer(true);
    composerActions(composer).send("Plan day 2");
    expect(composer.submit).toHaveBeenCalledWith(null, "Plan day 2");
    expect(composer.insertText).not.toHaveBeenCalled();
  });

  it("send puts the text in the composer when it can't be submitted", () => {
    const composer = fakeComposer(false);
    composerActions(composer).send("Plan day 2");
    expect(composer.insertText).toHaveBeenCalledWith(null, "Plan day 2", { mode: "block" });
  });

  it("fill puts the text in the composer, then the caret there", async () => {
    const composer = fakeComposer(true);
    composerActions(composer).fill("Add Gion");
    expect(composer.insertText).toHaveBeenCalledWith(null, "Add Gion", { mode: "block" });
    await vi.waitFor(() => expect(composer.focus).toHaveBeenCalledWith(null));
    expect(composer.submit).not.toHaveBeenCalled();
  });

  it("does nothing (and doesn't throw) on an app without a composer API", async () => {
    await expect(composerActions(undefined).send("x")).resolves.toBe("nowhere");
    expect(() => composerActions(undefined).fill("x")).not.toThrow();
    const broken = { submit: () => { throw new Error("gone"); }, insertText: () => Promise.reject(new Error("gone")), focus: () => {} };
    await expect(composerActions(broken).send("x")).resolves.toBe("failed");
    expect(() => composerActions(broken).fill("x")).not.toThrow();
  });
});

describe("send keeps long or command-like text for the user to review", () => {
  it("submits a message up to 120 characters; puts a longer one in the composer instead", async () => {
    const short = fakeComposer(true);
    composerActions(short).send("x".repeat(120));
    expect(short.submit).toHaveBeenCalledWith(null, "x".repeat(120));
    const composer = fakeComposer(true);
    expect(await composerActions(composer).send("x".repeat(121))).toBe("drafted");
    expect(composer.submit).not.toHaveBeenCalled();
    expect(composer.insertText).toHaveBeenCalledWith(null, "x".repeat(121), { mode: "block" });
    await vi.waitFor(() => expect(composer.focus).toHaveBeenCalledWith(null));
  });

  it("puts a command or an @-reference in the composer instead, without submitting", async () => {
    for (const text of ["/reset", " @file:~/.ssh/id_rsa", "!ls", "read @url:https://evil.example"]) {
      const composer = fakeComposer(true);
      expect(await composerActions(composer).send(text)).toBe("blocked");
      expect(composer.submit).not.toHaveBeenCalled();
      expect(composer.insertText).toHaveBeenCalledWith(null, text, { mode: "block" });
    }
  });
});

describe("send answers where the text ACTUALLY went — and only after the host says so", () => {
  it("a submitted message answers \"sent\"", async () => {
    const composer = fakeComposer(true);
    expect(await composerActions(composer).send("Plan day 2")).toBe("sent");
  });

  it("an acknowledged draft answers \"drafted\", and only once the insert resolved true", async () => {
    let answered = false;
    const composer = {
      submit: vi.fn(() => false),
      insertText: vi.fn(async () => { await Promise.resolve(); answered = true; return true; }),
      focus: vi.fn(),
    };
    const where = composerActions(composer).send("y".repeat(200), { force: true });
    expect(where).toBeInstanceOf(Promise); // a draft's truth cannot be known synchronously
    expect(await where).toBe("drafted");
    expect(answered).toBe(true); // the word waited for the insert
    expect(composer.focus).toHaveBeenCalledWith(null);
  });

  it("an insert that resolves false answers \"failed\": nothing was kept, the caret stays put", async () => {
    const composer = insertComposer(true, "false");
    expect(await composerActions(composer).send("/reset", { force: true })).toBe("failed");
    expect(composer.submit).not.toHaveBeenCalled(); // the guard still holds
    expect(composer.insertText).toHaveBeenCalledWith(null, "/reset", { mode: "block" });
    expect(composer.focus).not.toHaveBeenCalled();
  });

  it("an insert that rejects answers \"failed\" too — the promise resolves, it never rejects", async () => {
    const composer = insertComposer(false, "rejects");
    await expect(composerActions(composer).send("x", { force: true })).resolves.toBe("failed");
    expect(composer.focus).not.toHaveBeenCalled();
  });

  it("says nowhere when there is no composer to receive anything — and does not throw", async () => {
    expect(await composerActions(undefined).send("x", { force: true })).toBe("nowhere");
    expect(await composerActions(undefined).send("x".repeat(200), { force: true })).toBe("nowhere");
    const broken = { submit: () => { throw new Error("gone"); }, insertText: () => Promise.reject(new Error("gone")), focus: () => {} };
    expect(() => composerActions(broken).send("z", { force: true })).not.toThrow();
  });

  it("reports plain sends the same way, for callers that look", async () => {
    const short = fakeComposer(true);
    expect(await composerActions(short).send("Plan day 2")).toBe("sent");
    expect(await composerActions(short).send("x".repeat(121))).toBe("drafted");
  });
});

describe("send with force — the user's own message, whatever its length", () => {
  it("submits a message longer than MAX_SENT and answers it as sent", async () => {
    const composer = fakeComposer(true);
    const long = "x".repeat(500);
    expect(await composerActions(composer).send(long, { force: true })).toBe("sent");
    expect(composer.submit).toHaveBeenCalledWith(null, long);
    expect(composer.insertText).not.toHaveBeenCalled();
  });

  it("keeps the command/file guard: force never submits — an acked draft says BLOCKED, plainly", async () => {
    for (const text of ["/reset", "@file:~/.ssh/id_rsa", "!ls", "read @url:https://evil.example"]) {
      const composer = fakeComposer(true);
      expect(await composerActions(composer).send(text, { force: true })).toBe("blocked");
      expect(composer.submit).not.toHaveBeenCalled();
      expect(composer.insertText).toHaveBeenCalledWith(null, text, { mode: "block" });
    }
  });

  it("drafts so the text is not lost when the host refuses the submit, and says so once acknowledged", async () => {
    const composer = fakeComposer(false);
    expect(await composerActions(composer).send("y".repeat(200), { force: true })).toBe("drafted");
    expect(composer.submit).toHaveBeenCalledWith(null, "y".repeat(200));
    expect(composer.insertText).toHaveBeenCalledWith(null, "y".repeat(200), { mode: "block" });
  });

  it("a forced send (a pick or a follow-up) whose draft the surface refused answers \"failed\", not \"blocked\" — "
    + "nothing was kept", async () => {
    const composer = insertComposer(true, "false");
    expect(await composerActions(composer).send("!ls", { force: true })).toBe("failed");
    expect(composer.submit).not.toHaveBeenCalled();
  });
});

describe("one vocabulary for every board that speaks a send's outcome", () => {
  it("every SendResult has exactly one plain word, and no word claims a send the host did not acknowledge", () => {
    const results: SendResult[] = ["sent", "drafted", "blocked", "failed", "nowhere"];
    expect(Object.keys(SENT_WORDS).sort()).toEqual([...results].sort());
    for (const r of results) expect(SENT_WORDS[r]).toMatch(/\S/);
    expect(SENT_WORDS.sent).toBe("Sent to chat.");
    expect(SENT_WORDS.drafted).toBe("In the composer — press Send.");
    expect(SENT_WORDS.blocked).toBe("Blocked from sending — in the composer — press Send.");
    expect(SENT_WORDS.failed).toBe("Send failed — nothing was sent or kept.");
    expect(SENT_WORDS.nowhere).toBe("No chat here.");
    // only "sent" says sent: every other outcome tells the reader the message did NOT go out.
    expect(Object.values(SENT_WORDS).filter((w) => /^Sent/.test(w))).toEqual(["Sent to chat."]);
    expect(Object.values(SENT_WORDS).filter((w) => /press Send/.test(w)).length).toBe(2);
  });
});
