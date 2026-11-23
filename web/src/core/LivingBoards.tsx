// Living Boards — the words a live board says about itself under itself.
//
// The live row (LiveRow) belongs ONLY to the live view of an address (host/BlockTag.tsx): it names the board's
// address (#id), which version this is and when it was written, offers the handful of older versions the reader
// can reach back into (each fetched from the door by /blocks/{id}?version=N — retrieval, never a redraw), and
// carries the board's links: chips labelled with the AI's suggested connection, each opening the linked board
// fetched whole from the store (GET /blocks/{id}) and drawn connected below — reach-back across the conversation.
//
// The pointer note (LivePointer) is what EVERY LATER tag of the same address draws instead of a second board:
// one address, one live view (core/boardRoster.ts). It says where the live board is and shows the version the
// live view knows, so the conversation reads honestly: the board was updated, not duplicated.
//
// Nothing here moves or animates (the row is quiet chrome, and with no animation there is nothing to still for
// prefers-reduced-motion); the controls sit OUTSIDE .hb-blocks, so an unsaid board's DOM is untouched by them.
import { useContext, useEffect, useState } from "react";
import { BlockActions } from "../host/actions";
import { markLiving } from "../blocks/checklist/savedState";
import type { Block } from "../registry";
import * as boards from "./boardRoster";
import { Blocks } from "./Blocks";
import { readBlocksNoted, type BoardLink } from "./readBlocks";

/** The most older versions offered as buttons — a reach-back row, not a changelog. */
const HISTORY_SHOWN = 4;

/** The live view's own row: address, version, when, reach-back controls, links. Rendered by BlockTag only
 *  when the board speaks a living word (a version or links) — no word, no row, no DOM delta. */
export function LiveRow({ id, version, updatedAt, links, viewing, onShow, canReach }: {
  id: string; version?: number; updatedAt?: string; links?: BoardLink[];
  viewing: number | null; onShow: (v: number | null) => void; canReach: boolean;
}) {
  const older = version != null
    ? Array.from({ length: Math.min(version - 1, HISTORY_SHOWN) }, (_, i) => version - 1 - i)
    : [];
  return (
    <div className="hb-live" data-board={id}>
      <div className="hb-live-line">
        <span className="hb-live-mark" aria-hidden="true">↻</span>
        {version != null && (
          <span className="hb-live-version">{viewing === null ? `v${version}` : `viewing v${viewing}`}</span>
        )}
        {updatedAt && viewing === null && <span className="hb-live-when">{updatedAt.slice(0, 10)}</span>}
        <code className="hb-live-addr">#{id}</code>
        {canReach && older.map((n) => (
          <button key={n} type="button" className="hb-live-history" aria-pressed={viewing === n}
            onClick={() => onShow(viewing === n ? null : n)}>v{n} ↩</button>
        ))}
        {viewing !== null && (
          <button type="button" className="hb-live-back" onClick={() => onShow(null)}>current</button>
        )}
      </div>
      {!!links?.length && (
        <div className="hb-links">
          <span className="hb-links-label">linked across time · AI-suggested</span>
          {links.map((l) => <LinkChip key={l.id} link={l} />)}
        </div>
      )}
    </div>
  );
}

/** One link chip and, when opened, the linked board itself — fetched by address from the door. */
function LinkChip({ link }: { link: BoardLink }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hb-link">
      <button type="button" className="hb-link-chip" aria-expanded={open}
        title={link.note ? `${link.note} — board #${link.id}` : `board #${link.id}`}
        onClick={() => setOpen((o) => !o)}>
        {link.note ?? `#${link.id}`}
      </button>
      {open && <LinkedBoard link={link} />}
    </div>
  );
}

/** The reach-back panel: a prior board fetched whole from the store and drawn connected below its chip —
 *  the door's answer through the same reader, so the link shows the saved board's data, never a redraw.
 *  The blocks answer to the LINKED board's own id: ticks and state they save go to /blocks/<that id>/state,
 *  never into the linking board. A board that is not on this machine says so quietly — a broken link is
 *  never dressed up as a drawing. */
function LinkedBoard({ link }: { link: BoardLink }) {
  const actions = useContext(BlockActions);
  const rest = actions.rest;
  const [board, setBoard] = useState<Block[] | null | "loading">("loading");
  useEffect(() => {
    if (!rest) {
      setBoard(null);
      return;
    }
    let live = true;
    rest(`/blocks/${link.id}`)
      .then((data) => {
        const noted = readBlocksNoted(data);
        // a linked board that has taken updates files its answers by identity; say so before its blocks
        // mount, and they read and save the door the same way the live view does.
        if ((noted.version ?? 0) >= 2) markLiving(link.id);
        if (live) setBoard(noted.blocks.length ? noted.blocks : null);
      })
      .catch(() => {
        if (live) setBoard(null);
      });
    return () => {
      live = false;
    };
  }, [link.id, rest]);
  if (board === "loading") {
    return <div className="hb-linked hb-linked-loading">Fetching #{link.id} from the store…</div>;
  }
  if (!board) {
    return <div className="hb-linked hb-linked-gone">#{link.id} is not a board on this machine.</div>;
  }
  return (
    <div className="hb-linked" data-linked={link.id}>
      <div className="hb-linked-head">
        <span aria-hidden="true">◈</span>
        <span>{link.note ? link.note : "linked board"}</span>
        <code>#{link.id}</code>
      </div>
      <BlockActions.Provider value={{ ...actions, blockId: link.id }}>
        <Blocks blocks={board} />
      </BlockActions.Provider>
    </div>
  );
}

/** What a LATER tag of an already-live address draws: a quiet pointer to the one live view. */
export function LivePointer({ id, address }: { id: string; address: string }) {
  const meta = boards.getMeta(address);
  return (
    <div className="hb-tag hb-live-pointer" data-pointer={id}>
      <span className="hb-live-mark" aria-hidden="true">↻</span>
      <span>
        The same live board{meta.version ? ` · v${meta.version}` : ""} — its live view is where its first tag
        stands above.
      </span>
      <code className="hb-live-addr">#{id}</code>
    </div>
  );
}
