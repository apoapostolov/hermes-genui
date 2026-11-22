import importlib
import json

import pytest

from conftest import ROOT, load_plugin_package

load_plugin_package()
tf = importlib.import_module("hermes_genui.hooks.text_fallback")
plugin_store = importlib.import_module("hermes_genui.core.store")

CATALOG = json.loads((ROOT / "core" / "catalog.json").read_text(encoding="utf-8"))
EXAMPLES = {entry["kind"]: entry["example"] for entry in CATALOG["blocks"]}


def render(*blocks: dict) -> str:
    return tf.blocks_as_text(list(blocks))


# --- atoms ----------------------------------------------------------------------------------------

def test_heading_is_bold():
    assert render({"type": "heading", "text": "Day 1 · Ooty"}) == "**Day 1 · Ooty**"


def test_text_is_the_text():
    assert render({"type": "text", "text": "Leaves at 7:10; **book early**."}) == "Leaves at 7:10; **book early**."


def test_blocks_are_separated_by_a_blank_line():
    assert render({"type": "heading", "text": "A"}, {"type": "text", "text": "b"}) == "**A**\n\nb"


def test_callout_is_a_quote():
    assert render({"type": "callout", "tone": "tip", "text": "Pixel for photos."}) == "> Pixel for photos."


def test_callout_with_title_and_lines_quotes_every_line():
    assert render({"type": "callout", "title": "Note", "text": "one\ntwo"}) == "> **Note**\n> one\n> two"


def test_source_is_italic():
    assert render({"type": "source", "text": "screener.in · TCS"}) == "_Source: screener.in · TCS_"


def test_source_with_url_links_it():
    out = render({"type": "source", "text": "screener", "url": "https://www.screener.in/x/"})
    assert out == "_Source: [screener](https://www.screener.in/x/)_"


def test_source_list_keeps_kind_accessed_and_note():
    out = render({"type": "source", "title": "Sources", "items": [
        {"label": "Screener", "url": "https://screener.in/x", "kind": "web",
         "accessed": "2026-11-17T14:32Z", "note": "Quarterly results"},
        {"label": "Local export", "kind": "file"},
    ]})
    assert out == (
        "**Sources**\n"
        "_Sources: [Screener](https://screener.in/x) [web] · accessed 2026-11-17 · Quarterly results · "
        "Local export [file]_"
    )


def test_source_list_falls_back_to_the_line_when_no_item_survives():
    out = render({"type": "source", "text": "screener.in", "url": "https://screener.in/x",
                  "items": [{"note": "no label"}]})
    assert out == "_Source: [screener.in](https://screener.in/x)_"


def test_source_list_reads_only_label_url_kind_accessed_and_note():
    out = render({"type": "source", "items": [{"name": "Screener", "accessed_at": "2026-11-17"}, {
        "label": "Screener", "src": "https://screener.in/x", "href": "https://screener.in/y",
        "accessed_at": "2026-11-17T09:00Z",
    }]})
    assert out == "_Sources: Screener_"


def test_divider():
    assert render({"type": "divider"}) == "---"


def test_badge():
    assert render({"type": "badge", "text": "Open now", "tone": "good"}) == "[Open now]"


def test_link():
    assert render({"type": "link", "text": "Book on IRCTC", "url": "https://www.irctc.co.in"}) == (
        "[Book on IRCTC](https://www.irctc.co.in)"
    )


def test_link_needs_https_else_text_only():
    assert render({"type": "link", "text": "Plain", "url": "http://example.com"}) == "Plain"


def test_javascript_url_is_dropped():
    assert render({"type": "link", "text": "Click", "url": "javascript:alert(1)"}) == "Click"
    out = render({"type": "image", "url": "javascript:alert(1)", "caption": "Pic"})
    assert "javascript" not in out
    assert "Pic" in out


def test_image():
    out = render({"type": "image", "url": "https://a.org/k.jpg", "caption": "Kyoto"})
    assert out == "![Kyoto](https://a.org/k.jpg)"


def test_image_without_caption_and_with_src_field():
    assert render({"type": "image", "src": "https://a.org/k.jpg"}) == "![image](https://a.org/k.jpg)"


def test_url_with_brackets_and_spaces_cannot_break_out():
    out = render({"type": "link", "text": "x", "url": "https://a.org/a b)(c"})
    assert out == "[x](https://a.org/a%20b%29%28c)"


def test_button_and_actions():
    assert render({"type": "button", "label": "Plan day 2", "run": "Plan day 2"}) == "Next: Plan day 2"
    actions = {"type": "actions", "items": [{"label": "Analyze", "run": "a"}, {"label": "Compare", "run": "b"}]}
    assert render(actions) == "Next: Analyze · Compare"


def test_button_with_url_is_a_link():
    assert render({"type": "button", "label": "Book", "url": "https://x.org"}) == "Next: [Book](https://x.org)"


# --- numbers --------------------------------------------------------------------------------------

def test_stat_with_change():
    assert render({"type": "stat", "label": "Saved", "value": 12500, "unit": "₹", "change": 8}) == (
        "Saved: 12,500 ₹ (▲ 8.0%)"
    )


def test_kpis_one_line_each():
    out = render(EXAMPLES["kpis"])
    assert out == "Revenue: 72,275 ₹Cr (▲ 2.9%)\nChurn: 2.4% (▼ 0.7 pt)"


def test_a_change_from_previous_is_what_the_card_draws():
    # The card computes the same change from the same pair: a share of the previous number, points on a "%" figure.
    assert render({"type": "stat", "label": "Down", "value": 80, "unit": "$", "previous": 100}) == (
        "Down: 80 $ (▼ 20.0%)"
    )
    assert render({"type": "stat", "label": "Margin", "value": 18.6, "unit": "%", "previous": 19.5}) == (
        "Margin: 18.6% (▼ 0.9 pt)"
    )
    assert render({"type": "stat", "label": "Up", "value": 120, "change_unit": "pt", "previous": 100}) == (
        "Up: 120 (▲ 20.0 pt)"
    )


def test_previous_wins_over_a_written_change():
    assert render({"type": "stat", "label": "Close", "value": 80, "previous": 100, "change": 2}) == (
        "Close: 80 (▼ 20.0%)"
    )


def test_a_change_needs_two_numbers():
    # previous null, a text value, or a percentage from zero: no chip at all, never a wrong one.
    assert render({"type": "stat", "label": "Close", "value": 80, "previous": None, "change": 2}) == "Close: 80"
    assert render({"type": "stat", "label": "Opponent", "value": "Leeds (H)", "previous": 2}) == "Opponent: Leeds (H)"
    assert render({"type": "stat", "label": "From zero", "value": 70, "previous": 0}) == "From zero: 70"


def test_a_change_of_zero_is_flat_not_missing():
    assert render({"type": "kpis", "items": [{"label": "Flat", "value": 5, "previous": 5}]}) == "Flat: 5 (0.0%)"


def test_a_change_tie_rounds_the_way_the_card_does():
    # The card's toFixed rounds 0.25 up; Python's own format would round the tie to even and print 0.2.
    assert render({"type": "stat", "label": "Close", "value": 1.25, "unit": "%", "previous": 1}) == (
        "Close: 1.25% (▲ 0.3 pt)"
    )


def test_the_fallback_rounds_a_tie_and_a_near_tie_like_the_card():
    # Both sides round the same stored double: 0.35 is just under 0.35 and prints 0.3, an exact tie goes up. The old
    # math.floor(v * 10 + 0.5) said 0.4 and 0.2 here, which the card never drew.
    tenths = importlib.import_module("hermes_genui.blocks.kpis")._tenths
    assert [tenths(v) for v in (0.35, 0.15, 2.25, 1.25, 2.922119, 12)] == [
        "0.3", "0.1", "2.3", "1.3", "2.9", "12.0"]
    assert render({"type": "stat", "label": "Close", "value": 80, "change": 0.35}) == "Close: 80 (▲ 0.3%)"


def test_a_written_change_keeps_its_percent_on_a_percent_card():
    # Only a change worked out from `previous` counts points; a written one keeps the meaning the model gave it.
    assert render({"type": "stat", "label": "Margin", "value": 18.6, "unit": "%", "change": 5}) == (
        "Margin: 18.6% (▲ 5.0%)"
    )
    assert render({"type": "stat", "label": "Margin", "value": 18.6, "unit": "%",
                   "change": 5, "change_unit": "pt"}) == "Margin: 18.6% (▲ 5.0 pt)"


def test_a_change_no_chip_can_print_leaves_the_line():
    # 1e308 passes the check and has no chip: the number is drawn and the movement is skipped, not raised.
    assert render({"type": "stat", "label": "Close", "value": 80, "change": 1e308}) == "Close: 80"
    assert render({"type": "kpis", "items": [{"label": "Close", "value": 80, "previous": 1e-300}]}) == "Close: 80"


def test_invert_tone_changes_no_text():
    # A card where a fall is good news (churn) prints the same chip; only the colour it gets changes.
    chip = {"label": "Churn", "value": 2.4, "unit": "%", "previous": 3.1}
    assert render({"type": "stat", **chip, "invert_tone": True}) == render({"type": "stat", **chip}) == (
        "Churn: 2.4% (▼ 0.7 pt)"
    )


def test_progress_and_bar():
    assert render(EXAMPLES["progress"]) == (
        "Budget used: 32,000 / 50,000 ₹. Rent 20,000 ₹, Food 12,000 ₹."
    )
    assert render({"type": "bar", "label": "Budget used", "value": 62}) == "Budget used: 62 / 100"
    assert render({"type": "bar", "label": "Food", "value": 7200, "max": 8000, "unit": "₹"}) == "Food: 7,200 / 8,000 ₹"
    # A null value is a figure nobody knows: "no data" in its place, never a 0.
    assert render({"type": "bar", "label": "Spent", "value": None, "max": 500, "unit": "₹"}) == "Spent: no data / 500 ₹"
    # A null goal keeps the value's unit, so ₹95 still says what it counts.
    assert render({"type": "progress", "title": "Level 5", "value": 95, "goal": None, "unit": "₹"}) == \
        "Level 5: 95 ₹ / no data"


def test_streak():
    assert render(EXAMPLES["streak"]) == "Current streak: 2 days"


# --- charts ---------------------------------------------------------------------------------------

def test_chart_first_to_last_per_series():
    out = render(EXAMPLES["chart"])
    assert out == (
        "**Revenue vs profit** (₹Cr): Revenue 67,087 → 72,275 (▲ 7.7%); Net profit 10,720 → 13,420 (▲ 25.2%)"
    )


def test_chart_starts_at_its_first_number_and_names_its_gaps():
    chart = {"type": "chart", "title": "T", "x": ["a", "b", "c"], "series": [{"name": "S", "data": [None, 0, 5]}]}
    # 0 is a measured start, so there is no % chip; the gap is named instead of being silently skipped.
    assert render(chart) == "**T**: S 0 → 5, 1 gap (a)"


def test_chart_caveat_is_a_second_italic_line():
    chart = {"type": "chart", "title": "T", "x": ["a", "b"], "series": [{"name": "S", "data": [1, 2]}],
             "caveat": "  Q3 onward is a projection.  "}
    assert render(chart) == "**T**: S 1 → 2 (▲ 100%)\n_Q3 onward is a projection._"


def test_pie_shows_top_slices_with_shares():
    pie = {"type": "chart", "kind": "donut", "title": "Mix", "x": ["A", "B", "C", "D", "E"],
           "series": [{"name": "Share", "data": [50, 20, 15, 10, 5]}]}
    assert render(pie) == "**Mix**: A 50%, B 20%, C 15%, D 10%, +1 more"


def test_chart_sort_desc_orders_the_text_by_the_first_series():
    chart = {"type": "chart", "kind": "bar", "sortDesc": True, "title": "Spend",
             "x": ["a", "b", "c"], "series": [{"name": "S", "data": [2, 9, 5]}]}
    assert render(chart) == "**Spend**: S 9 → 2 (▼ 77.8%)"
    assert render({**chart, "kind": "hbar"}) == "**Spend**: S 9 → 2 (▼ 77.8%)"


# --- tables ---------------------------------------------------------------------------------------

def test_table_is_markdown():
    out = render(EXAMPLES["table"])
    assert out == (
        "**Phones under ₹50k**\n"
        "| Phone | Price | Camera |\n"
        "| --- | --- | --- |\n"
        "| Pixel 10a | ₹44,999 | Best in class |\n"
        "| Nothing 4 | ₹39,999 | OK |"
    )


def test_table_escapes_pipes_and_keeps_12_rows():
    rows = [[f"r{i}", "a|b"] for i in range(15)]
    out = render({"type": "table", "columns": ["Name", "Val"], "rows": rows})
    assert "| r0 | a\\|b |" in out
    assert "r11" in out
    assert "r12" not in out
    assert out.endswith("_(3 more rows)_")


def test_table_rows_as_objects_and_short_rows():
    out = render({"type": "table", "columns": ["A", "B"], "rows": [{"A": 1, "B": 2.5}, ["x"]]})
    assert out.splitlines()[2:] == ["| 1 | 2.5 |", "| x |  |"]


def test_heatmap_is_a_compact_table():
    out = render(EXAMPLES["heatmap"])
    assert out == (
        "**Banks, % change** (%)\n"
        "|  | Q1 | Q2 |\n"
        "| --- | --- | --- |\n"
        "| JPM | 4.1 | -1.2 |\n"
        "| GS | 7.5 | 2.2 |"
    )


# --- robustness and safety ------------------------------------------------------------------------

def test_unknown_malformed_and_include_blocks_are_skipped():
    blocks = [{"type": "sundial"}, "not a block", None, {"type": "include", "id": "7f3a09bc"},
              {"type": "chart", "series": "nonsense"}, {"type": "table", "rows": 5},
              {"type": "text", "text": "kept"}]
    assert tf.blocks_as_text(blocks) == "kept"


def test_not_a_list_gives_empty_text():
    assert tf.blocks_as_text(None) == ""
    assert tf.blocks_as_text({"type": "text", "text": "x"}) == ""


def test_control_characters_are_stripped_and_strings_capped():
    out = render({"type": "text", "text": "a\x00b\x1b[31mc\u202ed" + "x" * 1000})
    assert out.startswith("ab\\[31mcd")  # the [ is escaped (Markdown marks in model text are shown, not followed)
    assert len(out) <= 301


# --- plans, photos, rows --------------------------------------------------------------------------

def test_timeline_groups_and_stops():
    timeline = {"type": "timeline", "title": "Kyoto", "groups": [
        {"label": "Day 1", "items": [{"time": "07:00", "title": "Fushimi Inari", "place": "Inari"},
                                     {"title": "Nishiki Market"}]},
        {"label": "Day 2", "items": [{"time": "08:30", "title": "Arashiyama"}]},
    ]}
    assert render(timeline) == (
        "**Kyoto**\n**Day 1**\n- 07:00 · Fushimi Inari (Inari)\n- Nishiki Market\n**Day 2**\n- 08:30 · Arashiyama"
    )


def test_timeline_flat_items():
    assert render({"type": "timeline", "items": [{"time": "9", "title": "Go"}]}) == "- 9 · Go"


def test_images_with_source_in_brackets():
    images = {"type": "images", "title": "Kyoto", "images": [
        {"url": "https://a.org/1.jpg", "caption": "Fushimi Inari", "source": "Wikimedia"},
        {"url": "ftp://a.org/2.jpg", "caption": "Gion"},
    ]}
    assert render(images) == "**Kyoto**\n![Fushimi Inari](https://a.org/1.jpg) [Wikimedia]\nGion"


def test_list_ranked_and_bulleted():
    assert render(EXAMPLES["list"]) == (
        "**Cafés nearby**\n1. Third Wave — 80 Feet Road · 4.5★\n2. Dyu Art Café — Garden seats · 4.4★"
    )
    plain = {"type": "list", "items": ["Plain", {"name": "Named", "value": 3}]}
    assert render(plain) == "- Plain\n- Named · 3"


def test_list_uses_the_bar_when_no_value_was_written():
    block = {"type": "list", "ranked": True, "items": [
        {"title": "Rent", "bar": 34500}, {"title": "Travel", "bar": 9800, "value": "9.8k"}]}
    assert render(block) == "1. Rent · 34,500\n2. Travel · 9.8k"


def test_list_prints_the_rows_own_value_where_the_card_shows_one():
    block = {"type": "list", "items": [
        {"title": "Rent", "price": "₹62,000", "bar": 62},
        {"title": "Food", "rating": 4.6, "bar": 90},
        {"title": "Travel", "bar": 30}]}
    assert render(block) == "- Rent · ₹62,000\n- Food · 4.6\n- Travel · 30"


def test_flip_cards():
    assert render(EXAMPLES["flip"]) == (
        "**Asian Games**\n- Q: Most golds? — A: China · 201\n- Q: Host city? — A: Nagoya"
    )


def test_checklist():
    assert render(EXAMPLES["checklist"]) == "**Packing**\n- [ ] Jacket\n- [ ] ID card (in progress)"


def test_checklist_states_read_as_words_beside_the_item():
    board = {"type": "checklist", "title": "Archive move", "items": [
        {"text": "Freeze writes", "done": True, "state": "blocked"},
        {"text": "Copy the 2019 shard", "state": "active", "owner": "Priya"},
        {"text": "Verify checksums", "state": "blocked", "note": "Waiting on the storage team"},
        {"text": "Announce the cutover", "state": "pending"},
        {"text": "Backfill the 2020 shard", "state": "skipped", "note": "Moved to March"},
        {"text": "Drop the old index", "state": "done"},
        {"text": "Checked in the UI", "checked": True},
    ]}
    assert render(board) == (
        "**Archive move**\n"
        "- [x] Freeze writes\n"
        "- [ ] Copy the 2019 shard (in progress, Priya)\n"
        "- [ ] Verify checksums (blocked: Waiting on the storage team)\n"
        "- [ ] Announce the cutover (not started)\n"
        "- [ ] Backfill the 2020 shard (skipped: Moved to March)\n"
        "- [x] Drop the old index\n"
        "- [x] Checked in the UI")


def test_checklist_note_alone_needs_no_word():
    assert render({"type": "checklist", "items": [{"text": "Ship", "note": "Friday"}]}) == "- [ ] Ship (Friday)"


def test_checklist_phase_tracker_reads_source_ids():
    board = {"type": "checklist", "density": "compact", "items": [
        {"text": "Publish", "state": "blocked", "sourceIds": ["src-1", "src-2"]}]}
    assert render(board) == "- [ ] Publish (blocked, sources src-1, src-2)"


def test_tiles():
    tiles = {"type": "tiles", "items": [{"title": "Arashiyama", "subtitle": "Bamboo", "ask": "a"},
                                        {"title": "Gion", "run": "b"}]}
    assert render(tiles) == "- Arashiyama: Bamboo\n- Gion"


def test_form_lists_fields_and_asks_for_a_message():
    assert render(EXAMPLES["form"]) == (
        "**Weekend**\n- Where: Hills (Hills / Beach)\n- Budget: 12 k\n(answer in a message)"
    )


def test_form_shows_group_headings_and_option_notes():
    form = {"type": "form", "title": "Goa weekend", "fields": [
        {"id": "dates", "kind": "text", "label": "Dates", "value": "14-16 Nov", "group": "The basics"},
        {"id": "people", "kind": "slider", "label": "Travellers", "value": 2, "group": "The basics"},
        {"id": "pace", "kind": "radio", "label": "Pace", "value": "easy", "group": "Your style", "options": [
            {"value": "easy", "label": "Easy", "note": "Beach, long lunches"}, "Full"]},
        {"id": "notes", "kind": "text", "label": "Anything else?", "multiline": True}]}
    assert render(form) == (
        "**Goa weekend**\nThe basics:\n- Dates: 14-16 Nov\n- Travellers: 2\nYour style:\n"
        "- Pace: Easy (Easy — Beach, long lunches / Full)\n- Anything else?\n(answer in a message)"
    )


# --- calculator -----------------------------------------------------------------------------------

def test_calculator_simple_formula_is_worked_out_at_starting_values():
    calc = {"type": "calculator",
            "inputs": [{"id": "price", "label": "Price", "value": 200, "unit": "₹"},
                       {"id": "qty", "label": "Qty", "min": 3, "max": 10}],
            "outputs": [{"label": "Total", "formula": "price * qty * (1 + 18 / 100)", "unit": "₹"},
                        {"label": "Each", "formula": "-price / -2"}]}
    assert render(calc) == "With Price 200 ₹, Qty 3:\n- Total: 708 ₹\n- Each: 100"


def test_calculator_helper_formula_points_to_desktop():
    out = render(EXAMPLES["calculator"])
    assert out == "With Loan 4,000,000 ₹, Rate % 8.5, Years 20:\n- EMI: open in Hermes Desktop for the live calculator"


@pytest.mark.parametrize("formula", ["a / 0", "a +", "(a", "a ^ 2", "unknown * 2", "__import__('os')", "a" + "+a" * 400,
                                     "(" * 300 + "a" + ")" * 300, "1e999 * 1e999"])
def test_calculator_never_evaluates_anything_odd(formula):
    calc = {"type": "calculator", "inputs": [{"id": "a", "label": "A", "value": 2}],
            "outputs": [{"label": "R", "formula": formula}]}
    assert render(calc).endswith("- R: open in Hermes Desktop for the live calculator")


def test_arithmetic_parser():
    assert tf.arithmetic("2 + 3 * (4 - 1) / 2", {}) == 6.5
    assert tf.arithmetic("-x + 1.5", {"x": 1}) == 0.5
    assert tf.arithmetic("x y", {"x": 1, "y": 2}) is None


# --- containers -----------------------------------------------------------------------------------

def test_row_grid_columns_give_children_in_order():
    assert render(EXAMPLES["row"]) == "Spent: 18,400 ₹\n\nLeft: 6,600"
    assert render(EXAMPLES["grid"]) == "Food: 7,200 / 8,000 ₹\n\nPacked: 6 / 9"


def test_section_title_then_children():
    section = {"type": "section", "title": "Prices", "children": [EXAMPLES["table"], {"type": "text", "text": "ok"}]}
    out = render(section)
    assert out.startswith("**Prices**\n\n**Phones under ₹50k**\n| Phone | Price | Camera |")
    assert out.endswith("| Nothing 4 | ₹39,999 | OK |\n\nok")


def test_tabs_columns_chart_nesting():
    tabs = {"type": "tabs", "tabs": [
        {"label": "TCS", "children": [EXAMPLES["columns"]]},
        {"label": "Infosys", "children": [{"type": "text", "text": "later"}]},
    ]}
    assert render(tabs) == (
        "**TCS**\n\n**Revenue, $B**: Revenue 90.2 → 102.3 (▲ 13.4%)\n\n"
        "| Quarter | Margin |\n| --- | --- |\n| Q2 | 34% |\n\n**Infosys**\n\nlater"
    )


def test_a_broken_child_is_skipped_but_its_siblings_stay():
    row = {"type": "row", "children": [{"type": "stat", "label": "A", "value": 1}, {"type": "chart", "series": 3},
                                       ["junk"], {"type": "badge", "text": "B"}]}
    assert render(row) == "A: 1\n\n[B]"


# --- length cap -----------------------------------------------------------------------------------

def test_long_board_is_cut_at_a_block_boundary():
    blocks = [{"type": "text", "text": f"{i:03d} " + "x" * 200} for i in range(40)]
    out = tf.blocks_as_text(blocks)
    assert len(out) <= 3500
    assert out.endswith("\n\n… (more in Hermes Desktop)")
    kept = out.split("\n\n")[:-1]
    assert all(len(piece) == 204 for piece in kept)


def test_one_huge_block_keeps_its_first_lines():
    rows = [["x" * 80] * 8 for _ in range(12)]
    out = render({"type": "table", "columns": ["c"] * 8, "rows": rows})
    assert len(out) <= 3500
    assert out.startswith("| c |")
    assert out.endswith("… (more in Hermes Desktop)")


@pytest.mark.parametrize("kind", [k for k in EXAMPLES if k != "include"])
def test_every_catalog_example_renders(kind):
    out = render(EXAMPLES[kind])
    assert isinstance(out, str) and out.strip()


def test_catalog_covers_every_renderer():
    kinds = set(EXAMPLES) - {"include"}
    assert kinds <= set(tf.RENDERERS) | set(tf.CONTAINERS) | {"tabs"}


# --- tags in a reply ------------------------------------------------------------------------------

BOARD = [{"type": "heading", "text": "Kyoto"}, {"type": "stat", "label": "Days", "value": 3}]
BOARDS = {"7f3a09bc": BOARD}
NOT_SHOWN = "(a visual that only shows in Hermes Desktop)"


def test_replace_tags_swaps_each_tag_line_for_its_board():
    reply = 'Here is the plan.\n  ::blocks{id="7f3a09bc"}  \nEnjoy!'
    assert tf.replace_tags(reply, load=BOARDS.get) == "Here is the plan.\n**Kyoto**\n\nDays: 3\nEnjoy!"


def test_replace_tags_bad_or_missing_board():
    calls = []

    def load(block_id):
        calls.append(block_id)
        return None

    reply = '::blocks{id="0badc0de"}\n::blocks{id="../etc"}\n::blocks{id="ABCDEF12"}'
    assert tf.replace_tags(reply, load=load) == "\n".join([NOT_SHOWN] * 3)
    assert calls == ["0badc0de"]


def test_replace_tags_board_with_nothing_readable_or_a_load_error():
    assert tf.replace_tags('::blocks{id="7f3a09bc"}', load=lambda _: [{"type": "sundial"}]) == NOT_SHOWN

    def broken(_):
        raise ValueError("bad json")

    assert tf.replace_tags('::blocks{id="7f3a09bc"}', load=broken) == NOT_SHOWN


def test_replace_tags_leaves_text_without_tags_and_inline_mentions_alone():
    text = 'Use ::blocks{id="7f3a09bc"} in a sentence.\nNo tag here.'
    assert tf.replace_tags(text, load=BOARDS.get) == text


def test_replace_tags_does_not_rescan_board_text():
    board = [{"type": "text", "text": '::blocks{id="7f3a09bc"}'}]
    out = tf.replace_tags('::blocks{id="11111111"}', load={"11111111": board, **BOARDS}.get)
    assert out == '::blocks{id="7f3a09bc"}'


# --- the transform_llm_output hook ----------------------------------------------------------------

@pytest.fixture
def stored(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin_store, "default_root", lambda: tmp_path)
    return plugin_store.save(BOARD, root=tmp_path)


@pytest.mark.parametrize("platform", ["local", "desktop", "Desktop"])
def test_text_only_leaves_desktop_alone(stored, platform):
    reply = f'Plan:\n::blocks{{id="{stored}"}}'
    assert tf.text_only(response_text=reply, session_id="s", model="m", platform=platform) is None


@pytest.mark.parametrize("platform", ["telegram", "cli", "discord", ""])
def test_text_only_swaps_tags_elsewhere(stored, platform):
    reply = f'Plan:\n::blocks{{id="{stored}"}}'
    assert tf.text_only(response_text=reply, session_id="s", model="m", platform=platform) == (
        "Plan:\n**Kyoto**\n\nDays: 3"
    )


def test_text_only_without_a_tag_is_none(stored):
    assert tf.text_only(response_text="Just words.", platform="telegram") is None
    assert tf.text_only(platform="telegram") is None
    assert tf.text_only(response_text=None, platform="telegram") is None


def test_text_only_missing_board(stored):
    assert tf.text_only(response_text='::blocks{id="0badc0de"}', platform="telegram") == NOT_SHOWN


# --- Markdown links and images in the model's text are shown, not followed -------------------------------------------


def test_a_link_in_text_is_inert():
    assert render({"type": "text", "text": "Click [here](javascript:alert(1))"}) == \
        "Click \\[here\\](javascript:alert(1))"


def test_an_image_in_text_is_inert():
    assert render({"type": "text", "text": "![x](http://evil/p.png)"}) == "!\\[x\\](http://evil/p.png)"


def test_html_and_autolinks_in_text_are_inert():
    assert render({"type": "text", "text": "<http://evil> <img src=x>"}) == "\\<http://evil\\> \\<img src=x\\>"


def test_a_backslash_cant_undo_the_escaping():
    assert render({"type": "text", "text": "\\[x\\](javascript:a)"}) == "\\\\\\[x\\\\\\](javascript:a)"


def test_links_in_other_blocks_text_are_inert():
    out = render({"type": "heading", "text": "[a](https://evil)"}, {"type": "list", "items": ["![p](https://evil/p)"]},
                 {"type": "callout", "text": "[c](https://evil)"})
    assert "](" not in out.replace("\\](", "") and "[a]" not in out


def test_a_links_label_cant_carry_a_link():
    out = render({"type": "link", "text": "[x](https://evil)", "url": "https://good.example"})
    assert out == "[\\[x\\](https://evil)](https://good.example)"
    out = render({"type": "image", "url": "https://a.org/k.jpg", "caption": "![y](https://evil)"})
    assert out == "![!\\[y\\](https://evil)](https://a.org/k.jpg)"


def test_ordinary_punctuation_reads_normally():
    common = importlib.import_module("hermes_genui.blocks.common")
    assert common.safe_text("Revenue (Q3) rose 25%!") == "Revenue (Q3) rose 25%!"
    assert "\\[" in common.safe_text("[here](javascript:x)")


# --- flow and steps -------------------------------------------------------------------------------

def test_flow_is_a_numbered_list_with_notes_and_its_repeat_frame():
    flow = {"type": "flow", "id": "tf", "title": "Next word", "nodes": [
        {"id": "tokens", "label": "Tokens", "note": "Text split into **pieces**."},
        {"id": "attn", "label": "Attention"},
        {"id": "ffn", "label": "Feed-forward", "note": "[x](javascript:y)"},
        {"id": "next", "label": "Next word"},
    ], "groups": [{"label": "Repeated × 12 layers", "nodes": ["attn", "ffn"]}]}
    assert render(flow) == (
        "**Next word**\n"
        "1. Tokens — Text split into **pieces**.\n"
        "2. Attention\n"
        "3. Feed-forward — \\[x\\](javascript:y)\n"
        "4. Next word\n"
        "_Repeated × 12 layers: steps 2-3_"
    )


def test_flow_without_labels_is_empty():
    assert render({"type": "flow", "nodes": [{"id": "a"}, "b"]}) == ""


def test_steps_are_numbered_paragraphs():
    steps = {"type": "steps", "title": "Step by step", "for": "tf", "items": [
        {"title": "Split the text", "text": "Into **tokens**.", "node": "tokens"},
        {"title": "Attend"},
        {"text": "no title, skipped"},
    ]}
    assert render(steps) == (
        "**Step by step**\n\n"
        "**Step 1 of 2 · Split the text**\nInto **tokens**.\n\n"
        "**Step 2 of 2 · Attend**"
    )


def test_flow_lists_what_each_box_holds_and_the_repeat_count():
    flow = {"type": "flow", "nodes": [
        {"id": "tok", "label": "Tokens", "holds": ["The", {"text": "it", "tone": "accent"}]},
        {"id": "attn", "label": "Attention"},
    ], "groups": [{"label": "Repeated", "nodes": ["attn"], "count": 6}]}
    assert render(flow) == "1. Tokens (holds: The, it)\n2. Attention\n_Repeated × 6: step 2_"


def test_steps_say_what_each_step_changes_using_the_flow_labels():
    nodes = [{"id": "tok", "label": "Tokens"}, {"id": "emb", "label": "Embeddings"}]
    flow = {"type": "flow", "id": "tf", "nodes": nodes}
    steps = {"type": "steps", "for": "tf", "items": [
        {"title": "Embed", "text": "Each token becomes a vector.", "node": "emb", "send": True,
         "holds": {"emb": ["[.2 …]", {"text": "[.8 …]", "tone": "accent"}], "ghost": ["x"]}},
        {"title": "Again", "node": "emb", "tick": 5},
    ]}
    assert render(flow, {"type": "section", "title": "Walk", "children": [steps]}).split("\n\n")[2:] == [
        "**Step 1 of 2 · Embed**\nEach token becomes a vector.\n"
        "Embeddings now holds: \\[.2 …\\], \\[.8 …\\]\nghost now holds: x",
        "**Step 2 of 2 · Again**\nThe repeated part runs 5 more times.",
    ]


def test_steps_without_a_flow_on_the_board_name_the_node_id():
    steps = {"type": "steps", "for": "tf", "items": [{"title": "A", "holds": {"emb": ["v"]}}, {"title": "B"}]}
    assert render(steps) == "**Step 1 of 2 · A**\nemb now holds: v\n\n**Step 2 of 2 · B**"
