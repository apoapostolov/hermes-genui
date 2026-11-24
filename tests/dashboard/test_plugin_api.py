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


def test_api_returns_blocks(client, tmp_path):
    http, api = client
    block_id = api.store.save([{"type": "text", "text": "hi"}], root=tmp_path)
    response = http.get(f"/blocks/{block_id}")
    assert response.status_code == 200
    assert response.json() == {"blocks": [{"type": "text", "text": "hi"}]}


def test_an_envelope_board_answers_with_its_blocks_and_its_words(client, tmp_path):
    http, api = client
    block_id = api.store.save({"align": "center", "text_align": "right",
                               "blocks": [{"type": "text", "text": "hi"}]}, root=tmp_path)
    response = http.get(f"/blocks/{block_id}")
    assert response.status_code == 200
    assert response.json() == {"blocks": [{"type": "text", "text": "hi"}],
                               "align": "center", "text_align": "right"}



def test_api_404_for_unknown(client):
    http, _ = client
    response = http.get("/blocks/0badc0de")
    assert response.status_code == 404
    assert response.json() == {"error": "not found"}


def test_state_is_empty_until_saved_then_comes_back(client, tmp_path):
    http, api = client
    block_id = api.store.save([{"type": "checklist", "items": ["Passport", "Tickets"]}], root=tmp_path)
    assert http.get(f"/blocks/{block_id}/state").json() == {}
    response = http.put(f"/blocks/{block_id}/state", json={"state": {"0": [1]}})
    assert response.status_code == 200
    assert http.get(f"/blocks/{block_id}/state").json() == {"state": {"0": [1]}}


def test_state_404_for_bad_or_unknown_ids(client):
    http, _ = client
    for bad in ("0badc0de", "NOPE1234"):
        assert http.get(f"/blocks/{bad}/state").status_code == 404
        assert http.put(f"/blocks/{bad}/state", json={"state": {}}).status_code == 404


def test_state_413_when_too_big(client, tmp_path):
    http, api = client
    block_id = api.store.save([{"type": "text", "text": "hi"}], root=tmp_path)
    response = http.put(f"/blocks/{block_id}/state", json={"state": {"0": "x" * 30_000}})
    assert response.status_code == 413


def test_state_400_when_not_an_object(client, tmp_path):
    http, api = client
    block_id = api.store.save([{"type": "text", "text": "hi"}], root=tmp_path)
    assert http.put(f"/blocks/{block_id}/state", json={"state": [1, 2]}).status_code == 400
    assert http.put(f"/blocks/{block_id}/state", json=[1]).status_code == 400


def test_an_unreadable_board_is_404_not_500(client, tmp_path):
    http, _ = client
    (tmp_path / "0badc0de.json").write_text("[{not json", encoding="utf-8")
    assert http.get("/blocks/0badc0de").status_code == 404
    assert http.get("/blocks/0badc0de/state").status_code == 404


def test_state_body_over_32kb_is_413_before_it_is_read(client, tmp_path):
    http, api = client
    block_id = api.store.save([{"type": "text", "text": "hi"}], root=tmp_path)
    response = http.put(f"/blocks/{block_id}/state", json={"state": {}, "padding": "x" * (40 * 1024)})
    assert response.status_code == 413
    assert http.get(f"/blocks/{block_id}/state").json() == {}


def test_state_body_without_a_length_is_cut_off_at_32kb(client, tmp_path):
    http, api = client
    block_id = api.store.save([{"type": "text", "text": "hi"}], root=tmp_path)

    def chunks():
        yield b'{"state": {}, "padding": "'
        for _ in range(40):
            yield b"x" * 1024
        yield b'"}'

    response = http.put(f"/blocks/{block_id}/state", content=chunks(), headers={"content-type": "application/json"})
    assert response.status_code == 413
    assert http.get(f"/blocks/{block_id}/state").json() == {}



def test_a_board_from_another_profile_draws_and_keeps_its_ticks_there(client, tmp_path, monkeypatch):
    """Desktop asks the active profile for every board, so a session from another profile must still find its own."""
    http, api = client
    other = tmp_path / "profiles" / "claude" / "blocks"
    monkeypatch.setattr(api.store, "profile_stores", lambda: [other])
    block_id = api.store.save([{"type": "checklist", "items": ["Passport"]}], root=other)
    assert http.get(f"/blocks/{block_id}").json() == {"blocks": [{"type": "checklist", "items": ["Passport"]}]}
    assert http.put(f"/blocks/{block_id}/state", json={"state": {"0": [0]}}).status_code == 200
    assert (other / f"{block_id}.state.json").is_file()
    assert not (tmp_path / f"{block_id}.state.json").exists()
    assert http.get(f"/blocks/{block_id}/state").json() == {"state": {"0": [0]}}


@pytest.fixture
def own(tmp_path, monkeypatch):
    """Like client, but the blocks folder is tmp_path/blocks: the assistant and the dashboard keep their files beside
    it, which must stay inside this test's folder."""
    spec = importlib.util.spec_from_file_location("hb_plugin_api", ROOT / "dashboard" / "plugin_api.py")
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    blocks = tmp_path / "blocks"
    blocks.mkdir()
    monkeypatch.setattr(api.store, "default_root", lambda: blocks)
    app = FastAPI()
    app.include_router(api.router)
    return TestClient(app), api, blocks


def _set_up(api, tmp_path):
    from datetime import datetime
    now = datetime.now().astimezone()
    api.assistant_memory.save_config({"source": "demo", "setup_at": now.isoformat(), "last_check": None}, tmp_path)
    api.assistant_memory.apply_report({"items": [{"ref": "airtel-bill-x", "pile": "bills", "title": "Airtel bill"}],
                                       "summary": "1"}, now, tmp_path)
    return api.assistant_memory.load_items(tmp_path)[0]["id"]


def test_the_ticker_routes_are_gone(own):
    """Nothing polls for a ticker any more, so no route hands out every tracked item or a ticker layout."""
    http, api, tmp_path = own
    _set_up(api, tmp_path)
    assert http.get("/live").status_code == 404
    assert http.get("/assistant").status_code == 404


def test_a_button_changes_an_items_status(own):
    http, api, tmp_path = own
    item_id = _set_up(api, tmp_path)
    response = http.post(f"/assistant/items/{item_id}", json={"status": "done"})
    assert response.status_code == 200 and response.json()["status"] == "done"
    assert response.json()["history"][-1]["what"] == "page: done"
    assert http.post("/assistant/items/nope1234", json={"status": "done"}).status_code == 404
    assert http.post(f"/assistant/items/{item_id}", json={"status": "paid"}).status_code == 400


def test_reopen_from_the_page(own):
    http, api, tmp_path = own
    item_id = _set_up(api, tmp_path)
    http.post(f"/assistant/items/{item_id}", json={"status": "done"})
    response = http.post(f"/assistant/items/{item_id}", json={"status": "suggested"})
    assert response.status_code == 200 and response.json()["status"] == "suggested"
    assert response.json()["reopened_by_user"] is True and response.json()["history"][-1]["what"] == "you: reopened"


def test_dashboard_is_empty_without_a_spec(own):
    http, _, _ = own
    assert http.get("/dashboard").json() == {"title": None, "blocks": [], "live": False}


def test_dashboard_assembles_valid_blocks(own):
    http, api, tmp_path = own
    item_id = _set_up(api, tmp_path)
    api.dashboard_spec.save_spec({"title": "Today", "sections": [
        {"from": "assistant.summary"}, {"from": "assistant.open", "as": "checklist"}, {"from": "calendar.today"}]},
        tmp_path)
    body = http.get("/dashboard").json()
    assert body["title"] == "Today" and [b["type"] for b in body["blocks"]] == ["kpis", "checklist", "calendar"]
    assert body["blocks"][1]["items"][0]["id"] == item_id


def test_ticks_on_the_dashboard_close_and_reopen_items(own):
    http, api, tmp_path = own
    item_id = _set_up(api, tmp_path)
    assert http.put("/dashboard/state", json={"ticks": {item_id: True, "nope1234": True}}).status_code == 200
    assert api.assistant_memory.load_items(tmp_path)[0]["status"] == "done"
    http.put("/dashboard/state", json={"ticks": {item_id: False}})
    assert api.assistant_memory.load_items(tmp_path)[0]["status"] == "suggested"
    assert http.put("/dashboard/state", json={"ticks": [1]}).status_code == 400


def test_dashboard_head_is_just_the_title(own):
    http, api, tmp_path = own
    assert http.get("/dashboard/head").json() == {"title": None}
    api.dashboard_spec.save_spec({"title": "Today", "sections": [{"from": "tasks"}]}, tmp_path)
    assert http.get("/dashboard/head").json() == {"title": "Today"}


def _page(api, tmp_path, **over):
    pages = api.pages_store
    page = {"slug": "executive", "title": "Executive", "kind": "dashboard", "servers": ["mockcrm"], "notes": "",
            "job_id": "abc123", "previous": None,
            "snapshot": {"at": "2026-11-15T09:12:00+05:30", "blocks": [
                {"type": "list", "items": [{"title": "MRR up 6%"}]}]},
            "refresh": {"requested_at": None, "error": None}, **over}
    pages.save(page, tmp_path)
    return page


def test_pages_lists_dashboards_only(client, tmp_path):
    http, api = client
    _page(api, tmp_path)
    _page(api, tmp_path, slug="today", title="Today", kind="today")
    assert http.get("/pages").json() == {"pages": [{"slug": "executive", "title": "Executive", "kind": "dashboard"}]}


def test_a_page_is_its_snapshot_as_blocks_with_its_status(client, tmp_path):
    http, api = client
    _page(api, tmp_path)
    body = http.get("/pages/executive").json()
    assert body["title"] == "Executive" and body["blocks"][0]["type"] == "list"
    assert body["at"] == "2026-11-15T09:12:00+05:30" and body["refreshing"] is False and body["live"] is False
    assert http.get("/pages/nope").status_code == 404


def test_refresh_runs_the_pages_job_through_hermes(client, tmp_path, monkeypatch):
    http, api = client
    _page(api, tmp_path)
    runs = []
    monkeypatch.setattr(api, "run_job", lambda job_id, root, done=None: runs.append(job_id))
    first = http.post("/pages/executive/refresh").json()
    http.post("/pages/executive/refresh")
    assert runs == ["abc123"] and first["refreshing"] is True
    assert api.pages_store.load("executive", tmp_path)["refresh"]["requested_at"]
    assert http.post("/pages/nope/refresh").status_code == 404


def test_the_hermes_command_names_the_profile(tmp_path):
    spec = importlib.util.spec_from_file_location("hb_plugin_api2", ROOT / "dashboard" / "plugin_api.py")
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    named = tmp_path / "profiles" / "genui-test" / "plugin-data" / "hermes-genui" / "blocks"
    default = tmp_path / ".hermes" / "plugin-data" / "hermes-genui" / "blocks"
    assert api.job_command("abc123", named)[1:] == ["-p", "genui-test", "cron", "run", "abc123"]
    assert api.job_command("abc123", default)[1:] == ["cron", "run", "abc123"]


def test_a_long_refresh_runs_on_without_holding_the_request(client, tmp_path, monkeypatch):
    import time
    _, api = client
    monkeypatch.setattr(api, "job_command", lambda job_id, root: ["sleep", "5"])
    started = time.monotonic()
    api.run_job("abc123", tmp_path)
    assert time.monotonic() - started < 4


def test_a_job_that_fails_at_once_reports_why(client, tmp_path, monkeypatch):
    import subprocess
    _, api = client
    monkeypatch.setattr(api, "job_command", lambda job_id, root: ["sh", "-c", "echo Job not found >&2; exit 1"])
    with pytest.raises(subprocess.CalledProcessError) as failed:
        api.run_job("abc123", tmp_path)
    assert b"Job not found" in failed.value.output


def test_a_job_that_ends_later_is_reported(client, tmp_path, monkeypatch):
    import threading
    _, api = client
    monkeypatch.setattr(api, "QUICK_FAIL_SECONDS", 0.2)
    monkeypatch.setattr(api, "job_command", lambda job_id, root: ["sh", "-c", "sleep 0.5; echo rate limited; exit 2"])
    ended, seen = threading.Event(), []
    api.run_job("abc123", tmp_path, done=lambda code, out: (seen.append((code, out)), ended.set()))
    assert ended.wait(10)
    assert seen[0][0] == 2 and b"rate limited" in seen[0][1]


def test_the_page_says_why_a_refresh_failed_after_it_started(client, tmp_path, monkeypatch):
    http, api = client
    _page(api, tmp_path)
    finished = []
    monkeypatch.setattr(api, "run_job", lambda job_id, root, done=None: finished.append(done))
    http.post("/pages/executive/refresh")
    finished[0](1, b"Error: model not loaded\n")
    body = http.get("/pages/executive").json()
    assert body["refreshing"] is False and body["error"] == "The refresh failed: Error: model not loaded"


def test_a_page_on_a_schedule_says_so(client, tmp_path):
    http, api = client
    _page(api, tmp_path, schedule="every day at 8am")
    assert http.get("/pages/executive").json()["schedule"] == "every day at 8am"
    _page(api, tmp_path)
    assert http.get("/pages/executive").json()["schedule"] is None
