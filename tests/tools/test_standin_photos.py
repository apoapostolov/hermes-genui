"""The stand-in tool only exists when its setting is on, and never claims a real generation."""

from __future__ import annotations

import importlib
import json

from conftest import load_plugin_package

load_plugin_package()
standin_photos = importlib.import_module("hermes_genui.tools.standin_photos")


def test_each_case_returns_the_shape_it_promises():
    https = json.loads(standin_photos.standin_photos("https"))
    assert https["success"] is True
    assert https["image"].startswith("https://")

    local = json.loads(standin_photos.standin_photos("local"))
    assert local["success"] is True
    assert not local["image"].startswith("https://")

    broken = json.loads(standin_photos.standin_photos("broken"))
    assert broken["success"] is True
    assert broken["image"].startswith("https://")

    failed = json.loads(standin_photos.standin_photos("failed"))
    assert failed["success"] is False


def test_unknown_case_is_refused():
    assert json.loads(standin_photos.standin_photos("anything else"))["success"] is False
