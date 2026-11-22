---
name: compare
description: "Compare 2-4 options side by side. Use for compare, X vs Y, which is better, pick between phones, plans, places, cars or stocks; also best way to and how should I questions. Show tradeoffs before the verdict; use tabs for optional details."
version: 0.1.0
platforms: [linux, macos, windows]
---
# Compare

Use this for explicit comparisons ("X vs Y") and recommendation questions ("what is the best way to...",
"how should I...", "which approach fits?") when materially different approaches serve the goal. Respect the
requested workflow: if proposing an alternative, identify how it differs before recommending it.
For one stock in depth, use `stock-dashboard`; for 5 or more options, a ranked `list` or a single `table` is clearer.

## Steps

1. **Get the facts.** Use what the user gave, then web search for prices and specs. For stocks, call
   `market_history` with the symbols comma separated (`"TCS, INFY"`, up to 3) and keep the board id it returns.
   Note where each number came from. Never guess a number; write "not found" instead.
2. **Pick 2-5 deciding criteria** that suit the question (e.g. storage ownership, sharing and effort for a workflow;
   price, battery and updates for phones). Use the same criteria for each option. Do not invent numeric KPIs.
3. **Make the comparison visible immediately.** With one `show_blocks` call, prefer:
   - a `heading` naming the decision;
   - a `table` with options as rows and key criteria as columns (or a `columns` block with concise option
     text cards when qualitative distinctions need more room);
   - a concise recommendation after the comparison, with the key assumption or caveat;
   - a `source` line for outside facts.
   - For stocks, put `{"type": "include", "id": "<market_history id>"}` on the board using the id from step 1.
     Its board already contains the price cards and % change line; do not duplicate them.
   - Use `tabs` only for optional deep dives when each option has substantial unique detail. Never put the
     essential side-by-side comparison behind a Compare tab.
   - Add `kpis` only for sourced numeric values that matter; add a chart only when real comparable trends
     materially change the decision. Do not manufacture metrics or a chart to fill a template.
   - State the verdict once, close to the tradeoffs. Do not repeat it in the opening reply, a highlighted callout,
     and closing prose. Save prominent callouts for material risks or exceptions.
   - For short procedural next steps, use concise reply text or a numbered checklist. Avoid decorative list cards
     whose avatar initials or icons have no meaning; do not create a second large board for a few routine steps.
   - Avoid repeating the same points in tabs, tables, callouts and reply prose.
4. **Reply** with one sentence, then the tag on its own line.

## Recommended default (two approaches to a workflow)

```json
[
  {"type": "heading", "text": "Choose how to organize existing photos"},
  {"type": "table", "columns": ["Approach", "Keeps original folders", "Album sharing"],
   "rows": [["Upload copies", "Originals remain; Immich stores copies", "Normal Immich albums"],
            ["External library", "Immich indexes folders in place", "Albums require additional organization"]]},
  {"type": "text", "text": "**Recommendation:** Upload copies if the priority is ordinary Immich-managed albums; use an external library if keeping files in place is the priority."}
]
```

## Optional deeper-dive layout (two phones the user is choosing between)

```json
[
  {"type": "heading", "text": "Pixel 10a vs Nothing Phone 4"},
  {"type": "tabs", "tabs": [
    {"label": "Pixel 10a", "children": [
      {"type": "kpis", "items": [
        {"label": "Price", "value": 44999, "unit": "₹"},
        {"label": "Battery", "value": 5100, "unit": "mAh"},
        {"label": "Updates", "value": 7, "unit": "years"}
      ]},
      {"type": "text", "text": "**Best camera** in the range and the longest updates. Slower charging."}
    ]},
    {"label": "Nothing Phone 4", "children": [
      {"type": "kpis", "items": [
        {"label": "Price", "value": 39999, "unit": "₹"},
        {"label": "Battery", "value": 5000, "unit": "mAh"},
        {"label": "Updates", "value": 5, "unit": "years"}
      ]},
      {"type": "text", "text": "**Cheaper** with a brighter screen and fast charging. Camera is only OK."}
    ]},
    {"label": "Compare", "children": [
      {"type": "kpis", "items": [
        {"label": "Pixel 10a", "value": 44999, "unit": "₹", "trend": [47999, 46999, 45999, 44999]},
        {"label": "Nothing Phone 4", "value": 39999, "unit": "₹", "trend": [44999, 42999, 41999, 39999]}
      ]},
      {"type": "table", "caption": "Side by side", "columns": ["Phone", "Price", "Battery", "Updates", "Camera"],
       "highlight": {"row": 0},
       "rows": [["Pixel 10a", "₹44,999", "5,100 mAh", "7 years", "Best in class"],
                ["Nothing Phone 4", "₹39,999", "5,000 mAh", "5 years", "OK"]]},
      {"type": "chart", "kind": "line", "title": "Price since launch (% change)", "unit": "%", "figure": false,
       "x": ["Jul", "Aug", "Sep", "Oct"],
       "series": [{"name": "Pixel 10a", "data": [0, -2.1, -4.2, -6.3]},
                  {"name": "Nothing Phone 4", "data": [0, -4.4, -6.7, -11.1]}]}
    ]}
  ]},
  {"type": "callout", "tone": "info", "title": "Verdict", "text": "Pixel if photos and long support matter; Nothing if price and charging speed do."},
  {"type": "source", "text": "store.google.com · nothing.tech · gsmarena.com"}
]
```

## Rules

- Blocks only: never write HTML or use `::preview` for a comparison.
- Numbers and photo URLs only from tools, search or the user. Stock prices only through `market_history`'s board.
- Tabs, when used for optional detail: 2-6, top level only, labels up to 30 characters. Keep each one short.
  `kpis` take up to 4 items; `columns` 2-3 children.
- Highlight one winner only when the facts make it clear; otherwise leave `highlight` out and say "it depends".
- No buy or sell advice for stocks.
- Keep words short around the tag; the tabs carry the detail.
