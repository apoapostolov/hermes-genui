"""The stand-in tool only exists when its setting is on, and never claims a real generation."""

from __future__ import annotations

import importlib
import json

from conftest import load_plugin_package

load_plugin_package()
standin_photos = importlib.import_module("hermes_genui.tools.standin_photos")


def test_each_case_returns_the_shape_it_promises():
    """Called the way Hermes calls every tool: one dict of the model's arguments."""
    https = json.loads(standin_photos.standin_photos({"case": "https"}))
    assert https["success"] is True
    assert https["image"].startswith("https://")

    local = json.loads(standin_photos.standin_photos({"case": "local"}))
    assert local["success"] is True
    assert not local["image"].startswith("https://")

    broken = json.loads(standin_photos.standin_photos({"case": "broken"}))
    assert broken["success"] is True
    assert broken["image"].startswith("https://")

    failed = json.loads(standin_photos.standin_photos({"case": "failed"}))
    assert failed["success"] is False


def test_no_arguments_still_returns_the_https_case():
    # Hermes passes an empty dict when the model writes no arguments; a missing key must not crash the handler.
    assert json.loads(standin_photos.standin_photos({}))["image"].startswith("https://")
    assert json.loads(standin_photos.standin_photos())["image"].startswith("https://")


def test_unknown_case_is_refused():
    assert json.loads(standin_photos.standin_photos({"case": "anything else"}))["success"] is False


def test_extra_keyword_arguments_are_ignored():
    # Hermes may pass session context beside the params, as it does for every tool.
    assert json.loads(standin_photos.standin_photos({"case": "local"}, session_id="s"))["success"] is True
