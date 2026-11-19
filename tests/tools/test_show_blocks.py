import importlib
import json

import pytest

from conftest import load_plugin_package

load_plugin_package()
tools = importlib.import_module("hermes_genui.tools.show_blocks")
plugin_store = importlib.import_module("hermes_genui.core.store")

TIMELINE = {"type": "timeline", "groups": [{"label": "Day 1", "items": [{"time": "09:00", "title": "Belém Tower"}]}]}


@pytest.fixture
def store_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin_store, "default_root", lambda: tmp_path)
    return tmp_path


def stored_id(result: str) -> str:
    last = result.strip().splitlines()[-1]
    assert last.startswith('::blocks{id="') and last.endswith('"}')
    return last[len('::blocks{id="'):-2]


def test_tag_for():
    assert tools.tag_for("7f3a09bc") == '::blocks{id="7f3a09bc"}'


def test_valid_list_is_stored_and_tagged(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE]})
    assert result.startswith("Put this on its own line in your reply, exactly as it is:\n")
    assert plugin_store.load(stored_id(result), root=store_dir) == [TIMELINE]


def test_string_json_is_accepted(store_dir):
    result = tools.show_blocks({"blocks": json.dumps([TIMELINE])})
    assert plugin_store.load(stored_id(result), root=store_dir) == [TIMELINE]


def test_lone_object_is_a_list_of_one(store_dir):
    result = tools.show_blocks({"blocks": TIMELINE})
    assert plugin_store.load(stored_id(result), root=store_dir) == [TIMELINE]


def test_problems_are_returned_and_nothing_stored(store_dir):
    result = tools.show_blocks({"blocks": [{"type": "sundial"}]})
    assert result == 'Not drawn. Fix these and call show_blocks again:\n- 0: unknown type "sundial"'
    assert list(store_dir.glob("*.json")) == []


def test_unparseable_string(store_dir):
    result = tools.show_blocks({"blocks": "[{not json"})
    assert result == "Not drawn. Fix these and call show_blocks again:\n- blocks: not valid JSON"
    assert list(store_dir.glob("*.json")) == []


def test_empty_list_is_a_problem(store_dir):
    result = tools.show_blocks({"blocks": []})
    assert result == "Not drawn. Fix these and call show_blocks again:\n- blocks: give at least one block"


def test_schema_description_carries_the_catalog():
    description = tools.SHOW_BLOCKS_SCHEMA["description"]
    assert "timeline" in description and "Paste the returned tag on its own line exactly as returned." in description


PHOTO = {"type": "images", "title": "Lisbon", "images": [{"url": "https://a.example/alfama.jpg", "caption": "Alfama"}]}


def test_photos_must_come_from_find_photos(store_dir):
    result = tools.show_blocks({"blocks": [PHOTO]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.images.0: use only photo URLs that find_photos returned")
    assert list(store_dir.glob("*.json")) == []


def test_photos_found_earlier_are_allowed(store_dir):
    plugin_store.remember_photo_urls(["https://a.example/alfama.jpg"])
    result = tools.show_blocks({"blocks": [{"type": "section", "title": "Day 1", "children": [PHOTO]}]})
    assert result.strip().splitlines()[-1].startswith('::blocks{id="')


def test_include_is_replaced_by_the_stored_board(store_dir):
    board = [{"type": "heading", "text": "NIFTY"}, {"type": "source", "text": "Yahoo"}]
    board_id = plugin_store.save(board, root=store_dir)
    layout = [{"type": "callout", "tone": "tip", "text": "Up on banks."},
              {"type": "section", "title": "Prices", "children": [{"type": "include", "id": board_id}]}]
    result = tools.show_blocks({"blocks": layout})
    stored = plugin_store.load(stored_id(result), root=store_dir)
    assert stored == [layout[0], {"type": "section", "title": "Prices", "children": board}]


def test_unknown_include_is_a_problem(store_dir):
    result = tools.show_blocks({"blocks": [{"type": "include", "id": "0badc0de"}]})
    assert result == "Not drawn. Fix these and call show_blocks again:\n- 0: no stored board with id 0badc0de"


ATOM = {"type": "image", "url": "https://a.example/lake.jpg", "caption": "Ooty lake"}


def test_image_atom_must_come_from_find_photos(store_dir):
    result = tools.show_blocks({"blocks": [{"type": "grid", "children": [ATOM, {"type": "badge", "text": "New"}]}]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.children.0.url: use only photo URLs that find_photos returned")
    plugin_store.remember_photo_urls(["https://a.example/lake.jpg"])
    assert tools.show_blocks({"blocks": [ATOM]}).strip().splitlines()[-1].startswith('::blocks{id="')


def test_flip_and_list_photos_must_come_from_find_photos(store_dir):
    flip = {"type": "flip", "cards": [{"front": "Q", "back": "A"},
                                      {"front": "Where?", "back": "Ooty", "image": "https://a.example/ooty.jpg"}]}
    listed = {"type": "list", "items": [{"title": "Third Wave"}, {"title": "Dyu"},
                                        {"title": "Matamaal", "image": "https://a.example/m.jpg"}]}
    result = tools.show_blocks({"blocks": [flip, listed]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.cards.1.image: use only photo URLs that find_photos returned\n"
                      "- 1.items.2.image: use only photo URLs that find_photos returned")


def test_tile_photos_must_come_from_find_photos(store_dir):
    tiles = {"type": "tiles", "items": [{"title": "Kyoto", "ask": "Plan Kyoto"}, {"title": "Nara", "ask": "Plan Nara"},
                                        {"title": "Osaka", "ask": "Plan Osaka", "image": "https://a.example/o.jpg"}]}
    result = tools.show_blocks({"blocks": [tiles]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.items.2.image: use only photo URLs that find_photos returned")
    plugin_store.remember_photo_urls(["https://a.example/o.jpg"])
    assert tools.show_blocks({"blocks": [tiles]}).strip().splitlines()[-1].startswith('::blocks{id="')


def two_tabs(first: list, second: list) -> dict:
    return {"type": "tabs", "tabs": [{"label": "One", "children": first}, {"label": "Two", "children": second}]}


def test_include_inside_a_tab_is_resolved(store_dir):
    board = [{"type": "heading", "text": "NIFTY"}, {"type": "source", "text": "Yahoo"}]
    board_id = plugin_store.save(board, root=store_dir)
    note = {"type": "text", "text": "x"}
    result = tools.show_blocks({"blocks": [two_tabs([note], [{"type": "include", "id": board_id}])]})
    assert plugin_store.load(stored_id(result), root=store_dir) == [two_tabs([note], board)]


def test_unknown_include_inside_a_tab_is_a_problem(store_dir):
    result = tools.show_blocks({"blocks": [two_tabs([{"type": "include", "id": "0badc0de"}], [TIMELINE])]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.tabs.0.children.0: no stored board with id 0badc0de")


def test_unknown_photo_inside_a_tab_is_refused(store_dir):
    section = {"type": "section", "title": "S", "children": [ATOM]}
    result = tools.show_blocks({"blocks": [two_tabs([TIMELINE], [section])]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.tabs.1.children.0.children.0.url: use only photo URLs that find_photos returned")
    plugin_store.remember_photo_urls(["https://a.example/lake.jpg"])
    assert tools.show_blocks({"blocks": [two_tabs([TIMELINE], [ATOM])]}).strip().splitlines()[-1].startswith("::blocks")


# --- a board can't grow without bound through include -----------------------------------------------------------------


def nested_rows(depth: int, inner: dict) -> dict:
    block = inner
    for _ in range(depth):
        block = {"type": "row", "children": [block]}
    return block


def test_includes_cant_grow_a_board_without_bound(store_dir):
    board_id = plugin_store.save([{"type": "text", "text": "x" * 1000}], root=store_dir)
    results = []
    for _ in range(3):
        result = tools.show_blocks({"blocks": [{"type": "include", "id": board_id}] * 40})
        results.append(result)
        if result.startswith("Not drawn"):
            break
        board_id = stored_id(result)
    assert results[-1].startswith("Not drawn: board too big (")
    assert results[-1].endswith(" KB, max 256 KB). Draw less or split it.")
    assert sum(f.stat().st_size for f in store_dir.glob("*.json")) < 256 * 1024


def test_100_includes_are_too_many_blocks(store_dir):
    board_id = plugin_store.save([{"type": "text", "text": "hi"}], root=store_dir)
    result = tools.show_blocks({"blocks": [{"type": "include", "id": board_id}] * 100})
    assert result == "Not drawn. Fix these and call show_blocks again:\n- blocks: too many blocks (max 40)"


def test_a_board_over_64kb_cant_be_included(store_dir):
    big_id = plugin_store.save([{"type": "text", "text": "x" * (70 * 1024)}], root=store_dir)
    result = tools.show_blocks({"blocks": [{"type": "include", "id": big_id}]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      f"- 0: board {big_id} is too big to include (max 64 KB)")


def test_an_include_cant_nest_a_board_too_deep(store_dir):
    deep_id = plugin_store.save([nested_rows(7, {"type": "text", "text": "hi"})], root=store_dir)
    result = tools.show_blocks({"blocks": [nested_rows(7, {"type": "include", "id": deep_id})]})
    assert result.startswith("Not drawn. Fix these and call show_blocks again:\n- 0.children.0")
    assert result.endswith(": nested too deep (max 8)")


def test_resolve_includes_is_depth_guarded(store_dir):
    problems: list[str] = []
    tools.resolve_includes([nested_rows(600, {"type": "text", "text": "hi"})], problems)
    assert len(problems) == 1 and problems[0].endswith(": nested too deep (max 8)")


def test_step_photos_must_come_from_find_photos(store_dir):
    steps = {"type": "steps", "items": [{"title": "A"}, {"title": "B", "image": "https://a.example/s.jpg"}]}
    out = tools.show_blocks({"blocks": [steps]})
    assert out == ("Not drawn. Fix these and call show_blocks again:\n"
                   "- 0.items.1.image: use only photo URLs that find_photos returned")
    plugin_store.remember_photo_urls(["https://a.example/s.jpg"])
    assert "::blocks{" in tools.show_blocks({"blocks": [steps]})


def _spec(kind: str) -> str:
    return importlib.import_module("hermes_genui.core.catalog_text").spec(kind)


def test_a_refused_block_comes_back_with_how_to_write_it(store_dir):
    chart = {"type": "chart", "kind": "line", "x": ["Jan", "Feb"], "series": [{"name": "Bill", "data": [2100]}]}
    result = tools.show_blocks({"blocks": [chart]})
    problems, _, guide = result.partition("\n\nHow to write it:\n")
    assert problems.startswith("Not drawn. Fix these and call show_blocks again:\n- 0.series.0")
    assert guide == _spec("chart")
    assert guide.startswith("chart: Fields: ") and '\nExample: {"type":"chart"' in guide
    assert list(store_dir.glob("*.json")) == []


def test_a_block_without_a_type_comes_back_with_the_guessed_blocks_guide(store_dir):
    timeline = {"groups": [{"label": "Day 1", "items": [{"time": "09:00", "title": "Amber Fort"}]}]}
    result = tools.show_blocks({"blocks": [timeline]})
    assert result.endswith("\n\nHow to write it:\n" + _spec("timeline"))


def test_the_guide_covers_each_refused_kind_once(store_dir):
    bad_chart = {"type": "chart", "kind": "line", "x": ["a"], "series": [{"name": "s", "data": []}]}
    bad_table = {"type": "table", "columns": ["A"]}
    inside = {"type": "row", "children": [bad_table, dict(bad_chart)]}
    result = tools.show_blocks({"blocks": [bad_chart, inside]})
    guide = result.partition("\n\nHow to write them:\n")[2]
    assert guide == _spec("chart") + "\n" + _spec("table")


def test_an_unknown_type_has_no_guide_to_attach(store_dir):
    assert tools.show_blocks({"blocks": [{"type": "sundial"}]}) == (
        'Not drawn. Fix these and call show_blocks again:\n- 0: unknown type "sundial"')


def test_the_guide_stops_at_three_kinds(store_dir):
    bad = [{"type": "chart", "kind": "line", "x": ["a"], "series": [{"name": "s", "data": []}]},
           {"type": "table", "columns": ["A"]},
           {"type": "timeline", "groups": []},
           {"type": "kpis", "items": []}]
    guide = tools.show_blocks({"blocks": bad}).partition("\n\nHow to write them:\n")[2]
    assert guide == "\n".join(_spec(k) for k in ("chart", "table", "timeline"))
