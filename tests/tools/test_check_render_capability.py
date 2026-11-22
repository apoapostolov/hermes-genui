"""check_render_capability: a local sample gate for the widget block (#64).

The tool reads the same checker as show_blocks, records the answer for the model that called it and returns text:
no board is stored, no tag is returned and no chat state changes.
"""

import importlib
import json

import pytest

from conftest import load_plugin_package

load_plugin_package()
advanced = importlib.import_module("hermes_genui.core.advanced")
tool = importlib.import_module("hermes_genui.tools.check_render_capability")
plugin_store = importlib.import_module("hermes_genui.core.store")

WIDGET = {"type": "widget", "version": 1, "id": "demo", "title": "Demo", "data": {}, "state": {}, "computed": {},
          "view": [{"kind": "text", "id": "heading", "text": "Demo"}]}
BROKEN = {**WIDGET, "view": [{"kind": "text", "text": "Demo"}]}


@pytest.fixture
def roots(tmp_path, monkeypatch):
    """A gate root and a block root in one tmp folder, so a test can see what each tool would write."""
    monkeypatch.setattr(advanced, "default_root", lambda: tmp_path / "gate")
    monkeypatch.setattr(plugin_store, "default_root", lambda: tmp_path / "blocks")
    return tmp_path


def test_a_valid_sample_passes_and_records_it(roots):
    assert tool.check_render_capability({"blocks": [WIDGET]}, model="small-local") == tool.PASS_TEXT
    assert advanced.status("small-local") == "passed"


def test_a_malformed_sample_fails_and_records_it(roots):
    out = tool.check_render_capability({"blocks": [BROKEN]}, model="small-local")
    assert out.startswith("Gate failed: ")
    assert '0.view.0: element needs an id like "heading"' in out
    assert out.endswith(advanced.CAPABILITY_FAIL_TAIL)
    assert advanced.status("small-local") == "failed"


def test_a_sample_without_a_widget_is_refused_and_not_recorded(roots):
    out = tool.check_render_capability({"blocks": [{"type": "text", "text": "hi"}]}, model="small-local")
    assert out.startswith("Gate failed: ")
    assert "one widget" in out
    assert advanced.status("small-local") is None


def test_missing_or_unreadable_blocks_are_named(roots):
    assert tool.check_render_capability({}, model="small-local").startswith("Gate failed: ")
    assert tool.check_render_capability({"blocks": "[{not json"}, model="small-local").startswith("Gate failed: ")


def test_a_json_string_sample_is_read(roots):
    assert tool.check_render_capability({"blocks": json.dumps([WIDGET])}, model="small-local") == tool.PASS_TEXT


def test_each_check_adds_to_the_count(roots):
    tool.check_render_capability({"blocks": [WIDGET]}, model="small-local")
    tool.check_render_capability({"blocks": [BROKEN]}, model="small-local")
    record = json.loads((roots / "gate" / advanced.GATE_FILE).read_text(encoding="utf-8"))
    assert record["models"]["small-local"] == {"status": "failed", "checks": 2}


def test_the_tool_stores_no_board_and_returns_no_tag(roots):
    out = tool.check_render_capability({"blocks": [WIDGET]}, model="small-local")
    assert "::blocks" not in out
    assert sorted(p.name for p in (roots / "blocks").glob("*.json")) == []


def test_the_sample_schema_is_a_blocks_array():
    schema = tool.CHECK_RENDER_CAPABILITY_SCHEMA
    assert schema["name"] == "check_render_capability"
    parameters = schema["parameters"]
    assert parameters["properties"]["blocks"]["type"] == "array"
    assert parameters["properties"]["blocks"]["items"]["type"] == "object"
    assert parameters["required"] == ["blocks"]
    assert "widget" in parameters["properties"]["blocks"]["description"]
