# UPSTREAM — follow-ups: `follow_ups` — a quiet strip of tappable continuations under the board (a model word)

Proposed as a small focused PR onto `main` @ `1617ba7e` (#55 Living Boards; the only drift to today's tip,
`8038423`, is the `.gitattributes` LF chore #69 — tree-identical otherwise). 25 files: the envelope word's
write path (`blocks/common.py`, `tools/show_blocks.py`), its store/serve path (`core/store.py`,
`dashboard/plugin_api.py`), the web read (`web/src/core/readBlocks.ts`), the drawing
(`web/src/core/FollowUps.tsx` new, `core/Blocks.tsx`, `host/BlockTag.tsx`, `styles/tokens.css`), the seam
growth the feature needs to ship whole (`host/actions.ts`, `plugin.tsx`, `live/register.tsx`,
`live/DashboardView.tsx`), the regressions (`tests/tools/test_show_blocks.py`, `tests/core/test_store.py`,
`tests/dashboard/test_plugin_api.py`, `web/src/core/readBlocks.test.ts`, `web/src/host/actions.test.ts`,
`web/src/core/followUps.test.tsx` new, `tests/test_follow_ups_chrome.py` new, plus test-side stub updates in
`web/src/core/testing.tsx`, `web/src/live/register.test.ts`, `web/src/host/BlockTag.living.test.tsx`), and
the rebuilt `desktop/plugin.js`. No new dependency, no network, no host/app change, no change to any
existing block type.

## What & why

Let the AI attach a quiet strip of one to four suggested follow-up prompts beneath a board, so the reader
can continue the conversation in one tap — and hear, from the host's own answer, where the prompt went.
The presentation is AI-directed: the reader gets no controls, and the board that says nothing draws exactly
what it drew before, byte for byte. It is a model word: a board whose envelope says `follow_ups:
[{label, run}]` gets the strip; every board stored before this change — and every board that says nothing —
is untouched.

## Mechanism — one more word in the envelope the board already has

Nothing is rebuilt. `follow_ups` rides the exact Living Boards envelope pipeline `links` already uses:

- **Write** (`tools/show_blocks.py`, `blocks/common.py`): a new optional parameter, checked like the
  actions row is — 1-4 buttons, each needing BOTH halves (a label and a run message), and a message Hermes
  would act on before the model (starting `/` `@` or `!`, or carrying an `@-reference`) is refused with the
  exact NO_SEND problem a button's carries, at write time. Labels and messages store WHOLE: control
  characters stripped, blanks trimmed, nothing else cut — length is the drawing side's business, and the
  host's own conventions below are the reader's protection. The word rides beside `links` in the one
  envelope; a board that says no board words stores exactly what it always stored (a plain list), and an
  `include` still takes just the blocks. `describe()` and the catalog budget are untouched: the word is
  documented in the parameter description, the route `target`/`links` and `interactive` before them used.
- **Store/serve** (`core/store.py` `follow_ups_of`, `dashboard/plugin_api.py`): read the way `links_of`
  reads its own — the shape was answered where it was written; here only "is it a list with anything in
  it". Served beside `version`/`updated_at`/`links` in the `/blocks/{id}` answer, after the version is
  picked, so an archived version still speaks its own follow-ups in the very same shape.
- **Web read** (`web/src/core/readBlocks.ts`): the envelope word reads leniently like a row of action
  buttons — aliases included (`text`/`ask`/`message`, the way `actions` takes them), a guarded run dropped
  with the note buttons have always carried, at most four kept. Both words are kept WHOLE
  (`firstText(…, Infinity)`): the writer stored the entire prompt, and a read that cut it would send a
  DIFFERENT message than the board offered (and a cut label is a clipped label — the generic 40/300 caps
  must never be reused for a word whose whole string is the contract). Only from an envelope, never from a
  block that merely spells its children `blocks`.
- **Draw** (`web/src/core/FollowUps.tsx`, `core/Blocks.tsx`, `host/BlockTag.tsx`, `styles/tokens.css`): a
  flex-wrap row of the shipped `.hb-pill` buttons — the same pill the shipped action buttons draw — as the
  LAST child of the ONE `.hb-blocks` element, beneath everything the board draws. The row is
  `width: 0; min-width: 100%` (the tools-row trick): it fills the column without ever contributing
  its own width, so it costs a fit-content hug ZERO width. Labels and the status word wrap
  (`white-space: normal; overflow-wrap: anywhere`) — no nowrap, no ellipsis, nothing that truncates:
  height may grow, width never. Each pill's `title` shows the WHOLE prompt before the tap, as a button's
  does. `BlockTag` threads the word from the envelope read into the draw, archived versions included. A
  board that says nothing: no strip, no wrapper, no word span — the same DOM as always.

## The seam — this PR grows it minimally, and says so

A follow-up is a message the board wrote for the reader to send; tapping it must POST it whole on one tap,
and the reader must hear the truth of where it went. On `main` @ #55 `send` is the shipped void seam: a
tap past `MAX_SENT` (120 characters) goes to the composer as a draft, and nothing answers. This PR adds
the smallest compatible growth — the behavior the interactive-table offer (#73) carries, so NEITHER PR
waits on the other; the overlap is a small, tested, order-independent conflict set, resolved once — see
§"Coexistence with #73" for the verified guidance (no automatic clean merge is claimed):

- `send(text, opts?): Promise<SendResult>` with `SendResult = "sent" | "drafted" | "blocked" | "failed" |
  "nowhere"` — every answer is the host's own (submit's yes, insertText's resolved-true; a refusal or a
  rejection says FAILED, never a draft the host did not acknowledge) and the promise never rejects.
- `force` waives ONLY the length convention — the guard for text Hermes would act on before the model
  still holds, and when it holds an explicit send back the word says BLOCKED.
- `SENT_WORDS`: one plain vocabulary every board that speaks a send's outcome speaks with.
- `plugin.tsx` forwards `opts` through the app wrapper (a one-argument closure there would silently drop
  force); the dashboard surface's send word is its fill's real acknowledgement, so `openAndFill`'s
  existing `Promise<boolean>` now rides `registerLive` all the way.
- Existing taps behave exactly as before: short prompts still submit, long and command-like text still
  goes to the composer whole, the guard still holds; every block that ignores the return value compiles
  and taps unchanged. The `desktop/plugin.js` bundle is rebuilt.

**Deliberately NOT included: alignment placement.** The local full stack centered/right-packed the strip
via the align machinery; that machinery is not on this base, so the row packs left like everything else
and no placement classes are drawn.

## Integration with current main (#55 era)

- **Living Boards envelope, one reader.** The word flows through the existing `blocks_of` envelope exactly
  as `links` does — `check_blocks` refuses only undrawable things, `show_blocks` stores the word verbatim
  (whole), `follow_ups_of` serves it, `readBlocksNoted` unwraps it once. No new pipeline.
- **Defense in depth, three times, with one vocabulary.** The NO_SEND rule is enforced at write
  (`follow_up_problems` refuses the whole call), at read (`readFollowUps` drops the item with the note),
  and at the seam (even a forced send guard-refuses — drafted with the word BLOCKED, never submitted). A
  `/reset` cannot reach the chat through this feature on any path — pinned at all three layers.
- **The word is only ever true of the tap it answers.** Each tap marks itself as the newest and clears
  the previous word to "Pending…" the moment it starts; a slow host answer about an EARLIER tap can never
  relabel a newer choice (a tap counter gates the write-back). The reviewed stale-feedback fix from the
  local build, kept in full.

## fit-content, preserved by construction

The strip cannot widen a board that hugs: pinned in real Chrome (`tests/test_follow_ups_chrome.py`,
self-contained, 25 tests) — the narrow bubble measures the same with the strip as without (0.01px), whole
long words (a 68-character label, a 449-character run) hug the same and WRAP line for line, the worst-case
status word (BLOCKED) parks BENEATH the pills at the narrowest hug (a vertical probe — a horizontal-only
probe would certify inline overflow as fine), all of its words lie inside their box, and two standing
negative controls keep both old defect shapes measurable forever: a content-sized row (`width:auto`)
inflates the bubble past 100px, and the old clip rule (nowrap + ellipsis) truncates the very whole words —
labels AND the word span. Behavior is pinned with REAL pointer and key events over the REAL components and
the REAL seam with a recording fake host composer that answers like the real one can (no `send` mock
anywhere): a tap submits exactly its prompt and the strip then says "Sent to chat."; a 449-character
prompt (over the review's 300-character bar) arrives through the real read and is SUBMITTED EXACTLY on one
tap, insert never called; a refused submit falls to an acknowledged draft and says so; an insert the host
refuses admits "Send failed — nothing was sent or kept." and the pills stay for a retry; a guarded stored
run never becomes a pill at all; a run crafted past the reader is still never submitted and says BLOCKED;
while the host holds a second tap's answer open the row says "Pending…", never the first tap's leftover
success, and the real word replaces it when the host finally answers; Tab + a trusted Enter activates; a
board that says nothing draws no strip and no word span. Composition over the real `BlockTag`: the word
rides the ONE `<Blocks>`, the strip is its last child, and taps through the tag's own provider submit
exactly and say so.

## What did not change

A board without the word stores, serves, reads and draws exactly as before — pinned end to end: the plain
board renders PIXEL-IDENTICALLY through each tree's own shipped component (`before.png` ==
`cand-plain.png`, byte-identical hashes), and on the base the same spec with `follow_ups` says nothing
(`base-strip.png` == `before.png`). Every existing block type, the `describe()` and catalog budgets, the
composer's shipped conventions for unforced taps (length, guard, draft-not-lost fallback) and the command/
file guard are unchanged; `fill` behaves as before; `send`'s observable CALLS are identical for every
existing caller — only its return value grew, and the only component that reads it is this strip. No
behavior in this PR depends on any other open offer: the seam growth ships here, same-behavior as #73, and
the two share a small, verified conflict set with one tested resolution that works in either merge order
(§"Coexistence with #73" — no automatic clean merge is claimed).

## Coexistence with #73 (interactive tables) — verified merge guidance

Both PRs grow the same seam with the same behavior. Simulated against the LIVE #73 head
`10aacfb446fb605e7bdb1a4c68c471ee66f485c4` (confirmed via upstream `refs/pull/73/head`, OPEN) in scratch,
in BOTH merge orders, with no upstream writes:

- **Conflict set (both orders, exactly 4 files):** `web/src/host/actions.ts`,
  `web/src/host/actions.test.ts`, `web/src/plugin.tsx`, `desktop/plugin.js`. Everything else auto-merges —
  including 5 shared seam files that are BYTE-IDENTICAL across the two PRs (`live/register.tsx`,
  `live/DashboardView.tsx`, `core/testing.tsx`, `live/register.test.ts`, `host/BlockTag.living.test.tsx`:
  after the first PR lands, the second's diff to them is empty).
- **What actually conflicts:** the shared RUNTIME code is byte-identical (types, the `force` option, the
  async `send` body, the `draft()` ack helper, guard/length logic); the collisions are only comment wording
  (each PR illustrates `force` with its own example), this PR's `SENT_WORDS` addition, one test name, and
  the generated bundle.
- **One resolution, applied identically in both orders, converges to the same result:**
  1. `actions.ts` — keep ONE copy of the seam code (byte-equal in both PRs); union the comment examples
     ("a follow-up tapped with its whole message shown on the pill, or a table selection ticked row by
     row"); keep `SENT_WORDS` (only this PR defines it).
  2. `actions.test.ts` — keep this PR's file: its bodies are #73's tests (same fixtures, same assertions)
     plus awaited result checks and the `SENT_WORDS` vocabulary describe; the one shared test whose names
     collide resolves to "a guarded user send (tapped follow-up or ticked pick) refused by the surface
     answers \"failed\", not \"blocked\" — nothing kept". (Keeping #73's file and re-applying only the
     `SENT_WORDS` describe is equally valid — both variants were verified.)
  3. `plugin.tsx` — the opts-forwarding line is identical; keep one comment naming both surfaces.
  4. `desktop/plugin.js` — never hand-merge a generated bundle: rebuild it (`cd web && npm run build`).
- **Verified outcome:** both orders produce the SAME tree `540779f66e1cc0c163e5859d9fce54283b96c0d5` and
  the same rebuilt bundle `be7075cf6eda11f50fc140776f7d4709356e840d510a531c600546ee22ea8a8d` (built once
  per order plus a rebuild-purity check — every build byte-identical, and rebuilding the merged tree again
  leaves `git status` clean); the combined tree passes BOTH features' suites — pytest **1291 passed /
  1 skipped** (the follow-up Chrome family 25/25 and the interactive-table Chrome family 24/24 pinned
  separately too), vitest **812 passed / 88 files**, tsc clean, ruff clean. A second resolution variant
  with different comment wording produced the SAME bundle and the SAME passing numbers — the union's
  wording is free, its behavior is fixed.
- **Guidance for the maintainer:** either merge order works with the four-hunk recipe above — small,
  mechanical, tested. There is **no verified zero-conflict shortcut**, and in particular: if #73 lands
  first, do NOT simply drop this PR's seam commit (`855b0fd`) on rebase — it is the ONLY definition of
  `SENT_WORDS` in `actions.ts`, while the strip's own commit (`1139b5a`) imports it in
  `FollowUps.tsx` (and `actions.test.ts` asserts it). With the seam commit dropped and nothing else
  carried, the follow-up side does not build: tsc reports `Module '"../host/actions"' has no exported
  member 'SENT_WORDS'` in `FollowUps.tsx`, and the bundle build fails (witness:
  `evidence/r4/r4-drop-commit-witness.log`). If rebasing instead of merging, replay ALL of this PR's
  commits, resolve the seam commit's hunks with the same recipe above (and KEEP the `SENT_WORDS`
  definition), and rebuild the generated bundle rather than merging it. No automatic clean merge is
  promised anywhere — the claim here is only that the overlap is verified, bounded, and
  behavior-preserving in both orders through that recipe.

## Review corrections carried in

From the build card's rounds (kept):
1. Round 1: whole words at read — the generic `firstText` caps silently cut `label` at 40 / `run` at 300,
   so a 301+ character prompt sent a DIFFERENT message than the board stored. Both words read WHOLE; the
   read test flipped from asserting the caps to asserting preservation, and the Chrome probe pins
   whole-prompt preservation end to end (real read → real draw → real seam).
2. Round 3 (the table lane's shared lesson, kept): status/label text must be READ, not clipped — the
   wrap-never-clip CSS contract and its word-level Chrome clip probe.

From the upstream-offer review round (comment 1408 / parent routing note):
3. Correction #1: a long follow-up must POST on one tap. The rebase had kept this base's drafted-long
   convention; the accepted feature never did. The force route ships inside this PR (minimal compatible
   growth — no dependency on #73), and real Chrome pins the EXACT submission of a >300-character prompt
   with insert never called.
4. Correction #2: truthful host-acknowledged feedback. Restored in full: SENT_WORDS shown only after the
   host's own answer, "Pending…" cleared the moment a new tap starts, a late answer about an earlier tap
   never relabels a newer one — with a deferred-host regression in real Chrome (held-open insert) and
   jsdom coverage of every word and both stale rules.

From the upstream-offer review round 2 (merge-compatibility verdict):
5. Correction #3: verified merge guidance against the LIVE #73 head. The earlier claim that whichever
   offer lands second "merges the same hunk" was wrong as stated: a real merge conflicts in BOTH orders
   in exactly four files. Those conflicts were simulated, resolved once with a documented recipe, and
   the combined result was tested end to end — see §"Coexistence with #73". No automatic clean merge is
   promised anywhere in this document; the claim is that the overlap is bounded, resolved identically in
   either order, and green for BOTH features. Functional code is unchanged by this correction (docs only).
6. Correction #4 (third review round): the "drop the seam commit on rebase" zero-conflict alternative
   was REMOVED — it was unverified and FALSE when #73 lands first (the seam commit is the sole definer of
   `SENT_WORDS`, which the strip's follow-up commit imports; dropping it alone breaks the build —
   witnessed). The four-hunk resolution above is the only integration guidance this document makes, and
   every claim in it is backed by a simulated merge in both orders with both features' suites green.

---

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
