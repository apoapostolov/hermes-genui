// A test helper: draws stored blocks with the app's actions stubbed, so a test can check what a tap sends or fills.
// send answers like the real seam — a promise — because blocks that report where a send went await the host's word.
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { BlockActions, type Actions, type SendResult } from "../host/actions";
import { Blocks } from "./Blocks";
import { readBlocks } from "./readBlocks";

export function drawWithActions(blocks: unknown[], actions: Partial<Actions> = {}) {
  const value: Actions = { send: vi.fn(async (): Promise<SendResult> => "sent"), fill: vi.fn(), ...actions };
  const view = render(<BlockActions.Provider value={value}><Blocks blocks={readBlocks(blocks)} /></BlockActions.Provider>);
  return { ...view, send: value.send as ReturnType<typeof vi.fn>, fill: value.fill as ReturnType<typeof vi.fn> };
}

/** Puts stylesheets on the test page, so a test can check computed styles; returns a function that takes them off.
 *  Import each sheet with "?raw" (vitest reads it as text), in the order styles/index.ts joins them:
 *  withStyles(tokens, layout, chart) */
export function withStyles(...sheets: string[]): () => void {
  const style = document.createElement("style");
  style.textContent = sheets.join("\n");
  document.head.appendChild(style);
  return () => style.remove();
}
