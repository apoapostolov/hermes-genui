# GenUI block design contract

This file is derived from the block source in this repository. Its job is to keep a new block visually and behaviourally indistinguishable from the blocks that already ship. When a rule and the code disagree, fix the code, then update this file in the same change.

The visual units are blocks. A block is one catalogue kind, one Python checker and text renderer, one reader, one React component and one stylesheet. Adding a new kind costs model-guide text on every message, so extend an existing block before creating a new one.

## Before adding a block type

1. Agree the type in a `new-block` issue. State what cannot be shown today, the JSON the model would write and how it reads as text. The template in `.github/ISSUE_TEMPLATE/new-block.yml` is the contract.
2. Show why an existing block with an extra optional field cannot carry the data. Most requests for a "new block" are a field on `chart`, `list`, `table`, `kpis` or `progress`.
3. Keep the model guide under its 14,000-character test. `core/catalog_text.py` builds it from `core/catalog.json` in catalog order, and every field you add is text the model reads on every turn. Free space in the same edit when the budget is tight.
4. After any catalog edit, regenerate `tests/fixtures/describe.txt` with the pinned command from `tests/blocks/test_blocks_registry.py`, then rerun the catalog and registry tests.

## One block, five mandatory places

- `core/catalog.json`: add `kind`, `for`, `use_when`, `fields` and `example` for a new kind, or extend `fields` for a new field on an existing one. Place the entry where it should be read. Atoms are appended at the end by `catalog_text.py`.
- `blocks/<kind>.py`: ship `check_<kind>` and `text_<kind>` in the same module. Register the type once in `blocks/__init__.py`. Report problems as `(path, reason)` with the path walked into the block. The catalog example must pass `check_blocks`, and the text rendering must be non-empty.
- `web/src/blocks/<kind>/read.ts`: ship `read<Kind>(raw, here)` returning the block, an array of blocks, or `here.drop("reason")`. Never throw on model-written data, never draw a partly invalid row, and drop only what makes the block undrawable.
- `web/src/blocks/<kind>/<Kind>.tsx`: export a component taking `{ block, draw }` and nothing else. Containers draw children with `draw(block.children)`; they do not import `Blocks`.
- `web/src/blocks/<kind>/<kind>.css`: prefix every selector with `hb-` and add the file to the ordered list in `web/src/styles/index.ts`. A file that is not in that list never ships.

Register the type in the `Block` union and in `web/src/registry.tsx` too. `registry.test.ts` asserts that every catalogue kind has a reader and a drawing.

## Visual contract

### Tokens and surfaces

- Every colour, border, shadow and surface comes from a `--hb-*` property declared once in `web/src/styles/tokens.css` on `.hb-blocks`. Do not declare a new custom property in a block stylesheet. If a token is genuinely missing, add it centrally with a dark-mode pair.
- Structural colour vocabulary: `--hb-ink` and `--hb-ink-2` for text, `--hb-muted` for captions and labels, `--hb-card` for card background, `--hb-well` for inset rows, `--hb-line` for dividers, `--hb-line-strong` for inputs, axes and checkbox marks, `--hb-surface` for the page behind a mark, `--hb-accent` for selection and focus, `--hb-accent-soft` with `--hb-accent-ink` for soft emphasis, `--hb-shadow` for raised cards.
- Semantic colour vocabulary: `--hb-good` for positive, complete or rising values; `--hb-warn` for negative, cautionary or falling values; `--hb-bad` for a value in a bad progress band, the only tone added beyond a theme pair and declared centrally with a dark-mode pair; `--hb-chart-1` through `--hb-chart-8` for a fixed series order. Never assign a series colour from its position in an arbitrary array.
- A content block mounts as `<div className="hb-card hb-<kind>">`, or as a `figure` when it draws a chart or photo strip. Inherit the card's background, 1px border, 16px radius and 14px/16px padding. Dense ledger blocks may override padding only: table, list, kpis and atoms do this. Do not build a second card.
- Layout-only blocks (`row`, `grid`, `columns`, `tabs`) mount no card. They arrange children and let child cards keep their own surface.
- A title uses `.hb-card-title` and goes through `InlineText`. `**bold**` is the only accepted markup. Do not invent another heading class. Charts use `.hb-chart-title` because the headline number, not the name, is the primary text.
- A source line uses the `Source` component, or `.hb-chart-source` where the chart's right alignment is already established. Do not add a third provenance style.

### Type, spacing, numbers

- Base text is 14px/1.45. Titles are 16px/700. Body copy is 12px to 14.5px. Captions, axis labels and meta lines are 11px to 12px. A big number is 22px to 28px at weight 650 or more with slightly negative letter spacing.
- Repeating gaps are 8, 10, 12 and 14px. Board gap is 10px with 8px vertical margin. Card padding is 14px/16px. Chip padding is 2px/9px. Pill padding is 7px/14px.
- Every numeric display carries `font-variant-numeric: tabular-nums`. Numbers must not shift as values change.
- Truncate with the established patterns: two-line `-webkit-line-clamp` for prose, or `overflow: hidden` with `text-overflow: ellipsis` and `white-space: nowrap` for a single line. Use `overflow-wrap: anywhere` on long numbers or unbroken text.
- Pills, chips, dots, tracks and avatars use `border-radius: 999px`. Cards keep the shared 16px radius. Bars and swatches use 2px to 3px corners. Do not invent a card radius.

### Tone, focus, motion, layers

- Map meaning to the three semantic tones. Do not encode status with a new colour or with colour alone. Pair a status colour with a sign, glyph or word.
- A change chip is data, not a new control. The reader computes it once from `previous`, and the card renders only the arrow, number and unit. `invert_tone` swaps the two semantic tones on the existing direction classes when a fall is good news. The arrow still carries direction, and the text fallback prints the same number and rounding.
- Every interactive element gets `outline: 2px solid var(--hb-accent)` on `:focus-visible`. Offset is 2px for a raised control, -2px for a control that fills its row, 1px for a dense grid cell, 4px around a focusable chart drawing. A hover affordance must have a focus counterpart.
- Hover changes a background, border or opacity, not size. Rows and options use `--hb-well` or a soft accent wash. The one lift-and-press exception is `tiles`.
- Reuse `hb-appear` and `hb-grow`. Keep colour transitions at 0.15s with `cubic-bezier(0.2, 0.8, 0.2, 1)`. Add a `prefers-reduced-motion: reduce` rule in any stylesheet that animates, and ask `lessMotion()` before starting JavaScript animation.
- Keep `z-index` on the existing scale: sticky header 1, flow packet 3, chart hover card 5. The photo overlay is the only full-window layer. Do not add a higher layer.
- Contain overflow inside the block. Scroll surfaces use `overflow-x: auto` with scroll snap or hidden scrollbars. Leave SVG plots `overflow: visible` so marks are not cut.
- Use `@container` for internal responsive layout. Reserve viewport media queries for whole-page changes. Never set an outer max-width or margin on a block; scope a cap to `.hb-blocks > .hb-<kind>` when the data needs one.

## Interaction contract

- Use the native element that matches the action. A row that sends a message is `<button type="button">` with the message as its `title`. A row that opens a URL is `<a target="_blank" rel="noreferrer">`. An inert row is a `div` and must not look tappable.
- A checklist state is a shape on the same checkbox mark plus the state word. A stored tick and `done: true` stay authoritative; `state` adds context but never replaces a saved tick. Owner and note sit on that row, not in a second card.
- Reuse the shared controls before drawing a new one: `Chip`, `Pill`, `Slider`, `Tabs`, `Source`, `Bar`, `KpiCard`, `Chart`, `InlineText` and `Icon`. If an icon is missing, copy the 24x24 `currentColor`, `aria-hidden` box from `Icon.tsx`.
- Keep inline `style` for computed geometry and chart colours drawn from `var(--hb-*)`. No literal colour, no layout number in JS when a class can carry it.
- Give a drawing that is a picture `role="img"` and an accessible name built from the data it shows. Give decorative marks `aria-hidden`. Screen-reader users cannot read `<text>` inside an SVG, so carry axis names and caveats in the accessible name.
- Put changing text in an `aria-live="polite"` region. Use `pickKeys` for a focusable drawing, and copy `Tabs` for a tab-like switch, including ids, `aria-controls`, `aria-labelledby` and arrow keys. Overlays render in place with `role="dialog"`, `aria-label`, Escape to close and click-to-close. No React portal.
- Do not add a loading or failure state inside a block. `BlockTag` owns those. Saved-state hydration must not flash a placeholder.
- An empty input either returns `null` so the block disappears, or draws one muted sentence in a `hb-<kind>-empty` element. Never draw an empty frame.
- Every `<img>` sets `loading="lazy"` and `referrerPolicy="no-referrer"`, and hides itself on `onError`. Illustrative photos use `alt=""` when their caption is already visible; a photo that carries the only text uses its caption as `alt`.
- Messages a control would send are guarded twice: readers drop messages starting with `/`, `@` or `!`, and the host falls back from `send` to `fill` above 120 characters. Do not bypass either guard.

## Add a field to an existing block

This is the common case, and it should touch the fewest files.

1. Read the field in `read.ts` with the same trim, cap and absent-value rules as neighbouring fields. A field the model writes wrongly must be ignored or dropped with a reason, never rendered broken.
2. Add the field to the React spec type and render it with existing classes and tokens. If it needs space, grow the drawing's margin rather than shrinking the plot.
3. Extend `check_<kind>` in Python when the field has a shape that can be wrong, and `text_<kind>` when the field carries meaning that the text fallback should say. Axis names usually stay out of the text line; a caveat usually becomes a second line.
4. Add one short clause to the block's `fields` string in `core/catalog.json`. Compress redundant wording in the same block entry if the guide budget is tight, then regenerate the pinned fixture.
5. Add reader tests, component tests and a Python text-fallback case. Use the block's own test files, not a new suite.

## Justified exceptions

These deviations are real and intentional. Copy the reason, not the shape.

- `chart` caps a standalone chart at 720px, drops the cap for a 60+ point line, and uses its own card padding because a plot needs pixels. Its 13px muted title exists because the headline number is the primary text.
- A new chart kind adds a mark, not a new frame. `scatter` uses dot marks on two numeric scales and no headline number. `waterfall` uses bars between balances with a one-pixel connector for the carried balance; totals use the series colour while steps use gain or loss tone. Series points stay in `series[].points`, and keyboard order follows x then y.
- `progress` is green because it reports attainment. An `atoms` bar is accent-coloured because it reports a proportion.
- A progress shape is one value, not a new block: `line`, `circle` and `dashboard` reuse the card, amount and track. Thresholds are ticks and bands over that track, segments are parts of one track with the existing legend, and a tonal band changes the card, icon, fill and ring together. Keep the state word beside the colour.
- `tiles` and `images` have no card wrapper and larger radii because a photo cover would be double-framed.
- `flow` nodes are small surfaces with strong lines and monospace data chips. `callout` is a tinted aside, not a card. `table` hugs its columns and keeps uppercase 11.5px headers. `heatmap` uses `role="table"` because its cells are the interactive unit. `checklist` uses `role="checkbox"` buttons because the whole row is the target.
- A block-local property is allowed only in the shape of `--hb-flip-cols`: one element, inline, with a fallback, affecting nothing outside the block.

Do not copy these existing drifts: a heading class borrowed as a caption class, literal rgba shadows on page-only blocks, a hard-coded colour in a board block, a source line rendered as a bespoke div, or a tab-like switch without `aria-controls` and arrow keys.

## Verification gate

Run these from the repository root after any block change.

```bash
python3 -m pytest -q
cd web && npx vitest run && npx tsc --noEmit && npm run build && cd ..
git diff --exit-code -- desktop/plugin.js
```

`desktop/plugin.js` is generated from `web/src`. A source change without a rebuilt bundle fails CI. On a Windows checkout with `core.autocrlf=true`, a source file can hold CRLF while its committed blob and Linux CI hold LF; the rebuilt bundle then differs on CI alone. Check `git ls-files --eol <file>`, normalize the working file to LF, rebuild, and commit the bundle. After a force-push, update every SHA-pinned image URL in the PR body.

Check the catalog guide size after an edit:

```bash
python3 -c "import sys; sys.path.insert(0,'core'); import catalog_text; print(len(catalog_text.describe()))"
```

The number must stay below 14,000.
