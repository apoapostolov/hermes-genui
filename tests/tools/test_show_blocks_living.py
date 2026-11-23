"""Living Boards at the tool door: show_blocks gains two optional words.

  · `target` — the address (the id) of a board already drawn: the new blocks are written AT THAT ADDRESS as a
    new version, the answer is the SAME tag, and the live board in the chat updates instead of a second board
    being born. A wrong or unknown address is refused with a clear problem (never silently drawn fresh).
  · `links` — 1-3 other boards this one connects to, each by address with an optional one-line note (the
    AI-suggested connection). Every linked address must name a real stored board; the drawing side fetches
    them from the store by address — reach-back without redrawing.

A board with neither word is answered exactly as it always was (byte-for-byte): this is what every unsaid
board regression downstream leans on.
"""

import importlib

import pytest

from conftest import load_plugin_package

load_plugin_package()
tools = importlib.import_module("hermes_genui.tools.show_blocks")
plugin_store = importlib.import_module("hermes_genui.core.store")

HEAD = {"type": "heading", "text": "Portfolio · Q4"}
KPI = {"type": "stat", "value": "$128k", "label": "up 12.4% on the quarter"}


@pytest.fixture
def store_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin_store, "default_root", lambda: tmp_path)
    return tmp_path


def stored_id(result: str) -> str:
    last = result.strip().splitlines()[-1]
    assert last.startswith('::blocks{id="') and last.endswith('"}'), result
    return last[len('::blocks{id="'):-2]


# --- target: update-in-place ---------------------------------------------------------------------------------------


def test_target_writes_a_new_version_at_the_same_address(store_dir):
    board_id = stored_id(tools.show_blocks({"blocks": [HEAD, KPI]}))
    nvda = {"type": "stat", "value": "NVDA +34%", "label": "best mover"}
    result = tools.show_blocks({"blocks": [HEAD, KPI, nvda], "target": board_id})
    assert stored_id(result) == board_id                       # the same tag — the address was kept
    board = plugin_store.load(board_id, root=store_dir)
    assert plugin_store.version_of(board) == 2
    assert plugin_store.blocks_of(board)[2] == nvda
    assert "v2" in result and "same" in result.lower()         # the answer tells the model what it did


def test_target_answer_carries_the_unchanged_paste_line(store_dir):
    board_id = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    result = tools.show_blocks({"blocks": [{"type": "heading", "text": "later"}], "target": board_id})
    assert (f"Drawn. Now write your reply, with this line on its own, exactly as it is (don't draw it again):\n"
            f'::blocks{{id="{board_id}"}}') in result


def test_target_is_accepted_with_a_leading_hash_and_case(store_dir):
    board_id = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    result = tools.show_blocks({"blocks": [HEAD], "target": f"#{board_id.upper()}"})
    assert stored_id(result) == board_id                       # and it still answers the lower-case address
    assert plugin_store.version_of(plugin_store.load(board_id, root=store_dir)) == 2


def test_unknown_target_is_refused_and_nothing_new_is_drawn(store_dir):
    result = tools.show_blocks({"blocks": [HEAD], "target": "0badc0de"})
    assert result.startswith("Not drawn.")
    assert "0badc0de" in result and "no stored board" in result
    assert list(store_dir.glob("*.json")) == []                # the refusal touched no disk


def test_target_naming_another_profiles_board_is_refused_and_untouched(store_dir, tmp_path, monkeypatch):
    """A write stays in this profile: an address whose board belongs to another profile's store is not a
    board HERE for updating — the tool refuses it the way it refuses an unknown one, and nothing is written."""
    other = tmp_path / "other-profile"
    other.mkdir()
    board_id = plugin_store.save([HEAD], root=other)
    monkeypatch.setattr(plugin_store, "profile_stores", lambda: [store_dir, other])
    result = tools.show_blocks({"blocks": [KPI], "target": board_id})
    assert result.startswith("Not drawn.")
    assert plugin_store.load(board_id, root=other) == [HEAD]  # the other profile's bytes untouched
    assert plugin_store.load_versions(board_id, root=other) == []  # and nothing archived there


def test_malformed_target_is_refused_with_the_address_rule(store_dir):
    result = tools.show_blocks({"blocks": [HEAD], "target": "sevenbeef"})
    assert result.startswith("Not drawn.")
    assert "target" in result


def test_target_too_big_is_refused_with_history_intact(store_dir):
    board_id = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    result = tools.show_blocks({"blocks": [{"type": "text", "text": "x" * (plugin_store.BOARD_LIMIT + 10)}],
                                "target": board_id})
    assert "too big" in result
    assert plugin_store.version_of(plugin_store.load(board_id, root=store_dir)) is None  # v1 untouched
    assert plugin_store.load_versions(board_id, root=store_dir) == []


# --- the create path stays byte-stable ------------------------------------------------------------------------------


def test_create_answer_text_is_byte_stable(store_dir):
    # exact literal the accepted base answers with: nothing living-boards adds may touch it
    result = tools.show_blocks({"blocks": [HEAD]})
    board_id = stored_id(result)
    assert result == ("Drawn. Now write your reply, with this line on its own, exactly as it is "
                      f'(don\'t draw it again):\n::blocks{{id="{board_id}"}}')


def test_unsaid_boards_stay_plain_lists_on_disk(store_dir):
    board_id = stored_id(tools.show_blocks({"blocks": [HEAD, KPI]}))
    board = plugin_store.load(board_id, root=store_dir)
    assert isinstance(board, list)                             # the stored bytes never changed shape
    assert plugin_store.version_of(board) is None              # an unsaid board says no version


# --- links: reach-back by address ----------------------------------------------------------------------------------


def test_links_store_addresses_and_notes(store_dir):
    q3 = stored_id(tools.show_blocks({"blocks": [{"type": "heading", "text": "Portfolio · Q3"}]}))
    result = tools.show_blocks({"blocks": [HEAD], "links": [{"id": q3, "note": "last quarter"}]})
    board = plugin_store.load(stored_id(result), root=store_dir)
    assert plugin_store.links_of(board) == [{"id": q3, "note": "last quarter"}]


def test_link_note_is_optional_and_bare_addresses_fit(store_dir):
    other = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    result = tools.show_blocks({"blocks": [HEAD], "links": [other]})
    board = plugin_store.load(stored_id(result), root=store_dir)
    assert plugin_store.links_of(board) == [{"id": other}]


def test_links_survive_into_the_new_version_of_the_board(store_dir):
    other = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    board_id = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    result = tools.show_blocks({"blocks": [{"type": "heading", "text": "Q4 v2"}],
                                "target": board_id, "links": [other]})
    assert stored_id(result) == board_id
    board = plugin_store.load(board_id, root=store_dir)
    assert plugin_store.links_of(board) == [{"id": other}]
    assert plugin_store.version_of(board) == 2


def test_link_to_an_unknown_address_is_refused(store_dir):
    result = tools.show_blocks({"blocks": [HEAD], "links": ["0badc0de"]})
    assert result.startswith("Not drawn.")
    assert "no stored board" in result


def test_a_board_never_links_to_itself(store_dir):
    board_id = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    result = tools.show_blocks({"blocks": [HEAD], "target": board_id,
                                "links": [{"id": board_id, "note": "me again"}]})
    assert result.startswith("Not drawn.")
    assert "itself" in result


def test_too_many_links_is_refused_with_the_count_rule(store_dir):
    ids = [stored_id(tools.show_blocks({"blocks": [HEAD]})) for _ in range(4)]
    result = tools.show_blocks({"blocks": [HEAD], "links": ids})
    assert result.startswith("Not drawn.")
    assert "1-3" in result


def test_duplicate_link_addresses_collapse_to_one(store_dir):
    other = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    result = tools.show_blocks({"blocks": [HEAD], "links": [other, {"id": f"#{other.upper()}"}]})
    board = plugin_store.load(stored_id(result), root=store_dir)
    assert plugin_store.links_of(board) == [{"id": other}]


def test_malformed_link_shape_is_refused(store_dir):
    result = tools.show_blocks({"blocks": [HEAD], "links": "yes please"})
    assert result.startswith("Not drawn.")
    assert "links" in result


def test_non_text_link_note_is_refused(store_dir):
    other = stored_id(tools.show_blocks({"blocks": [HEAD]}))
    result = tools.show_blocks({"blocks": [HEAD], "links": [{"id": other, "note": 7}]})
    assert result.startswith("Not drawn.")


# --- the schema says the words --------------------------------------------------------------------------------------


def test_schema_carries_target_and_links():
    schema = tools.SHOW_BLOCKS_SCHEMA["parameters"]["properties"]
    assert "target" in schema and "links" in schema
    assert "address" in schema["target"]["description"]
    assert "address" in schema["links"]["description"]


def test_describe_budget_untouched():
    # the catalog's describe() is the pinned text: living boards must not grow it
    from hermes_genui.core.catalog_text import describe
    assert "target" not in describe() and "Living" not in describe()
