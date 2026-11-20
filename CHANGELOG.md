# Changelog

All notable changes to this plugin. Versions follow [Semantic Versioning](https://semver.org).

## Unreleased

### The block guide stops growing (#42)

- **The model reads a short menu instead of every block's fields.** The `show_blocks` description is now one line per
  block on what it's for (about 2,500 characters, from about 14,000). A new tool, `block_guide`, returns the fields
  and example of the blocks the model is about to draw. A new block adds one menu line; a new field costs only its
  own block, when that block is drawn.
- **Measured on the eval prompts** (boards that reached the reply, of 34): Gemma 4 31B 17 → 28, Qwen3.6 35B 32 →
  30–31 (within run-to-run noise), DeepSeek V4.1 Flash 34 → 34, with about half the prompt tokens on every model.
- **Helps smaller models finish:** a drawn board's answer says not to draw it again, `block_guide` ends with the next
  step and lists the allowed icons, and a reply that lost its board's tag gets it back.
- `HERMES_GENUI_GUIDE=full` brings back the full guide in the description, as a fallback.

### Fixes

- **Gemma and other small models draw instead of writing a made-up tag.** The drawing rule used to show the tag's
  shape (`::blocks{id="…"}`), and Gemma 4 copied it into its reply without calling `show_blocks`, so nothing was
  drawn. The rule now only says to call the tool and paste the tag it returns. On the eval prompts, Gemma 4 12B went
  from 11 to 20 of 34 passed, and from 20 made-up tags to none.
- **One broken block no longer blanks the whole board.** Each block draws inside its own error boundary: a block that
  throws becomes a one-line note ("This part couldn't be drawn."), the rest of the board still draws, and the block
  and error are logged to the console so the case can be turned into a test.
- **A refused board says how to fix it.** A block with no `"type"` is told so, with the block its fields point to
  (`e.g. {"type": "timeline", ...}`); a chart kind used as a type (`"pie"`) points to the chart; and every refusal
  comes with the refused blocks' fields and example, so a model can fix them in the same turn.

## 0.3.1 — asks before touching your scheduled jobs

From the Hermes plugin-catalog review of 0.3.0.

- **A deleted assistant job stays deleted** unless you say otherwise. When the 30-minute mail check or the ideas job
  is gone, the model now asks whether to turn it back on, instead of re-creating it. On yes it brings back every
  missing job (the ideas job too, when ideas are on); on no it stops the assistant, or just turns ideas off. A
  local-only profile isn't offered its real-mail check back.
- **A refresh schedule you changed is kept** until you answer: the model asks whether to keep it or make the dashboard
  Refresh-only, instead of resetting it.
- **"No scheduled jobs that send data to the model" is now a plugin setting**, `local_only` (Hermes Desktop's
  plugin settings, or `plugins.entries.hermes-genui.settings.local_only` in `config.yaml`), since `.env` is for
  secrets. The plugin no longer reads `HERMES_GENUI_LOCAL_ONLY` from `.env`: if you set it there, set the plugin
  setting instead. A setting that can't be read counts as on.
- **The setting now also stops jobs made before it was switched on.** A real-mail check reads nothing and ends, and
  a kept page keeps its last snapshot instead of refreshing. Before, it only refused new setups.

## 0.3.0 — Today, and dashboards you keep

### Today, kept by a personal assistant

- **A personal assistant you set up in one sentence** (*Set up my personal assistant*, *Build my Today page*). A
  scheduled Hermes job checks your mail and calendar every 30 minutes, through an MCP server with mail and calendar
  tools, or on a sample mailbox to try it out.
- **It keeps track.** Each check first reads what is already open, then opens, moves or closes items: bills,
  renewals, orders, events, replies owed, alerts. A close needs a reason and the mail that proves it (*Paid ·
  confirmation mail*), and changes nothing else about the item. Overdue, due today and due soon are worked out from
  the dates by the plugin, so a bill turns red at midnight without a check.
- **The Today page:** a band with the greeting, the weather and one sentence about the day; Up next cards with their
  state; a **Needs you / Handled** switch with a help button and Details on every item, and Reopen on what the
  assistant closed; and **Prepared for you**, photo ideas for a birthday, a guest or a trip.
- **Prepared ideas and pay links** come from a second job that searches the web and cannot read mail. A pay or
  renew link is kept only when it is on the site the bill came from. Optional, asked at setup.
- **A look-alike sender** asking for money or a login is flagged, gets no link and no ideas.
- **The sample mailbox** tells a two-act story (*Bring in the next sample mail*, *Reset the sample mailbox*), and
  costs no model calls while nothing new arrives.
- **Design my Today page:** one form for your name, city, prepared ideas, today's calendar, extra tabs and up to three
  sections from your MCP servers.
- The assistant never sends, pays, replies or deletes. Buttons on Today only fill the message box.

### Dashboards from your own data

- **Drawn in chat, kept in the sidebar.** Ask for a dashboard; it is drawn from your MCP servers and tools with a
  verdict, insights, tabs, charts and tables. **Keep in sidebar** (or *pin it to my sidebar*) makes that design a
  page.
- **Refresh** repeats exactly the tool calls that built the page and redraws the same layout, so unchanged data
  gives unchanged numbers. Only read-only calls are recorded. A page can refresh on a schedule you ask for.
- Briefs for executive, security and sales dashboards in `templates/`.

### Blocks and tools

- **New blocks:** `weather`, `upnext` and `calendar` (a day at a glance). Three more are drawn only on the Today
  page and are not offered to the model: `briefing`, `tracker`, `prepared`.
- `upnext` cards can carry a state (*Overdue · 1 day*) and a compact layout.
- Tiles may be plain facts with no action (#7). A tile's subtitle reads in up to three lines, cut between words,
  on a card that keeps its shape (#12).
- Checklist items may carry an `id`, so a tick follows the item.
- **New tools:** `dashboard` (Today's layout), `board_page` (kept pages), `assistant_setup`, `assistant_items`, and
  the jobs' own `assistant_open`, `assistant_inbox`, `assistant_calendar`, `assistant_report`, `assistant_ideas`.
- **New recipes:** `personal-assistant`, `today-designer`, `today-page`, `assistant-check`, `assistant-ideas`,
  `page-refresh`.
- The block description budget rises to 3,500 tokens.

### Where it works, and privacy

- **The Hermes Webapp** draws boards, Today and kept pages. The plugin has to be switched on in each browser and at
  each address; the README says how.
- **Not on iPhone or iPad yet:** the Hermes Webapp itself fails to render in every browser there
  (hermes-agent#148538), so nothing can be drawn. Safari on a Mac needs the README's one-line workaround.
- **`HERMES_GENUI_LOCAL_ONLY=1`** in a profile's `.env` turns off the real-mail assistant, prepared ideas and kept
  dashboards there, for profiles whose data must not go to a model on a schedule.
- The README lists what each new feature sends and stores.

### Fixes

- Boards drawn in one profile now load when their session is opened from another profile, and new board ids are
  unique across every profile on the machine (#6, #8).
- `market_history` builds its date labels without the glibc-only `%-d`, so 5-day to 3-month charts work on Windows
  (#1, #2).
- Docs: which surfaces draw boards, and the one that shows the raw tag (#3, #5, #9).

### Thanks

@apoapostolov (#1, #2), @Huy3ko (#3), @phild4747 (#7), @nubsors (#6), @zunami (#9) and @leosgarza (#10, #12).

## 0.2.0 — first public release

- **About 30 blocks:**
  - **charts:** line with gain/loss colouring, columns that turn sideways for rankings, donut, stacked, area, combo,
    heatmap;
  - **numbers and lists:** KPI cards with trend lines, sortable tables with mini bars;
  - **plans and media:** timelines, checklists that save ticks, photos, tiles, flash cards;
  - **interactive:** calculators with live charts, forms, buttons;
  - **explainers:** flow diagrams whose boxes hold what's in them and send packets as you step, step-by-step
    walkthroughs, simulations you play over time, and stacks drawn in light 3D;
  - **layouts:** columns, grid, tabs, sections, rows.
- **One shared hover card** on every chart, with keyboard support.
- **Short big numbers in the reader's own language:** 4.21B, 4,21 Mrd., ₹18.4L.
- **Recipes** for trips, comparisons, what-ifs, stock dashboards, dashboards, reports, learning, explainers and
  trackers. They install with the plugin and are read-only; a recipe builder saves your own.
- **`market_history`:** prices from Yahoo Finance, as a one-stock board or a comparison of up to 3.
- **`find_photos`:** photos from Wikimedia Commons, Openverse and page images from your web search, plus Unsplash,
  Pexels and Tavily with keys.
  - Fetches are https only and public addresses only, with redirects checked.
  - Recent searches are remembered.
  - A source that fails is rested for 10 minutes.
- **A text fallback** for Telegram, the CLI and other chat apps.
