"""The Advanced rendering setting and the per-model capability gate (#64).

The setting is read through Hermes's ctx.get_config; the gate is a local cache of what one model did with a widget
sample, keyed by model id. Nothing here talks to a model, the network or a board.
"""

import importlib
import json

import pytest

from conftest import load_plugin_package

load_plugin_package()
advanced = importlib.import_module("hermes_genui.core.advanced")

WIDGET = {"type": "widget", "version": 1, "id": "demo", "title": "Demo", "data": {}, "state": {}, "computed": {},
          "view": [{"kind": "text", "id": "heading", "text": "Demo"}]}
BROKEN = {**WIDGET, "view": [{"kind": "text", "text": "Demo"}]}

MENU = "Draw blocks.\n- widget: a card the reader tries.\n- chart: a trend.\n- bar: one value.\n"


@pytest.fixture
def settings(monkeypatch):
    """A config reader the test can change; the plugin reads settings through this shape."""
    values = {"advanced_rendering": "auto"}
    monkeypatch.setattr(advanced, "_CONFIG", [lambda key, default=None: values.get(key, default)])
    return values


@pytest.fixture
def gate_file(tmp_path, monkeypatch):
    """The gate's own root, in a tmp folder: the file never goes anywhere else."""
    monkeypatch.setattr(advanced, "default_root", lambda: tmp_path / "plugin-data")
    return tmp_path / "plugin-data" / advanced.GATE_FILE


# --- the setting -------------------------------------------------------------------------------------------------


def test_the_setting_defaults_to_auto(monkeypatch):
    monkeypatch.setattr(advanced, "_CONFIG", [lambda key, default=None: default])
    assert advanced.mode() == "auto"


@pytest.mark.parametrize("value, expected", [("off", "off"), ("auto", "auto"), ("on", "on"),
                                             (" OFF ", "off"), ("On", "on")])
def test_each_mode_is_read_without_case_or_padding(settings, value, expected):
    settings["advanced_rendering"] = value
    assert advanced.mode() == expected


@pytest.mark.parametrize("value", ["yes", "", None, True, "sometimes"])
def test_an_unknown_mode_falls_back_to_auto(settings, value):
    settings["advanced_rendering"] = value
    assert advanced.mode() == "auto"


def test_a_broken_config_reader_still_gives_auto(monkeypatch):
    def broken(key, default=None):
        raise RuntimeError("no config")

    monkeypatch.setattr(advanced, "_CONFIG", [broken])
    assert advanced.mode() == "auto"


def test_filter_menu_drops_only_the_widget_line():
    assert advanced.filter_menu(MENU) == "Draw blocks.\n- chart: a trend.\n- bar: one value."


def test_filter_menu_leaves_a_menu_without_a_widget_alone():
    menu = "Draw blocks.\n- chart: a trend."
    assert advanced.filter_menu(menu) == menu


def test_the_refusal_texts_name_the_setting_and_avoid_arrows_in_plain_text():
    assert "Advanced rendering" in advanced.SWITCH_OFF
    assert "Settings → Rendering" in advanced.SWITCH_OFF
    assert "Settings > Rendering" in advanced.SWITCH_OFF_PLAIN and "→" not in advanced.SWITCH_OFF_PLAIN
    assert advanced.GATE_FALLBACK.startswith("Not drawn.")
    assert advanced.GATE_FALLBACK_PLAIN.startswith("Not drawn.") and "→" not in advanced.GATE_FALLBACK_PLAIN
    assert advanced.OFF_REFUSAL.startswith("Not drawn.") and advanced.OFF_REFUSAL.endswith(advanced.SWITCH_OFF_PLAIN)


# --- the gate's local state --------------------------------------------------------------------------------------


def test_an_unchecked_model_has_no_status(settings, gate_file):
    assert advanced.status("qwen") is None
    assert not gate_file.exists()


def test_a_pass_is_recorded_with_a_count(settings, gate_file):
    advanced.record("qwen", True)
    assert advanced.status("qwen") == "passed"
    assert json.loads(gate_file.read_text(encoding="utf-8"))["models"]["qwen"] == {"status": "passed", "checks": 1}


def test_a_failure_replaces_the_status_and_adds_to_the_count(settings, gate_file):
    advanced.record("qwen", True)
    advanced.record("qwen", False)
    assert advanced.status("qwen") == "failed"
    assert json.loads(gate_file.read_text(encoding="utf-8"))["models"]["qwen"]["checks"] == 2


def test_the_gate_keeps_models_apart(settings, gate_file):
    advanced.record("one", True)
    advanced.record("two", False)
    assert (advanced.status("one"), advanced.status("two")) == ("passed", "failed")


def test_a_blank_model_is_stored_as_unknown(settings, gate_file):
    advanced.record("   ", True)
    assert advanced.status("unknown") == "passed"


def test_a_damaged_gate_file_reads_as_unchecked_and_is_replaced(settings, gate_file):
    gate_file.parent.mkdir(parents=True, exist_ok=True)
    gate_file.write_text("{half", encoding="utf-8")
    assert advanced.status("qwen") is None
    advanced.record("qwen", True)
    assert advanced.status("qwen") == "passed"


def test_the_gate_writes_nothing_outside_its_root(settings, gate_file):
    advanced.record("qwen", True)
    assert sorted(p.name for p in gate_file.parent.iterdir()) == [advanced.GATE_FILE]


# --- which model, and where a widget sits ------------------------------------------------------------------------


def test_the_model_id_comes_from_the_call_then_the_session():
    assert advanced.model_id(model="qwen25") == "qwen25"
    assert advanced.model_id(session={"model": "gpt-5"}) == "gpt-5"
    assert advanced.model_id(model="qwen25", session={"model": "gpt-5"}) == "qwen25"
    assert advanced.model_id(model="  qwen25  ") == "qwen25"
    assert advanced.model_id(model="") == "unknown"
    assert advanced.model_id() == "unknown"
    assert advanced.model_id(session="not a dict") == "unknown"


def test_widgets_are_found_at_the_top_and_inside_containers_and_tabs():
    board = [{"type": "text", "text": "hi"}, WIDGET,
             {"type": "row", "children": [{"type": "section", "title": "S", "children": [BROKEN]}]},
             {"type": "tabs", "tabs": [{"label": "One", "children": [WIDGET]}]}]
    assert [path for path, _ in advanced.widgets(board)] == ["1", "2.children.0.children.0", "3.tabs.0.children.0"]


def test_a_board_without_a_widget_has_none():
    assert advanced.widgets([{"type": "text", "text": "hi"}, {"type": "row", "children": []}]) == []


def test_a_valid_widget_has_no_gate_problems():
    assert advanced.check_widgets([("0", WIDGET)]) == []


def test_check_widgets_keeps_the_boards_paths():
    assert advanced.check_widgets([("2.children.0", BROKEN)]) == [
        '2.children.0.view.0: element needs an id like "heading"']
