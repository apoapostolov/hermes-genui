"""The living-board door: GET /blocks/{id} carries the version words when a board has them, an archived
version answers GET /blocks/{id}?version=N in the SAME shape as the live one (so the viewer can reach back
without redrawing), and GET /blocks/{id}/versions lists what history exists.

Unsaid boards answer exactly what they always answered — no version key, no links key, nothing new.
"""

import importlib.util

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from conftest import ROOT


@pytest.fixture
def client(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("hb_plugin_api", ROOT / "dashboard" / "plugin_api.py")
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    monkeypatch.setattr(api.store, "default_root", lambda: tmp_path)
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app), api


V1 = [{"type": "heading", "text": "Portfolio · Q4"}, {"type": "text", "text": "three holdings"}]


def _updated(api, tmp_path):
    other = api.store.save([{"type": "heading", "text": "Portfolio · Q3"}], root=tmp_path)
    board_id = api.store.save(V1, root=tmp_path)
    api.store.update(board_id, {"blocks": V1 + [{"type": "text", "text": "plus NVDA"}],
                                "links": [{"id": other, "note": "last quarter"}]}, root=tmp_path)
    return board_id, other


# --- unsaid boards answer exactly as they always did ----------------------------------------------------------------


def test_unsaid_board_carries_no_version_keys(client, tmp_path):
    http, api = client
    block_id = api.store.save(V1, root=tmp_path)
    answer = http.get(f"/blocks/{block_id}").json()
    assert answer == {"blocks": V1}  # the accepted shape, byte for byte: no new keys
    assert http.get(f"/blocks/{block_id}/versions").json() == {"versions": []}


# --- the live answer speaks its words --------------------------------------------------------------------------------


def test_updated_board_answers_current_version_with_its_words(client, tmp_path):
    http, api = client
    block_id, other = _updated(api, tmp_path)
    answer = http.get(f"/blocks/{block_id}").json()
    assert answer["blocks"] == V1 + [{"type": "text", "text": "plus NVDA"}]  # the envelope never leaks
    assert answer["version"] == 2
    assert isinstance(answer["updated_at"], str) and answer["updated_at"]
    assert answer["links"] == [{"id": other, "note": "last quarter"}]


# --- reach-back: an archived version answers in the same shape -------------------------------------------------------


def test_version_one_answers_from_the_archive(client, tmp_path):
    http, api = client
    block_id, _ = _updated(api, tmp_path)
    answer = http.get(f"/blocks/{block_id}", params={"version": "1"}).json()
    assert answer["blocks"] == V1
    assert answer["version"] == 1


def test_version_three_with_nothing_behind_it_is_a_404(client, tmp_path):
    http, api = client
    block_id, _ = _updated(api, tmp_path)
    assert http.get(f"/blocks/{block_id}", params={"version": "3"}).status_code == 404


def test_an_unusable_version_number_is_a_400(client, tmp_path):
    http, api = client
    block_id, _ = _updated(api, tmp_path)
    assert http.get(f"/blocks/{block_id}", params={"version": "x"}).status_code == 400


# --- what history exists ---------------------------------------------------------------------------------------------


def test_versions_route_lists_history_newest_first(client, tmp_path):
    http, api = client
    block_id, _ = _updated(api, tmp_path)
    api.store.update(block_id, {"blocks": [{"type": "heading", "text": "v3"}]}, root=tmp_path)
    rows = http.get(f"/blocks/{block_id}/versions").json()["versions"]
    assert [r["version"] for r in rows] == [3, 2, 1]
    assert rows[0]["current"] is True
    assert rows[1]["current"] is False
    assert isinstance(rows[1]["saved_at"], str) and rows[1]["saved_at"]  # v2 knows when v1 was current


# --- state at an address that took updates stays a state door ---------------------------------------------------------


def test_state_still_round_trips_at_a_living_address(client, tmp_path):
    http, api = client
    block_id, _ = _updated(api, tmp_path)
    assert http.put(f"/blocks/{block_id}/state", json={"state": {"0": [1]}}).status_code == 200
    assert http.get(f"/blocks/{block_id}/state").json() == {"state": {"0": [1]}}
