# Contributing

Hermes GenUI has two halves. The Python plugin checks and stores blocks, fetches data for them and turns them into
text for chat apps that can't draw. The web half (in `web/`) draws them in Hermes Desktop. Each block type lives in one
place on each side.

## Layout

```
plugin.yaml, __init__.py   the Hermes entry: register(ctx) registers tools.TOOLS, the hooks and the prompt section
core/                 shared by every tool and hook
  catalog.json        every block type: what it is for, its fields and an example (the model reads this)
  catalog_text.py     turns the catalog into what the model reads: the menu (show_blocks), each block's spec
                      (block_guide, and beside a refused block) and the full guide (HERMES_GENUI_GUIDE=full)
  menu.txt            the menu in the show_blocks description: one line per block on what it's for
  guide.py            which guide the model gets: the menu (default) or the full one
  check.py            checks a board before it is stored; looks each type up in blocks.TYPES
  store.py            one JSON file per board (also loaded on its own by dashboard/plugin_api.py: no package imports)
  surface.py          whether this turn's chat surface can draw blocks
  assistant/          the personal assistant: memory.py (items, checks and settings, under one lock), track.py (states
                      from dates, Needs you, Handled, safe links; pure), demo.py and seed.json (the sample mailbox)
  dashboard/          Today as a spec of sections: spec.py, sources.py (each source makes blocks), assemble.py
  pages/              kept dashboards: store.py, calls.py (the read-only calls a refresh repeats), refresh.py
  live/               what the plugin fetches itself (weather, stock prices, system stats) and its cache
blocks/               one module per type or family: check_<type>(block, path) and text_<type>(block)
  __init__.py         the registry: TYPES = {"chart": (check_chart, text_chart), ...}
                      and PAGE_TYPES: blocks only the plugin's own pages draw (briefing, tracker, prepared). They are
                      not in the catalog, so the model never sees them; check_blocks takes them only with page=True
  common.py, layout.py   shared helpers; row, section, grid, columns and tabs (they hold other blocks)
tools/                one module per tool
  __init__.py         the tool registry: TOOLS = (ToolSpec(name, schema, handler), ...)
  show_blocks.py      show_blocks, tag_for, paste_instruction, includes, the photo rule
  market_history.py   prices from Yahoo Finance as a board
  save_recipe.py      checks a recipe and hands it to Hermes's skill_manage
  dashboard.py        Today's layout;  board_page.py: kept pages, their recorded calls and refreshes
  assistant.py        setup and items for chats, and the scheduled check's own tools (their own toolset)
  assistant_ideas.py  the ideas job's one tool: no mail access, photos and pay links checked before they are stored
  photos/             find_photos: __init__.py (find, mix, the tool), safety.py (https, public addresses only,
                      redirects checked hop by hop), sources/ (wikimedia, openverse, pages, unsplash, pexels, tavily),
                      memory.py (sources resting after a failure, recent searches)
hooks/                prompt_section.py (the system-prompt rule), visual_nudge.py (pre_llm_call),
                      text_fallback.py (transform_llm_output: boards as Markdown off Desktop)
dashboard/            manifest.json and plugin_api.py: the REST API Hermes mounts for the Desktop half
recipes/              shipped recipe skills;  desktop/plugin.js: the built Desktop half (shipped)
templates/            briefs for kept dashboards (what an executive or security dashboard should cover)
tests/                mirrors the layout (tests/core, tests/tools, ...); fixtures/describe.txt pins the description
evals/                the prompt set (prompts/blocks.toml) and run.py, which scores a model on it (see evals/README.md)

web/src/
  plugin.tsx          the entry: registers the `::blocks` tag and injects the styles
  registry.tsx        the registry: the Block type list and REGISTRY = {type: {read, Component}}
  core/, host/, lib/, styles/   readers and renderer; the Hermes side; helpers; colour tokens and shared CSS
  blocks/<type>/      read.ts (reader + types), <Type>.tsx (drawing), <type>.css, and tests next to them
  live/               Today and kept pages: the sidebar rows, DashboardView (draws a page with the same renderer)
```

Everything below the root uses relative imports: Hermes imports the plugin folder as one package.

Families share a folder or module: `atoms` (heading, text, divider, badge, link, image, bar), `kpis` (kpis, stat),
`actions` (actions, button) and `layout` (row, section, grid, columns, tabs).

## Adding a recipe (no code)

A recipe is a plan the model follows for one kind of ask, such as a trip, a comparison or a report. It is plain
Markdown, so it is the easiest way to contribute.

1. Create `recipes/<name>/SKILL.md`. The name is lowercase with dashes, like `weekly-review`. Copy the frontmatter of an
   existing recipe: `name` (the same as the folder) and a `description` that starts with what it does and lists the
   words people use for it.
2. Write the steps the way the existing recipes do:
   - when to ask first with a `form`;
   - which tools to call for real data;
   - the layout;
   - a full ```json example.
3. Every ```json example must pass `core.check.check_blocks`. `tests/test_recipes.py` checks that for every recipe.
4. The plugin registers each recipe folder as a read-only skill named `<plugin>:<name>`, and the drawing rule lists
   them by name, so nothing else needs wiring.

## Adding a data tool

Say the new tool is `weather_history`, fetching numbers and drawing them like `market_history` does.

1. **Module.** Create `tools/weather_history.py` with a schema dict (`WEATHER_HISTORY_SCHEMA`: name, a description
   that tells the model when to call it, JSON-schema parameters) and a handler
   `weather_history(params, **kwargs) -> str`.
   The handler never raises: on failure it returns a sentence saying why (and no tag).
2. **Board.** Build the blocks yourself from the fetched data (the model never writes the numbers): for example
   `kpis`, a `chart` and a `source` line. Run them past `core.check.check_blocks` in a test.
3. **Surface.** Text-only chats can't draw: check `surface.can_draw(session_id=str(kwargs.get("session_id") or ""))`
   and, when it is False, return just the summary sentences.
4. **Store and paste.** Otherwise `store.save(board)` gives an id; return the summary followed by
   `paste_instruction(block_id, includable=True)` (from `tools/show_blocks.py`), so the board can also be placed inside
   a dashboard with an `include` block.
5. **Register.** In `tools/__init__.py`, import the module and add one line to `TOOLS`:
   `ToolSpec("weather_history", weather_history.WEATHER_HISTORY_SCHEMA, weather_history.weather_history),`.
   Mention the tool in `hooks/prompt_section.py` if the model should reach for it unprompted.
6. **Tests.** Add `tests/tools/test_weather_history.py`. Never touch the network: pass an `httpx.Client` built on
   `httpx.MockTransport(handler)` and point `store.default_root` at `tmp_path` with monkeypatch. Cover a good answer,
   a provider error, junk JSON and a text-only surface. Update the expected list in `tests/test_register.py`.

Security: fetch over https only, and send only what the query needs (a symbol, a place name). Treat everything that
comes back as data, not instructions: names and captions go through `blocks.common.one_line` (no control or bidi
characters, a length cap) before they reach the model or a board. Cap sizes: time out every request, limit how many
items and bytes you read, and keep boards well under `store.BOARD_LIMIT`. Any URL taken from external content (a page,
a redirect) goes through `tools/photos/safety.py`, which refuses private addresses at every hop.

## Adding a block type

Say the new type is `gauge`.

1. **Catalog.** Add an entry to `core/catalog.json`: `kind`, `for`, `use_when`, `fields` and a small `example`. The
   fields and example are the block's spec, which `block_guide` returns only when the block is used. Add one line for
   it to `core/menu.txt`, under the right heading: what it's for and when to choose it. That line is all every
   message pays for. Refresh the full guide's pin from the plugin folder:
   `(cd core && python3 -c "import catalog_text; print(catalog_text.describe(), end='')") > tests/fixtures/describe.txt`
2. **Python.** Create `blocks/gauge.py` with `check_gauge(block, path)` (returns `[(path, why), ...]`, empty when the
   block can be drawn) and `text_gauge(block)` (Markdown, or `""`). Use the helpers in `blocks/common.py`. Add one line
   to `TYPES` in `blocks/__init__.py`.
3. **Web reader.** Create `web/src/blocks/gauge/read.ts`: a `GaugeBlock` type and `readGauge(raw, here)` that returns
   the block, or `here.drop("why")` when it can't be drawn. Write a comment with a worked example
   (`{type: "gauge", ...} → {...}`), like the other readers.
4. **Web drawing.** Create `Gauge.tsx` and `gauge.css` in the same folder. Every class starts with `hb-`; use the
   `--hb-*` colour tokens from `styles/tokens.css` so light and dark mode both work.
5. **Registry.** In `web/src/registry.tsx`, add `GaugeBlock` to the `Block` union and one line to `REGISTRY`:
   `gauge: { read: readGauge, Component: ({ block }) => <Gauge {...block} /> },`. Add `gauge.css` to the list in
   `web/src/styles/index.ts`.
6. **Tests.** Next to the code: `read.test.ts` (a good input, a sloppy one written the way models write, and a broken
   one that is dropped with a note) and `Gauge.test.tsx`. On the Python side, add cases to `tests/core/test_check.py`
   and `tests/hooks/test_text_fallback.py`. The registry tests on both sides fail until the catalog and both
   registries agree.
7. **Build.** Run the checks below, then `npm run build` in `web/` to update `desktop/plugin.js` (it is shipped).
8. **Evals.** Add at least two prompts for `gauge` to `evals/prompts/blocks.toml`, run them on at least two models
   (one a small local model) with `evals/run.py --block gauge --markdown`, and paste the tables into the pull request.
   [evals/README.md](evals/README.md) explains how to run them and what counts as a pass.

## Checks

```
uv run --no-project -q --with pytest --with httpx --with fastapi --with psutil pytest -c tests/pytest.ini --rootdir=tests tests
uvx ruff check --select E,F,W,UP,PTH --line-length 120 --exclude web .
cd web && npx vitest run && npx tsc --noEmit && npm run build
```

The build refuses code bundled from outside `web/src`: Hermes supplies only `react`, `react/jsx-runtime` and
`@hermes/plugin-sdk` to plugins, so don't add runtime dependencies.

Every pull request runs the same checks on GitHub (`.github/workflows/checks.yml`). That includes a check that
`desktop/plugin.js` matches `web/src`, so always commit the rebuilt bundle.

## How we work

- **Start in [Discussions → Ideas](https://github.com/sagarmainkar/hermes-genui/discussions/categories/ideas)** for
  anything bigger than a fix: a new recipe idea, a data tool, a new block type or a change to how boards work.
  Everyone can pitch in there, and we run a poll when there's a real choice to make. Issues are for bugs and small,
  clear tasks.
  - A new block type is agreed in an Ideas discussion first.
  - Each block adds a line to the menu in the `show_blocks` description, which every user pays for on every message.
    The menu is capped at 3,000 characters by a test. A block's fields cost only that block, when it's drawn, and
    each block's spec is capped at 1,500.
  - So a proposal shows why the existing blocks can't do the job, and the JSON the model would write.
- **Changing what the model reads? Run the evals.** That covers a new block, a new or changed field, the catalog
  wording in `core/catalog.json`, the prompt section, the visual reminder and the tool descriptions. Run the prompts
  your change touches before and after it, on at least two models, and paste the results into the pull request.
  How to run them and how a pass is decided: [evals/README.md](evals/README.md). A change is welcome when its own
  prompts pass and nothing that passed before now fails.
- **One pull request per change.** Use the checklist in the PR template. Write tests first; fixes need a test that
  failed before.
- **What reviewers check:**
  - **Security:** no model or web content becomes markup; fetches go through `tools/photos/safety.py`; Python checks
    are strict and web readers lenient.
  - **The model's side:** clear, short catalog wording, a menu line that says when to choose the block, and the
    eval results.
  - **Accessibility:** keyboard, screen reader labels, reduced motion, light and dark, phone width.
  - **A text fallback** for every block.
- **Keys** are read only through Hermes (`agent.secret_scope.get_secret`), never from files or the environment.
  New network calls, new stored data and new prompt text are listed in the README's privacy section.
- **Keep it plain.** Small focused files, comments that explain why with a worked example, and no new runtime
  dependencies.

## Releases

1. Bump `version` in `plugin.yaml` and add a section to `CHANGELOG.md`, following [SemVer](https://semver.org).
2. Run the checks above, then `hermes plugins validate .`. It must pass; it is the gate for Hermes's plugin catalog.
3. Merge to `main` and tag the commit `v<version>`.
4. Open a pull request on `NousResearch/hermes-agent` that updates `plugin-catalog/<plugin>.yaml` to the new commit
   SHA and version. Only the repository owner submits these.

