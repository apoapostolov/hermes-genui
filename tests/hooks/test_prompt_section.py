import importlib

from conftest import ROOT, load_plugin_package

load_plugin_package()
prompt = importlib.import_module("hermes_genui.hooks.prompt_section")
manifest = importlib.import_module("hermes_genui.core.manifest")
recipes = importlib.import_module("hermes_genui.core.recipes")


def test_desktop_gets_the_drawing_rule():
    text = prompt.drawing_rule({"platform": "local", "profile_name": "blocks"})
    assert "show_blocks" in text and "::preview" in text and "on its own line" in text
    assert len(text) <= prompt.MAX_CHARS


def test_other_surfaces_are_told_to_answer_in_text():
    for platform in ("telegram", "cli", "discord", ""):
        text = prompt.drawing_rule({"platform": platform})
        assert "can't draw blocks" in text
        assert "show_blocks" in text  # named, so the model knows not to call it


def test_register_adds_one_section():
    plugin = importlib.import_module("hermes_genui")

    class Ctx:
        def __init__(self):
            self.sections = []

        def register_tool(self, **kwargs):
            pass

        def register_hook(self, *args):
            pass

        def register_skill(self, *args, **kwargs):
            pass

        def register_system_prompt_section(self, section_id, content, **kwargs):
            self.sections.append((section_id, content, kwargs))

    ctx = Ctx()
    plugin.register(ctx)
    assert [s[0] for s in ctx.sections] == [manifest.NAME]
    assert callable(ctx.sections[0][1])
    assert ctx.sections[0][2].get("max_chars") == prompt.MAX_CHARS


def test_desktop_rule_names_the_explain_recipe():
    text = prompt.drawing_rule({"platform": "local"})
    assert "explain" in text and "learn" in text
    assert len(text) <= prompt.MAX_CHARS


def test_desktop_rule_says_how_to_load_every_shipped_recipe():
    # Plugin skills are loaded by their namespaced name, so the rule spells it out with the recipes' own names.
    text = prompt.drawing_rule({"platform": "local"})
    names = [r.name for r in recipes.shipped()]
    assert names == sorted(path.parent.name for path in (ROOT / "recipes").glob("*/SKILL.md"))
    assert f'skill_view("{manifest.NAME}:<recipe>")' in text
    assert ", ".join(names) in text
    assert len(text) <= prompt.MAX_CHARS


def test_the_recipe_list_is_read_from_the_recipes_folder(tmp_path):
    for name in ("zebra-plan", "apple-check"):
        (tmp_path / name).mkdir()
        (tmp_path / name / "SKILL.md").write_text(f"---\nname: {name}\n---\n", encoding="utf-8")
    (tmp_path / "notes").mkdir()  # a folder without a SKILL.md is not a recipe
    text = prompt.draw_rule(recipes.shipped(tmp_path))
    assert "apple-check, zebra-plan" in text and "notes" not in text


def test_desktop_rule_sends_things_to_keep_on_screen_to_the_today_page_within_the_cap():
    rule = prompt.drawing_rule({"platform": "local"})
    assert "Today page with the dashboard tool" in rule and "today-page recipe" in rule
    assert "live_board" not in rule and "ticker" not in rule
    assert len(rule) <= prompt.MAX_CHARS


def test_text_surfaces_are_told_not_to_draw():
    rule = prompt.drawing_rule({"platform": "telegram"})
    assert "Don't call show_blocks" in rule and "live_board" not in rule


def test_desktop_rule_names_the_personal_assistant_within_the_cap():
    rule = prompt.drawing_rule({"platform": "local"})
    assert "personal-assistant" in rule and len(rule) <= prompt.MAX_CHARS


def test_desktop_rule_never_shows_the_tag_so_the_model_calls_the_tool():
    # Shown the tag's shape (::blocks{id="…"}), Gemma 4 wrote made-up tags and never called show_blocks: 20 of 34
    # eval prompts on Gemma 4 12B, 0 once the rule only said to call the tool and paste what it returns (#43).
    rule = prompt.drawing_rule({"platform": "local"})
    assert "::blocks" not in rule
    assert "Call the tool; it returns a tag." in rule
    assert len(rule) <= prompt.MAX_CHARS
