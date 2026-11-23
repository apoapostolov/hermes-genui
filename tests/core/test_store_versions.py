"""Living Boards: a board's id is its address, and update() writes a NEW version at that SAME address — the
old content is archived beside it, reachable via ?version=N within the store's BOUNDED history (newest
HISTORY_MAX versions under HISTORY_LIMIT bytes, oldest dropped past them). No delete, no parallel store: the
board file keeps its name and the history rides in a <id>.versions.json sidecar.

The semantics pinned here:
  · update() answers the same address it was given; the new envelope carries version+updated_at;
  · the version that was current when update ran is archived, oldest-first, capped;
  · a legacy plain-list board updates to version 2 like any other (its list is the first version);
  · an address with no board is NoSuchBlock — the store refuses to update a lie;
  · load()/save() answers for an UNSAID board are exactly what they always were.
"""

import importlib

import pytest

from conftest import load_plugin_package

load_plugin_package()
store = importlib.import_module("hermes_genui.core.store")


def _v1():
    return [{"type": "heading", "text": "Portfolio · Q4"},
            {"type": "kpis", "items": [{"label": "Value", "value": "$128k"}]}]


def _v2():
    return _v1() + [{"type": "kpis", "items": [{"label": "Best", "value": "NVDA"}]}]


# --- update writes at the address, bumping the version -------------------------------------------------------------


def test_update_keeps_the_same_address_and_bumps_the_version(tmp_path):
    block_id = store.save(_v1(), root=tmp_path)
    updated = store.update(block_id, _v2(), root=tmp_path)
    assert updated == block_id  # the address IS the id: no new board was born
    board = store.load(block_id, root=tmp_path)
    assert store.blocks_of(board)[2]["items"][0]["value"] == "NVDA"
    assert store.version_of(board) == 2
    assert isinstance(store.updated_at_of(board), str) and store.updated_at_of(board)


def test_update_words_belong_to_the_version_that_said_them(tmp_path):
    block_id = store.save({"links": [{"id": "aabbccdd"}], "blocks": _v1()}, root=tmp_path)
    assert store.version_of(store.load(block_id, root=tmp_path)) is None  # a saved board says no version
    store.update(block_id, [{"type": "heading", "text": "Now"}], root=tmp_path)
    board = store.load(block_id, root=tmp_path)
    assert store.version_of(board) == 2
    assert store.links_of(board) is None  # the old envelope does not leak into the new one


def test_update_archives_every_prior_version_oldest_first(tmp_path):
    block_id = store.save(_v1(), root=tmp_path)
    store.update(block_id, [{"type": "heading", "text": "two"}], root=tmp_path)
    store.update(block_id, [{"type": "heading", "text": "three"}], root=tmp_path)
    history = store.load_versions(block_id, root=tmp_path)
    assert [entry["version"] for entry in history] == [1, 2]
    assert store.blocks_of(history[0]["board"])[0]["text"] == "Portfolio · Q4"  # v1, kept whole
    assert store.blocks_of(history[1]["board"])[0]["text"] == "two"             # v2, kept whole
    # and the current version is not in the archive: it answers load() as it always has
    assert store.blocks_of(store.load(block_id, root=tmp_path))[0]["text"] == "three"


def test_load_versions_of_a_board_never_updated_is_empty(tmp_path):
    block_id = store.save(_v1(), root=tmp_path)
    assert store.load_versions(block_id, root=tmp_path) == []


# --- the guards ----------------------------------------------------------------------------------------------------


def test_update_of_a_malformed_or_unknown_address_is_no_such_block(tmp_path):
    with pytest.raises(store.NoSuchBlock):
        store.update("../etc/passwd", _v1(), root=tmp_path)
    with pytest.raises(store.NoSuchBlock):
        store.update("0badc0de", _v1(), root=tmp_path)


def test_update_refuses_a_board_over_the_limit_with_history_intact(tmp_path):
    block_id = store.save(_v1(), root=tmp_path)
    with pytest.raises(store.BoardTooBig):
        store.update(block_id, [{"type": "text", "text": "x" * (store.BOARD_LIMIT + 10)}], root=tmp_path)
    assert store.version_of(store.load(block_id, root=tmp_path)) is None  # the old current is untouched
    assert store.load_versions(block_id, root=tmp_path) == []            # and nothing was archived


def test_history_is_capped_to_the_newest_versions(tmp_path):
    block_id = store.save(_v1(), root=tmp_path)
    for i in range(store.HISTORY_MAX + 4):
        store.update(block_id, [{"type": "heading", "text": f"edit {i}"}], root=tmp_path)
    history = store.load_versions(block_id, root=tmp_path)
    live = store.version_of(store.load(block_id, root=tmp_path))
    assert live == 1 + store.HISTORY_MAX + 4
    assert len(history) == store.HISTORY_MAX
    assert [entry["version"] for entry in history] == list(range(live - store.HISTORY_MAX, live))


# --- writes stay in the active profile -------------------------------------------------------------------------------


def _two_stores(tmp_path):
    """Two profile stores on one machine: the active one, and one holding a board seen only by reaching across."""
    active, other = tmp_path / "active", tmp_path / "other"
    active.mkdir()
    other.mkdir()
    return active, other


def test_a_write_never_touches_another_profiles_board(tmp_path, monkeypatch):
    """store.update resolves the address in the ACTIVE profile's store alone. A board owned by another profile
    reads from here (find_root, issue #6) but is not a board here for writing: NoSuchBlock, its bytes unchanged."""
    active, other = _two_stores(tmp_path)
    block_id = store.save(_v1(), root=other)
    monkeypatch.setattr(store, "default_root", lambda: active)
    monkeypatch.setattr(store, "profile_stores", lambda: [active, other])
    assert store.find_root(block_id) == other  # the read still reaches across
    with pytest.raises(store.NoSuchBlock):
        store.update(block_id, _v2())  # the write does not
    assert store.load(block_id, root=other) == _v1()  # the other profile's board is as it was
    assert not (other / f"{block_id}{store.HISTORY_SUFFIX}").exists()  # and nothing was archived there


def test_the_active_profiles_own_board_still_updates_with_no_root(tmp_path, monkeypatch):
    active, other = _two_stores(tmp_path)
    monkeypatch.setattr(store, "default_root", lambda: active)
    monkeypatch.setattr(store, "profile_stores", lambda: [active, other])
    block_id = store.save(_v1())  # born in the active profile
    assert store.update(block_id, _v2()) == block_id  # its own address resolves for a write
    assert store.version_of(store.load(block_id, root=active)) == 2


def test_reading_another_profiles_board_across_is_still_served(tmp_path, monkeypatch):
    """The write scope does not shrink a read: find_root, load and a version's reach-back still answer for a
    board owned by another profile while this one is active (issue #6)."""
    active, other = _two_stores(tmp_path)
    block_id = store.save(_v1(), root=other)
    store.update(block_id, _v2(), root=other)  # its history lives with it, over there
    monkeypatch.setattr(store, "default_root", lambda: active)
    monkeypatch.setattr(store, "profile_stores", lambda: [active, other])
    assert store.find_root(block_id) == other
    board = store.load(block_id, store.find_root(block_id))  # how the REST door reaches a board not born here
    assert store.version_of(board) == 2
    assert [e["version"] for e in store.load_versions(block_id)] == [1]


# --- readers over the stored shapes --------------------------------------------------------------------------------


def test_a_plain_list_is_its_own_blocks():
    assert store.blocks_of(_v1()) == _v1()
    assert store.blocks_of({"blocks": _v1()}) == _v1()
    assert store.blocks_of(None) == []
    assert store.blocks_of({"blocks": "no"}) == []


def test_version_and_links_readers_are_lenient_like_every_word():
    assert store.version_of({"version": 2, "blocks": []}) == 2
    assert store.version_of({"version": "2", "blocks": []}) is None   # text is not a number here
    assert store.version_of({"version": True, "blocks": []}) is None  # and not a bool
    assert store.version_of({"version": 0, "blocks": []}) is None     # versions start at one
    assert store.version_of([{"type": "divider"}]) is None
    assert store.links_of({"links": [{"id": "7f3a09bc"}], "blocks": []}) == [{"id": "7f3a09bc"}]
    assert store.links_of({"links": "7f3a09bc", "blocks": []}) is None
    assert store.links_of({"links": [], "blocks": []}) is None
    assert store.updated_at_of({"updated_at": "2026-11-19T21:00:00+00:00", "blocks": []}) == "2026-11-19T21:00:00+00:00"
    assert store.updated_at_of({"updated_at": 5, "blocks": []}) is None
