import importlib
import json

import pytest

from conftest import load_plugin_package

load_plugin_package()
rb = importlib.import_module("hermes_genui.tools.save_recipe")

GOOD_LAYOUT = [{"type": "heading", "text": "Monthly review"},
               {"type": "kpis", "items": [{"label": "Invested", "value": 25000, "unit": "₹"}]}]


def recipe(name="monthly-review", description="Monthly investment review: SIP totals, returns and the next step.",
           layout=None, extra=""):
    body = json.dumps(layout if layout is not None else GOOD_LAYOUT)
    return (f'---\nname: {name}\ndescription: "{description}"\nversion: 0.1.0\n---\n# Monthly review\n\n'
            f"## Steps\n1. Ask for the month's numbers.\n2. Draw with show_blocks.\n\n```json\n{body}\n```\n{extra}")


@pytest.fixture
def saved(monkeypatch):
    calls = []
    monkeypatch.setattr(rb, "_skill_writer", lambda name, content: calls.append((name, content)) or
                        json.dumps({"success": True, "staged": True, "pending_id": "p1"}))
    return calls


def test_a_good_recipe_is_handed_to_hermes(saved):
    result = rb.save_recipe({"name": "monthly-review", "markdown": recipe()})
    assert saved and saved[0][0] == "monthly-review"
    assert "approve" in result.lower()


@pytest.mark.parametrize(("args", "problem"), [
    ({"name": "Bad Name!", "markdown": recipe(name="Bad Name!")}, "name"),
    ({"name": "dashboard", "markdown": recipe(name="dashboard")}, "ships with the plugin"),
    ({"name": "monthly-review", "markdown": recipe(name="other-name")}, "frontmatter name"),
    ({"name": "monthly-review", "markdown": recipe(description="short")}, "description"),
    ({"name": "monthly-review", "markdown": recipe().replace("```json", "```text")}, "JSON layout example"),
    ({"name": "monthly-review", "markdown": recipe(layout=[{"type": "sundial"}])}, 'unknown type "sundial"'),
    ({"name": "monthly-review", "markdown": recipe(extra="Use ::preview{file=x.html} for this.")}, "::preview"),
    ({"name": "monthly-review", "markdown": recipe(extra="<script>alert(1)</script>")}, "HTML"),
    ({"name": "monthly-review", "markdown": recipe(extra="x" * 13_000)}, "too long"),
    ({"name": "monthly-review", "markdown": "no frontmatter at all"}, "frontmatter"),
])
def test_bad_recipes_are_refused_and_nothing_is_saved(saved, args, problem):
    result = rb.save_recipe(args)
    assert result.startswith("Not saved")
    assert problem in result
    assert saved == []


def test_without_hermes_it_says_it_cant_save(monkeypatch):
    monkeypatch.setattr(rb, "_skill_writer", None)
    assert "can't save" in rb.save_recipe({"name": "monthly-review", "markdown": recipe()})


def test_register_wires_the_tool_and_the_writer():
    plugin = importlib.import_module("hermes_genui")
    dispatched = []

    class Ctx:
        tools = []

        def register_tool(self, name, **kwargs):
            self.tools.append(name)

        def register_hook(self, *args):
            pass

        def register_system_prompt_section(self, *args, **kwargs):
            pass

        def register_skill(self, *args, **kwargs):
            pass

        def dispatch_tool(self, name, args, **kwargs):
            dispatched.append((name, args))
            return json.dumps({"success": True})

    ctx = Ctx()
    plugin.register(ctx)
    assert "save_recipe" in ctx.tools
    rb._skill_writer("monthly-review", "x")
    assert dispatched == [("skill_manage", {"action": "create", "name": "monthly-review", "content": "x",
                                            "category": "my-recipes"})]


def test_register_wires_photo_page_search_to_hermes_web_search():
    plugin = importlib.import_module("hermes_genui")
    photos = importlib.import_module("hermes_genui.tools.photos")
    dispatched = []

    class Ctx:
        def register_tool(self, name, **kwargs):
            pass

        def register_hook(self, *args):
            pass

        def register_system_prompt_section(self, *args, **kwargs):
            pass

        def register_skill(self, *args, **kwargs):
            pass

        def dispatch_tool(self, name, args, **kwargs):
            dispatched.append((name, args))
            return json.dumps({"success": True, "data": {"web": []}})

    plugin.register(Ctx())
    photos._web_search("Pena Palace")
    assert dispatched == [("web_search", {"query": "Pena Palace"})]


def test_shipped_names_come_from_the_recipes_folder():
    recipes = importlib.import_module("hermes_genui.core.recipes")
    assert rb.SHIPPED == frozenset(r.name for r in recipes.shipped())
    assert "recipe-builder" in rb.SHIPPED and "trip-planner" in rb.SHIPPED
