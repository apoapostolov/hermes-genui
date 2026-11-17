"""The allowed tools' https results are noted; everything else is left alone."""

from __future__ import annotations

import importlib
import json

import pytest

from conftest import load_plugin_package

load_plugin_package()
tool_photos = importlib.import_module("hermes_genui.hooks.tool_photos")

HTTPS = "https://images.example/generated/one.png"
LOCAL = "C:/tmp/generated.png"
BROKEN = "https://example.invalid/missing.png"


def test_an_allowed_tool_result_records_https_urls(tmp_path, monkeypatch):
    monkeypatch.setattr(tool_photos.store, "default_root", lambda: tmp_path)
    result = json.dumps({"success": True, "image": HTTPS, "host_image": LOCAL, "images": [{"url": BROKEN}]})
    tool_photos.note_tool_photos(tool_name="image_generate", result=result)
    assert tool_photos.store.known_photo_urls(root=tmp_path) == {HTTPS, BROKEN}


def test_other_tools_never_approve_their_own_images(tmp_path, monkeypatch):
    monkeypatch.setattr(tool_photos.store, "default_root", lambda: tmp_path)
    for name in ("web_fetch", "browser_navigate", "image_generate_alt", "find_photos"):
        tool_photos.note_tool_photos(tool_name=name, result={"image": HTTPS})
    assert tool_photos.store.known_photo_urls(root=tmp_path) == set()


def test_local_paths_and_malformed_results_are_ignored(tmp_path, monkeypatch):
    monkeypatch.setattr(tool_photos.store, "default_root", lambda: tmp_path)
    for result in ({"image": LOCAL}, "not json", None, 42, {"image": "http://insecure.example/x.png"}):
        tool_photos.note_tool_photos(tool_name="image_generate", result=result)
    assert tool_photos.store.known_photo_urls(root=tmp_path) == set()


def test_a_broken_link_is_recorded_but_left_to_the_renderer(tmp_path, monkeypatch):
    monkeypatch.setattr(tool_photos.store, "default_root", lambda: tmp_path)
    tool_photos.note_tool_photos(tool_name="image_generate", result={"success": True, "image": BROKEN})
    assert BROKEN in tool_photos.store.known_photo_urls(root=tmp_path)


def test_urls_are_deduplicated_and_capped(tmp_path, monkeypatch):
    monkeypatch.setattr(tool_photos.store, "default_root", lambda: tmp_path)
    repeated = [f"https://images.example/{i}.png" for i in range(15)]
    tool_photos.note_tool_photos(tool_name="image_generate", result={"images": repeated + [repeated[0]]})
    known = tool_photos.store.known_photo_urls(root=tmp_path)
    assert len(known) == tool_photos.MAX_URLS
    assert repeated[0] in known and repeated[-1] not in known


@pytest.mark.parametrize("result", [object(), {"a": {"b": {"c": {"d": {"e": HTTPS}}}}}, ["x", {"url": HTTPS}]])
def test_odd_results_never_raise(result, tmp_path, monkeypatch):
    monkeypatch.setattr(tool_photos.store, "default_root", lambda: tmp_path)
    tool_photos.note_tool_photos(tool_name="image_generate", result=result)
