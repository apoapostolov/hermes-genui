// What `::blocks{id="..."}` turns into inside a reply: a placeholder while the reply streams in, then the stored
// blocks fetched by id and drawn, or nothing at all when that isn't possible. Never raw JSON.
import { useContext, useEffect, useState } from "react";
import { Blocks } from "../core/Blocks";
import { readBlocks } from "../core/readBlocks";
import type { Block } from "../registry";
import { BlockActions } from "./actions";

const ID_PATTERN = /^[0-9a-f]{8}$/;

type State = { kind: "loading" } | { kind: "drawn"; blocks: Block[] } | { kind: "failed" };

/**
 * load fetches the stored JSON for an id (in the app: the plugin's REST route).
 *   streaming → "drawing…" (no fetch yet: the tag may still be arriving)
 *   id "zzz" → renders nothing (never fetched: a stray half-written tag must not leave a note in the reply)
 *   fetch fails, or nothing in it can be drawn → renders nothing
 * The blocks drawn get the app's actions (send, fill, rest) with this tag's id added, so a checklist saves its ticks
 * with this board.
 */
export function BlockTag({ id, streaming, load }: { id: string | undefined; streaming: boolean; load: (id: string) => Promise<unknown> }) {
  const validId = typeof id === "string" && ID_PATTERN.test(id);
  const actions = useContext(BlockActions);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (streaming || !validId) return;
    let live = true;
    load(id)
      .then((data) => {
        const blocks = readBlocks(data);
        if (live) setState(blocks.length ? { kind: "drawn", blocks } : { kind: "failed" });
      })
      .catch(() => {
        if (live) setState({ kind: "failed" });
      });
    return () => {
      live = false;
    };
  }, [id, streaming, validId]);

  if (!validId && !streaming) return null;
  if (streaming || state.kind === "loading") return <Note text="drawing…" pulse />;
  if (state.kind === "failed") return null;
  return <BlockActions.Provider value={{ ...actions, blockId: id }}><Blocks blocks={state.blocks} /></BlockActions.Provider>;
}

function Note({ text, pulse = false }: { text: string; pulse?: boolean }) {
  return <div className={pulse ? "hb-state hb-pulse" : "hb-state"}>{text}</div>;
}
