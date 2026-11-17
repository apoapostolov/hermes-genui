import importlib
import json
from pathlib import Path

from conftest import ROOT, load_plugin_package

plugin = load_plugin_package()
markets = importlib.import_module("hermes_genui.tools.market_history")
tools = importlib.import_module("hermes_genui.tools")
photos = importlib.import_module("hermes_genui.tools.photos")
manifest = importlib.import_module("hermes_genui.core.manifest")
recipes = importlib.import_module("hermes_genui.core.recipes")
save_recipe = importlib.import_module("hermes_genui.tools.save_recipe")


class FakeContext:
    def __init__(self):
        self.tools = []
        self.skills = []

    def register_tool(self, name, **kwargs):
        self.tools.append(name)

    def register_skill(self, name, path, description="", **kwargs):
        self.skills.append((name, path, description))

    def register_system_prompt_section(self, section_id, content, **kwargs):
        pass

    def register_hook(self, name, callback):
        self.hooks = getattr(self, "hooks", []) + [name]


def test_registers_the_tools_and_every_shipped_recipe_as_a_skill():
    ctx = FakeContext()
    plugin.register(ctx)
    assert ctx.tools == ["show_blocks", "market_history", "find_photos", "save_recipe",
                         "dashboard", "board_page", "assistant_setup", "assistant_items", "assistant_open",
                         "assistant_inbox", "assistant_calendar", "assistant_report", "assistant_ideas"]
    # Each recipes/<name>/SKILL.md becomes the read-only skill "<plugin>:<name>", with its own description.
    shipped = sorted((ROOT / "recipes").glob("*/SKILL.md"))
    assert [(name, Path(path)) for name, path, _ in ctx.skills] == [(p.parent.name, p) for p in shipped]
    for _, path, description in ctx.skills:
        assert description == recipes.frontmatter(Path(path).read_text(encoding="utf-8"))["description"]
        assert 20 <= len(description) <= 300


def test_market_rules_are_in_the_tool_description():
    text = markets.MARKET_HISTORY_SCHEMA["description"]
    assert "NIFTY 50" in text
    assert "one or two sentences" in text
    assert "No buy, sell or price-target advice" in text


def test_registers_the_visual_nudge():
    ctx = FakeContext()
    plugin.register(ctx)
    assert ctx.hooks == ["pre_llm_call", "transform_llm_output"]


class RecordingContext:
    """Records every call register() makes, in order, with what it was given."""

    def __init__(self):
        self.calls = []
        self.dispatched = []

    def register_tool(self, **kwargs):
        self.calls.append(("tool", kwargs))

    def register_hook(self, name, callback):
        self.calls.append(("hook", name, callback))

    def register_system_prompt_section(self, section_id, content, **kwargs):
        self.calls.append(("section", section_id, content, kwargs))

    def register_skill(self, name, path, description="", **kwargs):
        self.calls.append(("skill", name, path, description, kwargs))

    def dispatch_tool(self, name, args, **kwargs):
        self.dispatched.append((name, args))
        return json.dumps({"success": True, "data": {"web": []}})


def test_register_registers_exactly_the_tool_registry_in_order(monkeypatch):
    monkeypatch.setattr(save_recipe, "_skill_writer", None)
    monkeypatch.setattr(photos, "_web_search", None)
    ctx = RecordingContext()
    plugin.register(ctx)

    assert [t.name for t in tools.TOOLS] == [
        "show_blocks", "market_history", "find_photos", "save_recipe", "dashboard", "board_page",
        "assistant_setup", "assistant_items", "assistant_open", "assistant_inbox", "assistant_calendar",
        "assistant_report", "assistant_ideas"]
    registered = [call[1] for call in ctx.calls if call[0] == "tool"]
    assert registered == [{"name": t.name, "toolset": t.toolset, "schema": t.schema, "handler": t.handler}
                          for t in tools.TOOLS]
    assert all(t.schema["name"] == t.name for t in tools.TOOLS)

    hooks = [(call[1], call[2]) for call in ctx.calls if call[0] == "hook"]
    assert hooks == [("pre_llm_call", plugin.visual_nudge), ("transform_llm_output", plugin.text_only)]
    sections = [call[1:] for call in ctx.calls if call[0] == "section"]
    assert sections == [(manifest.NAME, plugin.drawing_rule, {"max_chars": plugin.MAX_CHARS})]
    skills = [call[1:] for call in ctx.calls if call[0] == "skill"]
    assert skills == [(r.name, r.path, r.description, {}) for r in recipes.shipped()]

    # The skill writer and the web search are wired to Hermes's own tools.
    save_recipe._skill_writer("monthly-review", "x")
    photos._web_search("Pena Palace")
    assert ctx.dispatched == [
        ("skill_manage", {"action": "create", "name": "monthly-review", "content": "x", "category": "my-recipes"}),
        ("web_search", {"query": "Pena Palace"})]
