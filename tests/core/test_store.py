import importlib
import re

import pytest

from conftest import load_plugin_package

load_plugin_package()
store = importlib.import_module("hermes_genui.core.store")


def test_save_then_load_round_trips(tmp_path):
    blocks = [{"type": "text", "text": "hi"}]
    block_id = store.save(blocks, root=tmp_path)
    assert re.fullmatch(store.ID_PATTERN, block_id)
    assert store.load(block_id, root=tmp_path) == blocks


def test_save_keeps_unicode_readable(tmp_path):
    block_id = store.save([{"type": "text", "text": "₹72,275 Cr"}], root=tmp_path)
    assert "₹72,275 Cr" in (tmp_path / f"{block_id}.json").read_text(encoding="utf-8")


def test_load_rejects_bad_ids(tmp_path):
    assert store.load("../etc/passwd", root=tmp_path) is None
    assert store.load("ABCDEF12", root=tmp_path) is None
    assert store.load("", root=tmp_path) is None


def test_load_missing_returns_none(tmp_path):
    assert store.load("0badc0de", root=tmp_path) is None


def test_state_round_trips_next_to_its_block(tmp_path):
    block_id = store.save([{"type": "checklist", "items": ["Passport"]}], root=tmp_path)
    assert store.load_state(block_id, root=tmp_path) == {}
    store.save_state(block_id, {"0": [0, 2]}, root=tmp_path)
    assert store.load_state(block_id, root=tmp_path) == {"0": [0, 2]}
    assert (tmp_path / f"{block_id}.state.json").is_file()


def test_state_for_a_bad_id_is_empty_and_never_touches_the_disk(tmp_path):
    assert store.load_state("../etc/passwd", root=tmp_path) == {}
    with pytest.raises(store.NoSuchBlock):
        store.save_state("../etc/passwd", {"0": [1]}, root=tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_state_for_an_unknown_block_is_refused(tmp_path):
    with pytest.raises(store.NoSuchBlock):
        store.save_state("0badc0de", {"0": [1]}, root=tmp_path)
    assert not (tmp_path / "0badc0de.state.json").exists()


def test_state_over_20kb_is_refused(tmp_path):
    block_id = store.save([{"type": "text", "text": "hi"}], root=tmp_path)
    with pytest.raises(store.StateTooBig):
        store.save_state(block_id, {"0": "x" * 21_000}, root=tmp_path)
    assert store.load_state(block_id, root=tmp_path) == {}
    store.save_state(block_id, {"0": "x" * 19_000}, root=tmp_path)


def test_a_board_over_256kb_is_refused(tmp_path):
    with pytest.raises(store.BoardTooBig):
        store.save([{"type": "text", "text": "x" * (260 * 1024)}], root=tmp_path)
    assert list(tmp_path.iterdir()) == []


# --- hygiene: whole files only, unreadable files are absent, the photo list stays short ------------------------------

import os  # noqa: E402
from pathlib import Path  # noqa: E402


def test_boards_and_state_are_written_whole_then_moved_into_place(tmp_path, monkeypatch):
    moves = []
    real_replace = os.replace

    def spy(src, dst):
        src, dst = Path(src), Path(dst)
        moves.append((src.name, dst.name, src.parent == dst.parent))
        real_replace(src, dst)

    monkeypatch.setattr(os, "replace", spy)
    block_id = store.save([{"type": "text", "text": "hi"}], root=tmp_path)
    store.save_state(block_id, {"0": [1]}, root=tmp_path)
    assert moves == [(f"{block_id}.json.tmp", f"{block_id}.json", True),
                     (f"{block_id}.state.json.tmp", f"{block_id}.state.json", True)]
    assert sorted(p.name for p in tmp_path.iterdir()) == [f"{block_id}.json", f"{block_id}.state.json"]


def test_an_unreadable_board_or_state_is_treated_as_missing(tmp_path):
    (tmp_path / "0badc0de.json").write_text("[{not json", encoding="utf-8")
    (tmp_path / "0badc0de.state.json").write_text("{half", encoding="utf-8")
    assert store.load("0badc0de", root=tmp_path) is None
    assert store.load_state("0badc0de", root=tmp_path) == {}


def test_the_photo_list_keeps_only_the_last_500(tmp_path):
    store.remember_photo_urls([f"https://a.example/{i}.jpg" for i in range(450)], root=tmp_path)
    store.remember_photo_urls([f"https://b.example/{i}.jpg" for i in range(100)], root=tmp_path)
    known = store.known_photo_urls(root=tmp_path)
    assert len(known) == 500
    assert "https://a.example/49.jpg" not in known and "https://a.example/50.jpg" in known
    assert "https://b.example/99.jpg" in known


def test_a_board_is_found_in_the_first_store_that_holds_it(tmp_path):
    active, other = tmp_path / "active", tmp_path / "other"
    mine = store.save([{"type": "text", "text": "mine"}], root=active)
    theirs = store.save([{"type": "text", "text": "theirs"}], root=other)
    assert store.find_root(mine, roots=[active, other]) == active
    assert store.find_root(theirs, roots=[active, other]) == other
    assert store.find_root("0badc0de", roots=[active, other]) is None
    assert store.find_root("../etc/passwd", roots=[active, tmp_path]) is None


def test_every_profile_store_is_listed_root_first(tmp_path):
    for name in ("work", "alpha", ".deleted"):
        (tmp_path / "profiles" / name).mkdir(parents=True)
    (tmp_path / "profiles" / "notes.txt").write_text("not a profile", encoding="utf-8")
    tail = store.STORE_DIR
    assert store.profile_stores(tmp_path) == [
        tmp_path / tail, tmp_path / "profiles" / "alpha" / tail, tmp_path / "profiles" / "work" / tail,
    ]


def test_without_a_profiles_folder_only_the_root_store_is_listed(tmp_path):
    assert store.profile_stores(tmp_path) == [tmp_path / store.STORE_DIR]


class FakeSecrets:
    """Hands out the given ids in order, so a test can make the first pick one that is already taken."""

    def __init__(self, *ids):
        self.ids = list(ids)

    def token_hex(self, _nbytes):
        return self.ids.pop(0)


def test_a_new_board_never_takes_an_id_already_in_its_store(tmp_path, monkeypatch):
    old = [{"type": "text", "text": "old"}]
    (tmp_path / "aaaaaaaa.json").write_text('[{"type": "text", "text": "old"}]', encoding="utf-8")
    monkeypatch.setattr(store, "secrets", FakeSecrets("aaaaaaaa", "bbbbbbbb"))
    assert store.save([{"type": "text", "text": "new"}], root=tmp_path) == "bbbbbbbb"
    assert store.load("aaaaaaaa", root=tmp_path) == old


def test_a_new_board_never_takes_an_id_used_in_another_profile(tmp_path, monkeypatch):
    active, other = tmp_path / "active", tmp_path / "other"
    store.save([{"type": "text", "text": "theirs"}], root=other)
    taken = next(other.glob("*.json")).stem
    monkeypatch.setattr(store, "default_root", lambda: active)
    monkeypatch.setattr(store, "profile_stores", lambda: [active, other])
    monkeypatch.setattr(store, "secrets", FakeSecrets(taken, "bbbbbbbb"))
    assert store.save([{"type": "text", "text": "mine"}]) == "bbbbbbbb"
    assert not (active / f"{taken}.json").exists()


# --- the two shapes a stored board comes in -------------------------------------------------------------------------

TEXT = {"type": "text", "text": "hi"}


def test_blocks_of_takes_the_blocks_of_either_shape():
    assert store.blocks_of([TEXT]) == [TEXT]
    assert store.blocks_of({"align": "center", "blocks": [TEXT]}) == [TEXT]
    assert store.blocks_of({"text_align": "right", "blocks": [TEXT]}) == [TEXT]
    assert store.blocks_of(None) == []
    assert store.blocks_of({"blocks": "not a list"}) == []
    assert store.blocks_of([TEXT, {"blocks": [TEXT]}]) == [TEXT, {"blocks": [TEXT]}]


def test_the_board_words_come_from_the_envelope_only():
    assert store.align_of({"align": "center", "blocks": [TEXT]}) == "center"
    assert store.align_of({"align": "whatever", "blocks": [TEXT]}) == "whatever"  # checked where it is drawn
    assert store.align_of([TEXT]) is None
    assert store.align_of(None) is None
    assert store.text_align_of({"text_align": "right", "blocks": [TEXT]}) == "right"
    assert store.text_align_of({"align": "right", "blocks": [TEXT]}) is None
    assert store.text_align_of([TEXT]) is None


def test_an_envelope_board_round_trips(tmp_path):
    board = {"align": "center", "text_align": "center", "blocks": [TEXT]}
    block_id = store.save(board, root=tmp_path)
    assert store.load(block_id, root=tmp_path) == board
