// Putting text in a chat's message box from anywhere. In a chat the box is there; on the Today page there is none,
// so a new chat is opened first and the text goes in once its box is ready. Returns whether the text landed, so a tap
// never fails silently.
export type OpenHost = {
  composer?: { insertText(sessionId: string | null, text: string, opts?: { mode?: "block" }): Promise<boolean>;
    focus(sessionId: string | null): void };
  navigate?: (path: string) => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tryInsert(host: OpenHost, text: string): Promise<boolean> {
  try {
    return Boolean(await host.composer?.insertText(null, text, { mode: "block" }));
  } catch {
    return false;
  }
}

export async function openAndFill(text: string, host: OpenHost,
  { waitMs = 2000, stepMs = 100 }: { waitMs?: number; stepMs?: number } = {}): Promise<boolean> {
  let landed = await tryInsert(host, text);
  if (!landed && host.navigate) {
    host.navigate("/");
    for (let waited = 0; !landed && waited < waitMs; waited += stepMs) {
      await sleep(stepMs);
      landed = await tryInsert(host, text);
    }
  }
  if (landed) host.composer?.focus(null);
  return landed;
}
