"""Pages: a dashboard (or Today's work sections) kept from a free design, refreshed as snapshots of blocks."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
pages = importlib.import_module("hermes_genui.core.pages.store")
templates = importlib.import_module("hermes_genui.core.pages.templates")
layout = importlib.import_module("hermes_genui.core.pages.layout")

LIST = {"type": "list", "items": [{"title": "MRR up 6%"}]}
NUMS = {"type": "kpis", "items": [{"label": "MRR", "value": 410000, "unit": "$"}]}
TABS = {"type": "tabs", "tabs": [{"label": "Overview", "children": [NUMS]}, {"label": "Risk", "children": [LIST]}]}


def page(**over) -> dict:
    return {"slug": "security", "title": "Security", "kind": "dashboard", "servers": ["mocksecops"], "notes": "",
            "job_id": None, "snapshot": None, "previous": None, "refresh": {"requested_at": None, "error": None},
            **over}


def test_slugs_are_short_and_safe():
    assert pages.slug_for("Sales / APAC") == "sales-apac"
    assert pages.slug_for("  Executive  ") == "executive"
    assert pages.slug_for("東京") == "page"
    assert len(pages.slug_for("x" * 80)) == 40


def test_a_page_round_trips_lists_and_goes(tmp_path):
    root = tmp_path / "blocks"
    pages.save(page(), root)
    pages.save(page(slug="executive", title="Executive"), root)
    assert pages.load("security", root)["title"] == "Security"
    assert pages.list_pages(root) == [{"slug": "executive", "title": "Executive", "kind": "dashboard"},
                                      {"slug": "security", "title": "Security", "kind": "dashboard"}]
    assert pages.remove("security", root) is True
    assert pages.load("security", root) is None
    assert pages.load("../etc", root) is None


def test_a_page_is_its_snapshot_blocks():
    snap = {"at": "2026-11-15T09:12:00+05:30", "blocks": [LIST, TABS]}
    assert layout.blocks_for(page(snapshot=snap)) == [LIST, TABS]


def test_a_slot_version_page_asks_for_a_redesign():
    snap = {"at": "2026-11-15T09:12:00+05:30", "slots": {"insights": [LIST]}}
    assert layout.blocks_for(page(snapshot=snap)) == [{"type": "callout", "tone": "info", "text": layout.OLD_VERSION}]
    assert "redesign" in layout.OLD_VERSION


def test_a_page_without_a_snapshot_asks_for_a_refresh():
    assert layout.blocks_for(page()) == [{"type": "callout", "tone": "info", "text": layout.NOT_FILLED}]


def test_the_shipped_briefs_are_valid():
    found = templates.load_all()
    assert set(found) == {"executive", "security-posture", "sales-pipeline"}
    for brief in found.values():
        assert templates.check_brief(brief) == [], brief["name"]
        assert 3 <= len(brief["cover"]) <= 6


def test_a_brief_needs_what_to_cover():
    assert templates.check_brief({"name": "X", "about": "x", "best_for": "x", "cover": []}) == [
        "cover: 3-6 short topics"]
