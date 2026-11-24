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
    assert result.startswith(
        "Drawn. Now write your reply, with this line on its own, exactly as it is (don't draw it again):\n")
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


def test_the_interactive_word_is_documented_where_the_model_reads_the_blocks(store_dir):
    # The catalog budget pins describe(); the table's new word rides the blocks parameter instead.
    desc = tools.SHOW_BLOCKS_SCHEMA["parameters"]["properties"]["blocks"]["description"]
    assert "`interactive`: true" in desc


def test_the_interactive_word_is_stored_verbatim(store_dir):
    table = {"type": "table", "caption": "Phones", "columns": ["A"], "rows": [["x"]], "interactive": True}
    result = tools.show_blocks({"blocks": [table]})
    assert plugin_store.load(stored_id(result), root=store_dir) == [table]


PHOTO = {"type": "images", "title": "Lisbon", "images": [{"url": "https://a.example/alfama.jpg", "caption": "Alfama"}]}


def test_photos_must_come_from_find_photos(store_dir):
    result = tools.show_blocks({"blocks": [PHOTO]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.images.0: use only image URLs that find_photos or image_generate returned")
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
                      "- 0.children.0.url: use only image URLs that find_photos or image_generate returned")
    plugin_store.remember_photo_urls(["https://a.example/lake.jpg"])
    assert tools.show_blocks({"blocks": [ATOM]}).strip().splitlines()[-1].startswith('::blocks{id="')


def test_flip_and_list_photos_must_come_from_find_photos(store_dir):
    flip = {"type": "flip", "cards": [{"front": "Q", "back": "A"},
                                      {"front": "Where?", "back": "Ooty", "image": "https://a.example/ooty.jpg"}]}
    listed = {"type": "list", "items": [{"title": "Third Wave"}, {"title": "Dyu"},
                                        {"title": "Matamaal", "image": "https://a.example/m.jpg"}]}
    result = tools.show_blocks({"blocks": [flip, listed]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.cards.1.image: use only image URLs that find_photos or image_generate returned\n"
                      "- 1.items.2.image: use only image URLs that find_photos or image_generate returned")


def test_tile_photos_must_come_from_find_photos(store_dir):
    tiles = {"type": "tiles", "items": [{"title": "Kyoto", "ask": "Plan Kyoto"}, {"title": "Nara", "ask": "Plan Nara"},
                                        {"title": "Osaka", "ask": "Plan Osaka", "image": "https://a.example/o.jpg"}]}
    result = tools.show_blocks({"blocks": [tiles]})
    assert result == ("Not drawn. Fix these and call show_blocks again:\n"
                      "- 0.items.2.image: use only image URLs that find_photos or image_generate returned")
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
                      "- 0.tabs.1.children.0.children.0.url: use only image URLs that find_photos or "
                      "image_generate returned")
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
                   "- 0.items.1.image: use only image URLs that find_photos or image_generate returned")
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
    assert guide.startswith('chart: write {"type": "chart", ...}.') and '\nExample: {"type":"chart"' in guide
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


def test_a_made_up_icon_comes_back_with_the_icons_to_choose_from(store_dir):
    flow = {"type": "flow", "id": "upi", "nodes": [{"id": "app", "label": "App", "icon": "phone"},
                                                   {"id": "bank", "label": "Bank", "icon": "bank"}]}
    result = tools.show_blocks({"blocks": [flow]})
    assert "isn't one of the catalog icons" in result
    assert result.endswith(importlib.import_module("hermes_genui.core.catalog_text").icons_line())


# --- the placement words --------------------------------------------------------------------------------------------


def test_a_board_align_comes_back_as_an_envelope(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE], "align": " Center "})
    board = plugin_store.load(stored_id(result), root=store_dir)
    assert board == {"align": "center", "blocks": [TIMELINE]}


def test_a_board_text_align_rides_the_same_envelope(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE], "text_align": "right"})
    board = plugin_store.load(stored_id(result), root=store_dir)
    assert board == {"text_align": "right", "blocks": [TIMELINE]}


def test_both_words_share_the_one_envelope(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE], "align": "center", "text_align": "center"})
    board = plugin_store.load(stored_id(result), root=store_dir)
    assert board == {"align": "center", "text_align": "center", "blocks": [TIMELINE]}


def test_no_word_or_a_junk_word_stores_the_plain_list(store_dir):
    for params in ({"blocks": [TIMELINE]}, {"blocks": [TIMELINE], "align": "middle"},
                   {"blocks": [TIMELINE], "text_align": 7}):
        result = tools.show_blocks(dict(params))
        assert plugin_store.load(stored_id(result), root=store_dir) == [TIMELINE]


def test_centering_one_block_leaves_the_board_default_left(store_dir):
    # Sagar's note: "center the verdict" centered the WHOLE board because the model reached for the call's
    # words. The ask for ONE block belongs to that block, and the tool must never turn a block's align into
    # a board word: the board stays a plain list (board default left) and the word rides inside the block.
    text = {"type": "text", "text": "A verdict worth centering"}
    blocks = [{"type": "heading", "text": "Picks"}, {**text, "align": "center"}]
    result = tools.show_blocks({"blocks": blocks})
    board = plugin_store.load(stored_id(result), root=store_dir)
    assert board == blocks  # stored plain, the ask living inside the block's own JSON
    assert plugin_store.align_of(board) is None
    assert plugin_store.text_align_of(board) is None


def test_the_menu_points_a_single_block_ask_at_the_block():
    # The guidance fix for the same note: the menu must say, in the model's own words, that one block's ask
    # is that block's word, and that the call's board words move the whole board.
    menu = importlib.import_module("hermes_genui.core.catalog_text").menu()
    assert "say it on that block" in menu
    assert "move the whole board" in menu


def test_the_board_words_say_they_move_the_whole_board():
    props = tools.SHOW_BLOCKS_SCHEMA["parameters"]["properties"]
    assert "moves the whole board" in props["align"]["description"]
    assert "moves the whole board" in props["text_align"]["description"]
    # and the two asks stay distinct: the text word reads words, it never sits the cards.
    assert "never where cards sit" in props["text_align"]["description"]


def test_an_included_envelope_board_lends_only_its_blocks(store_dir):
    board_id = plugin_store.save({"align": "center", "blocks": [TIMELINE]}, root=store_dir)
    layout = [{"type": "row", "children": [{"type": "include", "id": board_id}]}]
    result = tools.show_blocks({"blocks": layout})
    stored = plugin_store.load(stored_id(result), root=store_dir)
    assert stored == [{"type": "row", "children": [TIMELINE]}]  # the kept board's own words stay on its board


def test_the_envelope_words_count_in_the_boards_size(store_dir, monkeypatch):
    import json as _json
    monkeypatch.setattr(plugin_store, "BOARD_LIMIT", len(_json.dumps([TIMELINE])) + 20)
    plain = tools.show_blocks({"blocks": [TIMELINE]})
    assert plain.startswith("Drawn.")
    big = tools.show_blocks({"blocks": [TIMELINE], "align": "center", "text_align": "center"})
    assert big.startswith("Not drawn: board too big (")
# --- provenance: as_of and live ride in the same envelope the living words use -----------------------------------

def test_board_provenance_is_stored_beside_the_blocks(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE], "as_of": "2026-11-18", "live": True})
    assert plugin_store.load(stored_id(result), root=store_dir) == {"as_of": "2026-11-18", "live": True,
                                                                    "blocks": [TIMELINE]}


def test_provenance_and_links_share_one_envelope(store_dir):
    other = plugin_store.save([TIMELINE], root=store_dir)
    result = tools.show_blocks({"blocks": [TIMELINE], "links": [other],
                                "as_of": " Nov 18 ", "live": False})
    assert plugin_store.load(stored_id(result), root=store_dir) == {"links": [{"id": other}],
                                                                   "as_of": "Nov 18", "live": False,
                                                                   "blocks": [TIMELINE]}


def test_live_false_is_kept_as_a_word(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE], "live": False})
    assert plugin_store.load(stored_id(result), root=store_dir) == {"live": False, "blocks": [TIMELINE]}


def test_unknown_provenance_is_ignored(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE], "as_of": 5, "live": "yes"})
    assert plugin_store.load(stored_id(result), root=store_dir) == [TIMELINE]


def test_a_blank_as_of_is_ignored(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE], "as_of": "   "})
    assert plugin_store.load(stored_id(result), root=store_dir) == [TIMELINE]


def test_a_long_as_of_is_cut_to_the_footer_line(store_dir):
    result = tools.show_blocks({"blocks": [TIMELINE], "as_of": "x" * 200})
    assert plugin_store.load(stored_id(result), root=store_dir) == {"as_of": "x" * 80, "blocks": [TIMELINE]}


def test_including_a_board_keeps_its_blocks_and_not_its_provenance(store_dir):
    board_id = plugin_store.save({"as_of": "2026-11-18", "live": True, "blocks": [TIMELINE]}, root=store_dir)
    result = tools.show_blocks({"blocks": [{"type": "include", "id": board_id}]})
    assert plugin_store.load(stored_id(result), root=store_dir) == [TIMELINE]
