"""The menu design (#42): show_blocks carries a short menu, and block_guide returns the fields and example of the blocks
the model is about to use. Switched on with HERMES_GENUI_GUIDE=menu while it is measured against the full guide."""

import importlib
import json
import re

from conftest import ROOT, load_plugin_package

load_plugin_package()
catalog_text = importlib.import_module("hermes_genui.core.catalog_text")
block_guide = importlib.import_module("hermes_genui.tools.block_guide")
show_blocks = importlib.import_module("hermes_genui.tools.show_blocks")

CATALOG = json.loads((ROOT / "core" / "catalog.json").read_text(encoding="utf-8"))


def test_the_menu_names_every_block_in_the_catalog():
    menu = catalog_text.menu()
    missing = [b["kind"] for b in CATALOG["blocks"] if not re.search(rf"\b{b['kind']}\b", menu)]
    assert missing == []


def test_each_blocks_spec_stays_readable():
    # A spec is sent only when its block is drawn, so a field costs only its own block; this keeps each one short
    # enough to read in one go (the calculator, the longest, is about 1,150).
    long = [(b["kind"], len(catalog_text.spec(b["kind"]))) for b in CATALOG["blocks"]
            if len(catalog_text.spec(b["kind"])) > 1500]
    assert long == []


def test_the_menu_is_a_fraction_of_the_full_guide():
    assert len(catalog_text.menu()) <= 3000
    assert len(catalog_text.menu()) * 4 < len(catalog_text.describe())


NEXT = "\n\nNow call show_blocks once, with all your blocks in order."


def test_block_guide_returns_each_blocks_spec_in_order_then_the_next_step():
    out = block_guide.block_guide({"blocks": ["table", "chart"]})
    assert out == catalog_text.spec("table") + "\n\n" + catalog_text.spec("chart") + NEXT


def test_a_spec_starts_with_the_blocks_exact_shape():
    # Models that read only "Fields: ..." left "type" out; the spec says how a block starts.
    assert catalog_text.spec("chart").startswith('chart: write {"type": "chart", ...}. Fields: kind')


def test_block_guide_lists_the_icons_once_when_a_block_takes_one():
    out = block_guide.block_guide({"blocks": ["timeline", "flow"]})
    assert out.count("\nIcons (only these): mail, rupee, ") == 1
    assert "Icons (only these)" not in block_guide.block_guide({"blocks": ["table"]})


def test_block_guide_takes_a_single_name_and_skips_repeats():
    assert block_guide.block_guide({"blocks": "chart"}) == catalog_text.spec("chart") + NEXT
    assert block_guide.block_guide({"blocks": ["chart", "chart"]}) == catalog_text.spec("chart") + NEXT


def test_block_guide_names_what_it_doesnt_know():
    out = block_guide.block_guide({"blocks": ["chart", "sundial"]})
    assert out.startswith(catalog_text.spec("chart"))
    assert 'No block named "sundial". Pick names from the show_blocks menu.' in out
    assert block_guide.block_guide({}) == "Give the block names from the show_blocks menu, e.g. [\"chart\", \"table\"]."


def test_the_menu_schema_carries_the_menu_and_the_full_one_the_guide():
    menu = show_blocks.schema("menu")["description"]
    full = show_blocks.schema("full")["description"]
    assert catalog_text.menu() in menu and catalog_text.describe() not in menu
    assert catalog_text.describe() in full
    assert show_blocks.schema("menu") == show_blocks.SHOW_BLOCKS_SCHEMA  # the menu is the default


def test_the_menu_guide_adds_one_hint_to_the_system_section_within_its_cap():
    prompt = importlib.import_module("hermes_genui.hooks.prompt_section")
    recipes = importlib.import_module("hermes_genui.core.recipes").shipped()
    menu_rule = prompt.draw_rule(recipes, guide="menu")
    assert "block_guide" in menu_rule and len(menu_rule) <= prompt.MAX_CHARS
    assert "block_guide" not in prompt.draw_rule(recipes, guide="full")  # the full guide is unchanged


def test_the_menu_guide_reminder_asks_for_fields_first():
    nudge = importlib.import_module("hermes_genui.hooks.visual_nudge")
    assert "block_guide" in nudge.MENU_REMINDER and "block_guide" not in nudge.REMINDER


def test_block_guide_is_registered_only_with_the_menu_guide():
    tools = importlib.import_module("hermes_genui.tools")
    assert [t.name for t in tools.tools_for("menu")][:2] == ["show_blocks", "block_guide"]
    assert "block_guide" not in [t.name for t in tools.tools_for("full")]
    assert tools.tools_for("full") == tools.TOOLS


def test_the_menu_leads_with_three_judgment_lines():
    """The recipe the model opens can't carry cross-cutting judgment (it may not open it at all), so the strongest
    tips live at the top of the menu, which show_blocks carries into every draw (PR #53 feedback)."""
    menu = catalog_text.menu()
    head, _, blocks = menu.partition("\nData\n")
    assert blocks, "the menu still lists the blocks after the head"
    for tip in ("Lead with the answer", "A plain board is a fine answer", "Never decorate just to decorate"):
        assert tip in head, f"the menu head is missing: {tip}"
