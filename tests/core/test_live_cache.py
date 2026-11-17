import importlib
import threading
import time

import httpx

from conftest import load_plugin_package

load_plugin_package()
cache = importlib.import_module("hermes_genui.core.live.cache")


def test_a_fresh_value_is_not_fetched_again():
    calls, clock = [], [100.0]
    c = cache.SourceCache()

    def fetch():
        calls.append(1)
        return {"n": len(calls)}

    assert c.get("k", 5, fetch, now=lambda: clock[0])["value"] == {"n": 1}
    clock[0] = 104.0
    assert c.get("k", 5, fetch, now=lambda: clock[0])["value"] == {"n": 1}
    clock[0] = 106.0
    assert c.get("k", 5, fetch, now=lambda: clock[0])["value"] == {"n": 2}


def test_a_failed_fetch_serves_the_old_value_marked_stale():
    c, clock = cache.SourceCache(), [0.0]
    ok = c.get("k", 5, lambda: {"price": 1}, now=lambda: clock[0])
    assert ok["stale"] is False and ok["fetched_at"] is not None

    def broken():
        raise httpx.ConnectError("down")

    clock[0] = 10.0
    assert c.get("k", 5, broken, now=lambda: clock[0]) == {**ok, "stale": True}
    assert c.get("never", 5, broken, now=lambda: clock[0]) == {"value": None, "fetched_at": None, "stale": True}


def test_concurrent_requests_share_one_fetch():
    c, calls = cache.SourceCache(), []

    def slow():
        calls.append(1)
        time.sleep(0.1)
        return {"ok": True}

    threads = [threading.Thread(target=c.get, args=("k", 60, slow)) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1


def test_a_failed_source_is_not_retried_on_every_request():
    c, calls, clock = cache.SourceCache(), [], [0.0]

    def broken():
        calls.append(1)
        raise httpx.ConnectError("down")

    c.get("k", 900, broken, now=lambda: clock[0])
    clock[0] = 10.0
    c.get("k", 900, broken, now=lambda: clock[0])
    assert len(calls) == 1
    clock[0] = cache.RETRY_AFTER + 1
    c.get("k", 900, broken, now=lambda: clock[0])
    assert len(calls) == 2


def test_a_request_doesnt_wait_behind_a_fetch_already_running():
    c = cache.SourceCache()
    c.get("k", 0, lambda: {"n": 1})
    started = threading.Event()

    def slow():
        started.set()
        time.sleep(0.5)
        return {"n": 2}

    worker = threading.Thread(target=c.get, args=("k", 0, slow))
    worker.start()
    started.wait()
    t0 = time.monotonic()
    got = c.get("k", 0, lambda: {"n": 3})
    assert time.monotonic() - t0 < 0.2
    assert got["value"] == {"n": 1} and got["stale"] is True
    worker.join()


def test_the_network_client_is_shared_between_fetches():
    assert cache._client() is cache._client()
