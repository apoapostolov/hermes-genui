# Issue #62 prototype implementation contract

Frozen base: upstream `sagarmainkar/hermes-genui` at `fd5bad7`. Branch: `feat/widget-prototype` on Apo's fork. This is a bounded, testable prototype of issue #62, not the full future widget system.

## Scope

Implement one public `widget` block that composes local state, typed expressions, layout/content/control/structure elements and allowlisted embedded blocks. No new public block per element. No arbitrary CSS/HTML/JSX. No cross-widget state, host writes, tool execution, reusable libraries or visual editor.

Three demonstrations must be represented in one shared fixture and rendered by both sides:
1. trip budget: slider changes remaining, planned spend, a bar and a conditional warning; reset restores initial state; fill prepares a message.
2. capacity planner: number and select controls feed computed totals and bound chart/table cells.
3. issue triage: keyed repeat with conditional details, an empty view and a fill button.

## Public JSON shape

```json
{
  "type": "widget",
  "version": 1,
  "id": "stable-id",
  "title": "Accessible title",
  "data": {},
  "state": {
    "nights": {
      "type": "number",
      "label": "Nights",
      "initial": 4,
      "min": 1,
      "max": 10,
      "step": 1
    }
  },
  "computed": {
    "total": {"op": "mul", "args": [{"get": "state.nights"}, 200]}
  },
  "view": []
}
```

- `version` must be exactly integer `1`; reject anything else explicitly.
- `data` is agent-supplied JSON only. Reject nested keys `fetch`, `tool`, `tools`, `include` and any nested block with `type: "include"`.
- `state` supports `number`, `string`, `boolean`. Every declaration has `initial` and `label`. Numbers need finite `min`, `max`, `step` with `min <= initial <= max` and positive step. Strings need finite `maxLength`. Booleans need boolean initial. Max 16 state entries.
- `computed` maps name to one expression object. Max 32 entries. Dependencies must be acyclic. A computed name cannot shadow a state or data name for path resolution purposes; paths are always explicit (`state.x`, `data.x`, `computed.x`).
- `view` is an array of element nodes. Max 200 authored nodes. Stable `id` required on every element, unique across the authored tree. Max depth 8. No nested `repeat`.
- Every string is capped by the existing safe-text rules. URLs must be literal `https://` strings and are never bound.
- `id`, `title` and every element `id` match `[A-Za-z][A-Za-z0-9_-]{0,63}`.

## Expressions

An expression is a literal (`null`, boolean, finite number, short string), a reference `{"get": "state.nights"}` / `{"get": "data.note"}` / `{"get": "computed.total"}` / `{"get": "item.id"}`, or `{"op": name, "args": [...]}`.

Operators: `add`, `sub`, `mul`, `div`, `eq`, `lt`, `lte`, `and`, `or`, `not`, `if`. Arity: arithmetic/comparison 2, `not` 1, `if` 3. `if` evaluates only the selected branch, so `{"op":"if","args":[test,then,else]}` must not evaluate the unselected branch.

- References read only declared `data`, `state`, `computed` and the current repeat `item`. No dynamic property names, no prototype segments (`__proto__`, `prototype`, `constructor`), no array indexing in `get`.
- `null` means unknown. Arithmetic/comparison with unknown yields unknown. `when` always requires `else`.
- `div` by zero or a non-finite result yields a visible diagnostic and unavailable output (`null` value plus a non-empty error string). Never substitute zero.
- Wrong operand types yield `wrong operand type` with unavailable output. `and`/`or` require booleans; `eq` compares same-ish primitives and returns boolean or unknown; `lt`/`lte` compare numbers or strings of the same type.
- Division by zero yields `divided by zero`, and a non-finite result yields `non-finite result`. An unresolved reference yields `unknown reference`; a bad operator yields `unknown operator`.

Python and TypeScript must share the same expression fixtures and produce the same values and exact error strings for them.

## Elements

Layout: `stack`, `row`, `grid`, `surface` with `children`; bounded `gap` (`xs|sm|md|lg`) and `columns` (1-4). Content: `text` (`text` or `expr`, `tone`), `number` (`expr`, `label`, `unit`, `tone`), `badge` (`text` or `expr`, `tone`), `divider`, `image` (literal https `url` + `alt`), `link` (`text`, https `url`). Controls: `input` with `control` `number|slider|select|checkbox|text`, a `state` target, visible `label`; numeric controls inherit min/max/step from the declaration; `select` needs `options` matching the string declaration. Actions: `button` with `action` `set` (`target` state path + typed `value` expression), `reset`, or `fill` (`message` plus `fields` listing state names). `set` cannot target `item`, `data` or `computed`. `fill` uses the host composer's guarded `fill`, never `send`; it appends only explicitly listed state fields as labeled plain text. Structure: `when` (`test`, `then`, `else`) and `repeat` (`items` path, `key`, `template`, `empty`). `repeat` items are a bounded array from `data` only, max 100, stable unique key required, item scope read-only.

Embedded blocks: `block` with a literal `spec` and optional `bindings` mapping JSON-pointer paths to expressions. Allow `stat`, `bar`, `chart`, `table`, and unbound `source`. Bindings allowed only at:
- stat `/value`
- bar `/value`, `/max`
- chart `/series/<n>/data/<i>` (number or null)
- table `/rows/<i>/<j>` and `/rows/<i>/<cell-key>`

Structural choices, URLs, sources and action strings cannot be rebound. Resolve bindings first, then run the existing block's Python checker and web reader on the result. Reject `include`, nested `widget` and page-only blocks inside a widget.

## Text fallback

`text_widget` evaluates at initial state, emits semantic content in view order, includes the selected `when` branch and repeats in order, renders embedded blocks with their existing `text_<type>` functions, prints unknown as `unknown`, and frames controls as `Label: value (adjustable from min to max in the interactive view)` where constraints exist. It uses the existing 3500-char cap and truncation note. It must not raise on malformed input.

## Guide and model discovery

Add one `widget` line to `core/menu.txt` and one `core/catalog.json` entry whose `spec("widget")` stays under 1500 characters. Add optional `topics` to `block_guide` with bounded files under `core/widget_guide/`: `widget.layout.md`, `widget.state.md`, `widget.collections.md`, `widget.blocks.md`. Without topics, `block_guide` keeps its current behavior. With `topics`, it returns only the requested references, still ending with the existing NEXT line. Unknown topic names are named explicitly. Refusals keep the existing excerpt behavior.

## File ownership

- Python child: `blocks/widget.py`, `blocks/__init__.py`, `core/check.py` (only if needed for widget photo/include traversal), `hooks/text_fallback.py` (only if needed), `tools/block_guide.py`, `core/widget_guide/*.md`, Python tests under `tests/`. Do not touch web files, catalog/menu, eval prompts or PR text.
- Web child: `web/src/blocks/widget/**`, `web/src/registry.tsx`, `web/src/core/types.ts`, `web/src/styles/index.ts`, web tests. Do not touch Python files, catalog/menu, eval prompts or PR text.
- Guide child: `core/catalog.json`, `core/menu.txt`, `tests/fixtures/describe.txt` (regenerate), `tests/tools/test_block_guide.py`, `tests/core/test_catalog_text.py` (only if needed), `evals/prompts/blocks.toml`. Do not touch block implementation or web files.
- Parent owns merge, bundle rebuild, PR body, public comments, CI watcher.

No child pushes, commits to public GitHub, posts comments or edits public PR/issue text. Each child commits locally on its own clone and reports the SHA, files, exact test output and any unverified item.

## Verification

Python targeted: `uv run --no-project -q --with pytest --with httpx --with fastapi --with psutil pytest -c tests/pytest.ini --rootdir=tests tests/core/test_check.py tests/hooks/test_text_fallback.py tests/tools/test_block_guide.py tests/blocks/test_widget.py tests/tools/test_show_blocks.py`

Web: `cd web && npx vitest run && npx tsc --noEmit && npm run build`

Ruff: `uvx ruff check --select E,F,W,UP,PTH --line-length 120 --exclude web .`

The parent runs the full Python suite, rebuilds `desktop/plugin.js` from LF-normalized `web/src`, verifies CR count 0, and checks the bundle diff contains widget code.
