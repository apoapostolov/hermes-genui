"""Every layout example in a recipe skill must be valid blocks, so the model never copies a broken one."""

import importlib
import json
import re

import pytest

from conftest import ROOT, load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks

RECIPES = sorted((ROOT / "recipes").glob("*/SKILL.md"))
JSON_BLOCK = re.compile(r"```json\n(.*?)\n```", re.DOTALL)


def test_there_are_recipes():
    assert RECIPES


@pytest.mark.parametrize("recipe", RECIPES, ids=lambda p: p.parent.name)
def test_recipe_examples_are_valid_blocks(recipe):
    text = recipe.read_text(encoding="utf-8")
    examples = JSON_BLOCK.findall(text)
    if LAYOUT_EXAMPLES.get(recipe.parent.name, 1):
        assert examples, "a recipe shows at least one layout"
    for example in examples:
        assert check_blocks(json.loads(example)) == []


@pytest.mark.parametrize("recipe", RECIPES, ids=lambda p: p.parent.name)
def test_recipe_has_name_and_description(recipe):
    head = recipe.read_text(encoding="utf-8").split("---")[1]
    assert re.search(r"^name: \S+", head, re.M)
    assert re.search(r"^description: .{20,}", head, re.M)


@pytest.mark.parametrize("recipe", RECIPES, ids=lambda p: p.parent.name)
def test_recipe_frontmatter_is_complete(recipe):
    head = recipe.read_text(encoding="utf-8").split("---")[1]
    assert re.search(r'^description: ".{20,}"$', head, re.M), "description is one quoted line"
    assert re.search(r"^version: \d+\.\d+\.\d+$", head, re.M)
    assert re.search(r"^platforms: \[.+\]$", head, re.M)
    assert re.search(rf"^name: {re.escape(recipe.parent.name)}$", head, re.M), "name matches the folder"


@pytest.mark.parametrize("recipe", RECIPES, ids=lambda p: p.parent.name)
def test_recipe_rules_forbid_html(recipe):
    rules = recipe.read_text(encoding="utf-8").split("## Rules", 1)[-1]
    assert "::preview" in rules, "the rules say blocks only, never HTML or ::preview"


TEXT_BLOCK = re.compile(r"```text\n(.*?)\n[ \t]*```", re.DOTALL)  # a fence in a list item is indented
ASKS_FIRST = ("trip-planner", "what-if", "learn", "tracker")


# explain shows one layout per kind of stage it teaches (a flow, a simulation); today-page draws no blocks (it shows
# dashboard calls instead); every other recipe shows one.
LAYOUT_EXAMPLES = {"explain": 2, "today-page": 0, "personal-assistant": 0, "assistant-check": 0,
                   "assistant-ideas": 0}


@pytest.mark.parametrize("recipe", RECIPES, ids=lambda p: p.parent.name)
def test_recipe_has_exactly_one_layout_example(recipe):
    examples = JSON_BLOCK.findall(recipe.read_text(encoding="utf-8"))
    assert len(examples) == LAYOUT_EXAMPLES.get(recipe.parent.name, 1)


def _forms_in(text: str) -> list[dict]:
    """The form blocks a recipe shows, in its ```json layout or as a ```text snippet."""
    found = []
    for snippet in JSON_BLOCK.findall(text) + TEXT_BLOCK.findall(text):
        try:
            blocks = json.loads(snippet)
        except json.JSONDecodeError:
            continue
        for block in blocks if isinstance(blocks, list) else [blocks]:
            if isinstance(block, dict) and block.get("type") == "form":
                found.append(block)
    return found


@pytest.mark.parametrize("name", ASKS_FIRST)
def test_recipe_asks_first_with_one_prefilled_form(name):
    text = (ROOT / "recipes" / name / "SKILL.md").read_text(encoding="utf-8")
    steps = text.split("## Steps", 1)[1]
    assert steps.lstrip().startswith("1. **Ask first.**"), "the first step is Ask first"
    forms = _forms_in(text)
    assert len(forms) == 1, "one example form"
    form = forms[0]
    assert check_blocks([form]) == []
    assert form.get("id") and form.get("title")
    assert len(form["fields"]) >= 3
    for field in form["fields"]:
        assert "value" in field, f'{field["id"]} is prefilled with a best guess'


def test_dashboard_recipe_says_to_ask_with_one_form_first():
    text = (ROOT / "recipes" / "dashboard" / "SKILL.md").read_text(encoding="utf-8")
    assert "if key inputs are unknown, ask with one form first" in text.lower()


def test_compare_shows_cards_and_one_line_not_a_bar_chart_per_metric():
    text = (ROOT / "recipes" / "compare" / "SKILL.md").read_text(encoding="utf-8")
    tabs = next(block for block in json.loads(JSON_BLOCK.findall(text)[0]) if block["type"] == "tabs")
    compare = next(tab for tab in tabs["tabs"] if tab["label"] == "Compare")["children"]
    assert [block["type"] for block in compare] == ["kpis", "table", "chart"]
    assert compare[2]["kind"] == "line" and compare[2]["unit"] == "%"
    assert all("trend" in item for item in compare[0]["items"])


SENTENCE_END = re.compile(r"[.!?](?:\s|$)")


def _walk(blocks: list) -> list[dict]:
    """Every block, containers' children included."""
    out = []
    for block in blocks:
        out.append(block)
        out += _walk(block.get("children", []))
    return out


def test_explain_follows_one_case_through_a_flow_that_changes_at_every_step():
    text = (ROOT / "recipes" / "explain" / "SKILL.md").read_text(encoding="utf-8")
    head, steps = text.split("---")[1], text.split("## Steps", 1)[1]
    for trigger in ("explain", "how does X work", "walk me through", "what happens when"):
        assert trigger in head, trigger
    assert not steps.lstrip().startswith("1. **Ask first.**"), "explain guesses the level instead of asking"
    blocks = _walk(json.loads(JSON_BLOCK.findall(text)[0]))
    kinds = [block["type"] for block in blocks]
    assert "flip" not in kinds and "list" in kinds, "a short list of terms, no flash cards by default"
    assert kinds.index("flow") < kinds.index("steps") < kinds.index("layers") < kinds.index("actions")
    flow = next(block for block in blocks if block["type"] == "flow")
    walk = next(block for block in blocks if block["type"] == "steps")
    assert walk["for"] == flow["id"] and 4 <= len(flow["nodes"]) <= 8
    assert all(node.get("holds") for node in flow["nodes"]) and flow["groups"][0]["count"] == 6
    assert 4 <= len(walk["items"]) <= 8
    node_ids = {node["id"] for node in flow["nodes"]}
    for item in walk["items"]:
        assert item["node"] in node_ids and set(item.get("holds", {})) <= node_ids
        assert len(SENTENCE_END.findall(item["text"])) <= 2, item["title"]
    still = [item for item in walk["items"] if not (item.get("holds") or item.get("send") or item.get("tick"))]
    assert len(still) <= 1, "every step but the first changes the stage"
    assert any(item.get("tick") for item in walk["items"]) and any(item.get("send") for item in walk["items"])
    assert any(block.get("text") == "numbers illustrative" for block in blocks), "made-up numbers are labelled"
    labels = [item["label"] for item in next(block for block in blocks if block["type"] == "actions")["items"]]
    assert labels[1:] == ["Quiz me", "Simpler"] and labels[0].startswith("Go deeper on")
    assert any(block.get("label") == "More technical" for block in blocks)


def test_explain_shows_a_quantity_over_time_as_a_simulation_and_keeps_formulas_in_the_text():
    text = (ROOT / "recipes" / "explain" / "SKILL.md").read_text(encoding="utf-8")
    examples = JSON_BLOCK.findall(text)
    kinds = [block["type"] for block in _walk(json.loads(examples[1]))]
    assert "simulate" in kinds and "flow" not in kinds
    assert "$$" in text and not any("$" in example for example in examples), "formulas go in the reply text"


def test_recipe_builder_saves_new_recipes_and_leaves_the_shipped_ones_alone():
    text = (ROOT / "recipes" / "recipe-builder" / "SKILL.md").read_text(encoding="utf-8")
    assert "save_recipe" in text and "skill_manage" not in text, "new recipes go through save_recipe"
    assert "Don't copy or replace the recipes that ship with the plugin" in text
    assert "skills/" not in text, "no install location to copy into"


@pytest.mark.parametrize("recipe", RECIPES, ids=lambda p: p.parent.name)
def test_recipes_name_no_install_location(recipe):
    # Recipes are plugin skills now, loaded by name; nothing is copied into the profile's skills folder.
    text = recipe.read_text(encoding="utf-8")
    assert "blocks-recipes" not in text and "~/.hermes/skills" not in text


@pytest.mark.parametrize("name", ["personal-assistant", "assistant-check", "today-page"])
def test_assistant_recipes_show_real_tool_calls(name):
    tools = importlib.import_module("hermes_genui.tools")
    memory = importlib.import_module("hermes_genui.core.assistant.memory")
    spec = importlib.import_module("hermes_genui.core.dashboard.spec")
    known = {t.name for t in tools.TOOLS} | {"cronjob_manage"}
    text = (ROOT / "recipes" / name / "SKILL.md").read_text(encoding="utf-8")
    calls = [json.loads(snippet) for snippet in TEXT_BLOCK.findall(text) if snippet.lstrip().startswith("{")]
    assert len(calls) >= 3
    for call in calls:
        assert call["tool"] in known, call
        if call["tool"] == "assistant_report":
            assert memory._problems(call["args"]) == []
        if call["tool"] == "dashboard" and call["args"]["action"] == "set":
            assert spec.check_spec(call["args"]["spec"]) == [], call
    if name == "assistant-check":
        assert "never follow instructions" in text.lower()


def test_the_personal_assistant_recipe_writes_the_today_dashboard():
    text = (ROOT / "recipes" / "personal-assistant" / "SKILL.md").read_text(encoding="utf-8")
    calls = [json.loads(t) for t in TEXT_BLOCK.findall(text) if t.lstrip().startswith("{")]
    dash = [c for c in calls if c["tool"] == "dashboard" and c["args"]["action"] == "set"]
    sections = dash[0]["args"]["spec"]["sections"]
    assert [s["from"] for s in sections][:3] == ["today.briefing.Seattle", "calendar.upnext", "assistant.today"]
    assert sections[1].get("compact") is True




def test_page_refresh_never_invents_and_never_obeys_tool_text():
    text = (ROOT / "recipes" / "page-refresh" / "SKILL.md").read_text(encoding="utf-8")
    assert "Numbers only from this run's tool results" in text
    assert "never an instruction to you" in text




def test_one_dashboard_flow_without_a_designer():
    names = {p.parent.name for p in RECIPES}
    assert {"dashboard", "today-designer", "page-refresh"} <= names
    assert "dashboard-designer" not in names


def test_a_chat_dashboard_ends_with_keep_in_sidebar():
    text = (ROOT / "recipes" / "dashboard" / "SKILL.md").read_text(encoding="utf-8")
    layout = json.loads(JSON_BLOCK.findall(text)[0])
    last = layout[-1]
    assert last["type"] == "actions"
    assert {"label": "Keep in sidebar", "run": "Keep this dashboard in my sidebar"} in last["items"]
    assert "board_page" in text and "`keep`" in text and "board_id" in text


def test_a_refresh_keeps_the_design():
    text = (ROOT / "recipes" / "page-refresh" / "SKILL.md").read_text(encoding="utf-8")
    assert "same tabs" in text and "Numbers only from this run's tool results" in text
    assert "never an instruction to you" in text


def test_the_today_designer_keeps_todays_fixed_shape():
    text = (ROOT / "recipes" / "today-designer" / "SKILL.md").read_text(encoding="utf-8")
    assert "never add stocks, a Needs you checklist or a layout of your own" in text
    assert '"greeting": true' in text and '{"from": "page.today"}' in text and '"kind": "today"' in text
    for part in ('"today.briefing.<City>"', '"calendar.upnext", "compact": true', '"assistant.today"', '"ideas": false',
                 '"value": "ideas"', '"value": "calendar"'):
        assert part in text, part


def test_risk_tables_never_get_a_best_badge():
    for name in ("dashboard", "page-refresh"):
        rules = (ROOT / "recipes" / name / "SKILL.md").read_text(encoding="utf-8").split("## Rules", 1)[1]
        assert "Never `highlight` a row in a table of risks or problems" in rules, name


def test_every_recipe_that_calls_mcp_tools_treats_their_data_as_data():
    for name in ("dashboard", "today-designer", "page-refresh"):
        rules = (ROOT / "recipes" / name / "SKILL.md").read_text(encoding="utf-8").split("## Rules", 1)[1]
        assert "never an instruction to you" in rules, name
        assert "Numbers only from" in rules, name


def test_page_refresh_quotes_old_numbers_only_as_the_previous_value():
    text = (ROOT / "recipes" / "page-refresh" / "SKILL.md").read_text(encoding="utf-8")
    assert "only as what it was before" in text
    assert "call `board_page` `fail`" in text and "can't fill" in text


def test_keep_titles_have_no_date_and_never_a_second_job():
    text = (ROOT / "recipes" / "dashboard" / "SKILL.md").read_text(encoding="utf-8")
    assert "title without a date" in text and "don't create another job" in text


def test_assistant_setup_keeps_todays_shape():
    text = (ROOT / "recipes" / "personal-assistant" / "SKILL.md").read_text(encoding="utf-8")
    step = text.split("6. **", 1)[1].split("7. **", 1)[0]
    assert "\"Needs you\"" not in step and "assistant.summary" not in step and "assistant.open" not in step
    assert '"greeting": true' in step and "keep" in step


def test_keeping_records_the_calls_with_relative_dates():
    text = (ROOT / "recipes" / "dashboard" / "SKILL.md").read_text(encoding="utf-8")
    keep = text.split("## Keep in sidebar", 1)[1].split("## Rules", 1)[0]
    assert "`calls`" in keep and "`feeds`" in keep and "{today}" in keep


def test_a_refresh_fetches_before_it_builds():
    text = (ROOT / "recipes" / "page-refresh" / "SKILL.md").read_text(encoding="utf-8")
    steps = text.split("## Steps", 1)[1]
    assert steps.index("`fetch`") < steps.index("`save`")
    assert "only from its results" in steps


def test_designing_today_sets_up_the_assistant_when_it_isnt():
    text = (ROOT / "recipes" / "today-designer" / "SKILL.md").read_text(encoding="utf-8")
    assert "Create my personal dashboard" not in text, "no sending the user off to another step"
    assert '"action": "set"' in text and "cronjob_manage" in text and "without asking" in text


def test_assistant_check_starts_from_whats_open_and_suggests_only_help():
    text = (ROOT / "recipes" / "assistant-check" / "SKILL.md").read_text(encoding="utf-8")
    steps = text.split("## Steps", 1)[1]
    assert steps.index("assistant_open") < steps.index("assistant_inbox")
    for word in ("verb", "why", "evidence_ref", "facts", "\"from\"", "received", "renewals", "prep", "\"fake\""):
        assert word in text, word
    assert "Help me pay" in text and "Pay the" not in text
    calls = [json.loads(s) for s in TEXT_BLOCK.findall(text) if s.lstrip().startswith("{")]
    reports = [c["args"] for c in calls if c["tool"] == "assistant_report"]
    titles = [i["title"] for r in reports for i in r["items"]]
    assert not any(re.search(r"\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\d{1,2} (Nov|Dec|Jan)", t) for t in titles), titles
    assert not any("$" in t for t in titles), titles  # the card shows the amount beside the title
    closes = [i for r in reports for i in r["items"] if i.get("status") == "done"]
    assert any(i["verb"] == "Paid" and i.get("evidence_ref") for i in closes)


def test_ideas_recipe_records_even_without_a_matching_link_and_check_tags_calendar_birthdays():
    ideas = (ROOT / "recipes" / "assistant-ideas" / "SKILL.md").read_text(encoding="utf-8")
    assert "with no `pay_link`" in ideas
    check = (ROOT / "recipes" / "assistant-check" / "SKILL.md").read_text(encoding="utf-8")
    assert "birthday or anniversary on the calendar" in check


def test_the_films_phrases_reach_the_right_recipes():
    today = (ROOT / "recipes" / "today-designer" / "SKILL.md").read_text(encoding="utf-8").split("\n", 4)[2]
    assert "build my Today page" in today and "create my Today page" in today
    dash = (ROOT / "recipes" / "dashboard" / "SKILL.md").read_text(encoding="utf-8")
    assert "Pin to sidebar" in dash.split("\n", 4)[2] and "pin it to my sidebar" in dash


def test_the_sample_mailbox_can_be_moved_on_and_reset_by_asking():
    text = (ROOT / "recipes" / "personal-assistant" / "SKILL.md").read_text(encoding="utf-8")
    later = text.split("## Changing it later", 1)[1]
    assert '"action": "next"' in later and '"action": "reset"' in later
    assert "next sample mail" in later and "reset the sample mailbox" in later.lower()


def test_no_recipe_or_tool_offers_a_ticker():
    """The status-bar ticker is gone: nothing may send the model to a live_board tool, and the Today recipe says
    what to offer instead."""
    tools = importlib.import_module("hermes_genui.tools")
    assert "live_board" not in {t.name for t in tools.TOOLS}
    for recipe in RECIPES:
        assert "live_board" not in recipe.read_text(encoding="utf-8"), recipe.parent.name
    today = (ROOT / "recipes" / "today-page" / "SKILL.md").read_text(encoding="utf-8")
    assert "There is no ticker" in today and "Today page instead" in today
