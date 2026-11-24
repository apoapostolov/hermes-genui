# Notes for the maintainer — locally built, independently reviewed increments

This branch carries one feature: **export**. A reader can take what a board drew out of the chat and into a
file — a chart as a PNG, a table as a CSV, the whole board as Markdown or JSON. The export is host chrome: a
family of deterministic view acts beside the board, like the ones the reply already has. It costs no model
turn and no request — not at export time, not at any time. The presentation stays AI-directed; the reader
gets a save, not a settings panel.

Built on `main` at `1617ba7` (Living Boards, #55) after the feature was developed and review-tested on the
local full stack (card `t_bff8178a`, three review rounds; round 3's blocking finding — the horizontal-bar
picture must MEASURE the live drawing, never re-derive formulas over it — is the contract now). Everything
below describes the increment as it stands on THIS base.

## export — a per-block affordance: chart PNG, table CSV, whole board Markdown or JSON

- The affordance (`web/src/host/ExportChrome.tsx`, `web/src/host/BlockTag.tsx`, `web/src/host/blockTag.css`):
  EVERY exportable block carries its own corner button — charts (the hand-drawn SVG kinds, the pie, and the
  DOM-drawn horizontal bars alike), tables, at any nesting the drawing shows. A parallel walk of the read
  block tree and the live DOM pairs each block's data with its drawn element (grid/row/column cells, section
  bodies, the ACTIVE tab panel by `aria-selected`); unmounted children — a closed accordion, an inactive tab
  — are not drawn and are not offered. The buttons live in a layer OUTSIDE `.hb-blocks`: the board's drawing
  stays byte-identical under every act (pinned in real Chrome), the one live view is never re-mounted, and
  any scroll or layout change re-pairs the corners (Mutation/Resize observers, capture-phase scroll). A
  Living Boards update or version reach-back re-pairs too, and the pairing never lags the READ: the walk's
  commit compares the block itself, not only the element and its rect, so a corner that sits over a table
  whose data was replaced in place exports the board on screen — never the version before it (pinned at the
  predicate in `web/src/host/ExportChrome.scan.test.tsx`, through the real door route in
  `BlockTag.living.test.tsx`, and in real Chrome).
  The chrome hangs on a `div.hb-tag` wrapper the `BlockTag` grows around the board and its living row — a new
  host element OUTSIDE `.hb-blocks`; the board's own DOM is exactly what it was.
- Keyboard first-class: every control is ALWAYS in the DOM and in the tab order — invisible at rest
  (`opacity: 0; pointer-events: none` — neither keeps focus away), revealed by the pointer (the `lit` class)
  or fully by any focus. Every control names itself in its `aria-label`; a keyboard reader Tabs to a block's
  export — including a table with no interactive descendants at all — and presses Enter without a mouse ever
  existing (pinned with real Tab presses in Chrome).
- The PNG (`web/src/lib/export.ts`): the SVG kinds serialize as self-contained drawings (computed paint
  inlined) and rasterize through `<img>` onto an offscreen canvas at a fixed 2×; the horizontal-bar picture
  is REBUILT BY MEASURING the live drawing — every bar, zero line and value word is emitted at the exact rect
  the browser laid out (relative to the drawing's own box, and the picture IS that box, so no row can print
  over another or leave the canvas), painted with the colours sampled from the elements themselves.
  (`web/src/blocks/chart/hbarLayout.ts` keeps the drawing's math in one place; the export does not recompute
  it — the real-Chrome regressions pin the emitted picture against the live rects, the downloaded pixels
  against the picture, multi-series included. No rasterizer dependency.) Under the picture: an OPAQUE
  backdrop — the block's own translucent card colours composited down to the nearest solid ground (a PNG
  whose alpha is 8 vanishes on a dark viewer surface; the raster's alpha is 255 everywhere, proven by
  decoding the download). Above the picture: the chart's own words (title, headline, legend, source) and,
  when the board speaks provenance, its one line (below).
- The CSV (`web/src/lib/csv.ts`, `web/src/lib/export.ts`): RFC 4180 — quote exactly when bare text could not
  hold the cell together, double inner quotes, CRLF records, UTF-8 BOM first. Provenance rides as a leading
  `#` comment record BEFORE the data block: comment-aware readers see exactly the stored headers and rows,
  byte readers see where the numbers came from; the comment-stripped round-trip through Python's `csv`
  reader is pinned. The table AS THE BOARD SAID IT is exported: for #41's structured tables the headers are
  the column labels, a number-family cell travels as its raw stored `value` (a spreadsheet computes on
  numbers, not on formatted words), and a sources column says exactly the labels the table itself joins. The
  reader's view — the filter box, the sort ticks, the paged window, the computed aggregates — is page state
  and arithmetic, never stored data, and is not exported.
- Provenance (`web/src/core/provenance.ts`): what a board's origins ARE, in one reading — its first top-level
  `source` line's own text and each chart's `spec.source`, once each, in draw order — so the CSV comment, the
  PNG caption line and the Markdown footer can never disagree with each other or with the board. A board
  that says nothing gets no provenance it did not have: no comment line, no footer, no caption line. On this
  base the reading moves NOTHING away from the drawing (a source block stays drawn where the board put it —
  absorbing it into a footer belongs to a separate, unmerged feature).
- The board files, with the door OFF — the mechanism is the contract: `GET /blocks/<id>` answers with the
  stored envelope itself beside its projection (`"stored"`, added in `dashboard/plugin_api.py`; the drawer
  ignores the key, and its reader reads the words it knows, as it always did), so nothing is fetched at
  export time. The JSON export is that envelope verbatim from the page's memory — unknown words and all —
  and on a Living Boards address it integrates with the version reach-back exactly: with `?version=N` the
  answer's `stored` IS that version's envelope, the very board being looked at; the file says which version
  it is because it IS the stored bytes. Markdown is written by the host-side TWIN of the chat serializer
  (`web/src/lib/markdown.ts` — a faithful port of `hooks/text_fallback.py` and every `text_<type>` renderer
  ON THIS BASE: caps, escapes, half-to-even number formats, nesting depth, flow-referencing steps, null-means
  unknown, the #30/#31/#32/#33/#34/#38/#40/#41 words, calendar/upnext/weather — uncapped, because a file is
  not one chat message; `blocks_as_text(..., limit=None)` pins the ask on the Python side). Parity is a
  corpus contract, not a hope: `tests/hooks/test_export_markdown_corpus.py` walks 53 boards through the REAL
  Python serializer into `web/src/lib/markdown.corpus.json`; `markdown.test.ts` demands the twin say the
  same bytes; the real-Chrome download is asserted equal to the Python uncapped output plus the provenance
  footer. The export route an early cut added was REMOVED and its absence pinned (`404`); every Chrome
  export test runs with the door torn off after the load — the page records `rest()` calls and the count
  stays at the one the load cost.
- What stands as before: every drawing on this base renders exactly as it did — the Living Boards live view,
  roster, reach-back row, ticks and identity carry are untouched; the interactive table's send seam, the
  chart hover card, and every `NO_SEND` guard stand: an export is bytes to a file, never a message.
  `describe()` and `tests/fixtures/describe.txt` are untouched: the feature adds no model-facing schema word
  at all.
- Deferred — deliberately: a whole-board raster PNG. A faithful one needs a DOM rasterizer, a dependency this
  PR must not carry; per-block PNG/CSV plus whole-board Markdown/JSON cover every supported block instead.
  Also left out because they belong to their own features, not this one: the source line the footer absorbs
  into a drawn provenance row, the expanded-dialog affordance (whose corner-in-dialog carrying left this port
  with it), and the tappable follow-up strip. Landing this branch on top of those offers is a four-file
  mechanical merge with one test-seam fix — verified conflicts and one tested recipe for each open seam are
  in the next section; nothing about the contract above changes in either order.

## Coexistence with the open offers — tested integration guidance (no upstream writes; throwaway branches)

Verified at revision time: upstream main `8038423`; #73 (interactive table) head `10aacfb` OPEN; #74
(follow-ups) head `c27fa6b` OPEN. `git merge-tree --write-tree` of this candidate against those heads says:

- **on top of #74** (this offer's gate): conflicts in `UPSTREAM.md` (add/add), `desktop/plugin.js`
  (generated), `tests/dashboard/test_plugin_api.py`, `web/src/host/BlockTag.tsx`.
- **on top of #73**: conflict in `desktop/plugin.js` alone (generated).

The resolution that passed everything, in order:

1. `web/src/host/BlockTag.tsx` — three hunks, all mechanical unions:
   the `State` drawn arm keeps BOTH new fields (`followUps?` from #74, `stored` from here) beside the
   `isEnvelopeCarrying`/`NO_BLOCKS` helpers; `commitDraw`'s `setState({ kind: "drawn", blocks, followUps:
   boardFollowUps, stored: envelope })`; the render keeps this PR's `div.hb-tag` wrapper and chrome
   (`menu` before, `layer` after) with #74's `<Blocks blocks={…} boardFollowUps={…} />` inside it. The two
   features are structurally orthogonal: the follow-up strip is the LAST child of `.hb-blocks` and the
   export corner pairs read blocks with children positionally, so blocks never shift.
2. `tests/dashboard/test_plugin_api.py` — keep both sides' added tests; relax #74's three whole-answer
   equalities (`== {"blocks": …, "follow_ups": …}`) to projection-key checks: this PR's `stored` word makes
   the answer a superset — no projection word changes, no behavior claim of #74 weakens.
3. `desktop/plugin.js` — NEVER hand-merge a generated file: after resolving sources, regenerate
   (`npm --prefix web run build`; esbuild is deterministic; two builds match byte-for-byte).
4. One-line test seam, needed on top of EITHER offer (both widened `Actions["send"]` to
   `(text, opts) => Promise<SendResult>`): in `web/src/host/ExportChrome.test.tsx`, type `drawnTag`'s
   `extra.send` as `Actions["send"]` and default it to `async () => "sent"`. Types only; no behavior.
5. `UPSTREAM.md` — prose, not mechanism: concatenate the two documents (or drop this file from the landing
   commit; it is PR-body material).

What was actually tested on the resolved trees (each: merge, resolve, rebuild bundle, full suites — nothing
pushed, branches deleted-able):

- export on #74: `tsc` clean, `vitest` 916/916, `pytest` 1288 passed / 1 skipped — including all 17 export
  real-Chrome cases and all 25 follow-up real-Chrome cases on the merged tree (branch `int/export-on-74`
  @ `603250b`, tree `cdf526ef`, bundle `9140725b…`).
- export on #74 + #73 together: same recipe plus the #73↔#74 seams — comment-wording unions in
  `actions.ts`/`actions.test.ts`/`plugin.tsx` about which sends are "user's own" (a tapped follow-up and a
  ticked table pick; #73↔#74 integration itself belongs to that offer's own recipe) — `tsc` clean,
  `vitest` 960/960, `pytest` 1315 passed / 1 skipped, both Chrome suites green on the combined tree
  (branch `int/export-on-7374` @ `31ff9bc`).
- export on #73 only: the predicted single generated-file conflict, resolved by rebuild alone — `tsc`
  clean, `vitest` 932/932, focused `pytest` 78 passed (export Chrome, table interactive width, dashboard
  API) (branch `int/export-on-73` @ `f08e9d87`).

Not tested (bounded honestly): GitHub's squash-merge UI (the recipe simulates merge commits), a live-host
install of any merged tree, and #72/#71 (expand, provenance-footer) seams — this PR carries none of their
machinery, and a provenance-footer landing would overlap the CSV comment/PNG caption wording, not the code.

## Evidence

- Web: `vitest` 878 passed, `tsc --noEmit` clean (upstream baseline plus this increment's suites).
- Python: `pytest` 1242 passed / 1 skipped (includes the 17 real-Chrome regression cases — the round-2
  living reach-back pair among them; they skip only on a machine without a Chrome binary or
  `web/node_modules`), `ruff` clean.
- The desktop bundle (`desktop/plugin.js`) was rebuilt twice with byte-identical output after a fresh
  `npm ci`; a third rebuild leaves `git status` clean.
