"""The plugin's name, version and homepage come from plugin.yaml alone, and the manifest says what register() does."""

import importlib
import re

from conftest import ROOT, load_plugin_package

plugin = load_plugin_package()
manifest = importlib.import_module("hermes_genui.core.manifest")
tools = importlib.import_module("hermes_genui.tools")
photos = importlib.import_module("hermes_genui.tools.photos")

TEXT = (ROOT / "plugin.yaml").read_text(encoding="utf-8")


def top_level(key: str) -> str:
    """One top-level `key: value` line of plugin.yaml, as written."""
    found = re.search(rf"^{key}:[ \t]*(.*)$", TEXT, re.M)
    assert found, f"plugin.yaml has no {key}"
    return found.group(1).strip()


def flow_list(key: str) -> list[str]:
    """A top-level `key: [a, b]` list of plugin.yaml."""
    value = top_level(key)
    assert value.startswith("[") and value.endswith("]"), f"{key} is one [a, b] line"
    return [item.strip() for item in value[1:-1].split(",") if item.strip()]


def test_read_fields_takes_top_level_lines_only():
    text = 'name: my-plugin\nversion: "1.2.0"  # release\nhomepage: https://x.org/a#b\nconfig_schema:\n  name: no\n'
    assert manifest.read_fields(text) == {"name": "my-plugin", "version": "1.2.0", "homepage": "https://x.org/a#b",
                                          "config_schema": ""}


def test_name_version_and_homepage_come_from_plugin_yaml():
    assert manifest.NAME == top_level("name") == "hermes-genui"
    assert manifest.VERSION == top_level("version").strip('"') == "0.3.1"
    assert manifest.HOMEPAGE == top_level("homepage") == "https://github.com/sagarmainkar/hermes-genui"
    assert manifest.USER_AGENT == "hermes-genui/0.3.1 (+https://github.com/sagarmainkar/hermes-genui)"


def test_the_toolset_follows_the_name():
    assert tools.TOOLSET == manifest.NAME.replace("-", "_") == "hermes_genui"


def test_manifest_is_v2_with_the_catalog_fields():
    assert top_level("manifest_version") == "2"
    assert top_level("author") == "Sagar Mainkar"
    assert top_level("license") == "MIT"
    assert top_level("requires_hermes") == '">=0.22.5"'
    assert flow_list("tags")
    assert len(top_level("description")) > 0


def test_manifest_declares_exactly_what_register_registers():
    # The default guide is the menu, which adds block_guide (HERMES_GENUI_GUIDE=full leaves it out).
    assert flow_list("provides_tools") == [t.name for t in tools.tools_for("menu")]

    class Ctx:
        hooks: list[str] = []

        def register_tool(self, **kwargs):
            pass

        def register_hook(self, name, callback):
            self.hooks.append(name)

        def register_skill(self, *args, **kwargs):
            pass

        def register_system_prompt_section(self, *args, **kwargs):
            pass

    ctx = Ctx()
    plugin.register(ctx)
    assert flow_list("provides_hooks") == ctx.hooks


def test_the_photo_keys_are_optional_secrets_in_the_settings_form():
    assert "requires_env" not in TEXT, "the keys are optional: requires_env would make Hermes ask for them"
    schema = TEXT.split("\nconfig_schema:\n", 1)[1]
    entries = re.findall(r"^  (\w+):\n((?:    .*\n?)+)", schema, re.M)
    declared = {}
    for key, body in entries:
        if "    type: bool\n" in body:
            assert key in ("local_only", "photo_test_tool"), key  # behaviour settings, not keys
            assert "    default: false\n" in body
            continue
        if "    type: str\n" in body:
            assert key == "advanced_rendering", key  # a behaviour setting with three choices, not a key
            assert "    default: auto\n" in body
            assert '    choices: ["off", "auto", "on"]\n' in body  # quoted: bare off/on are YAML booleans
            assert "env:" not in body
            continue
        assert "    type: secret\n" in body, key
        assert re.search(r"^    label: .+optional", body, re.M | re.I), f"{key}: the label says it is optional"
        assert re.search(r"^    description: .{20,}", body, re.M), key
        declared[key] = re.search(r"^    env: (\w+)$", body, re.M).group(1)
    assert declared == {"unsplash_access_key": "UNSPLASH_ACCESS_KEY", "pexels_api_key": "PEXELS_API_KEY",
                        "tavily_api_key": "TAVILY_API_KEY"}
    assert set(declared.values()) == set(photos.KEYS)


def test_local_only_is_a_plugin_setting_not_an_env_variable():
    """.env is for secrets; a behaviour switch lives in plugins.entries.hermes-genui.settings (config.yaml)."""
    schema = TEXT.split("\nconfig_schema:\n", 1)[1]
    body = dict(re.findall(r"^  (\w+):\n((?:    .*\n?)+)", schema, re.M))["local_only"]
    assert "    type: bool\n" in body and "    default: false\n" in body and "env:" not in body
