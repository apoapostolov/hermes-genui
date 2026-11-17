"""Serve live values (a city's weather, a stock, the system stats) without fetching anything twice and without ever
making a page wait long: each source keeps its last value, and is fetched again only when that value is older than
the source's interval. A request never queues behind a fetch already running (it gets the last value, marked stale),
and a failed fetch is retried after RETRY_AFTER, not on every request.

The Today page's sources (core/dashboard/sources.py) read through CACHE and POOL; when nothing asks, nothing is
fetched.
"""

import importlib.util
import sys
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx


def _sibling(name: str):
    """A module of this folder, loaded by path (see the package docstring), once per process."""
    key = f"hermes_genui_live_{name}"
    if key not in sys.modules:
        spec = importlib.util.spec_from_file_location(key, Path(__file__).resolve().parent / f"{name}.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sys.modules[key] = module
    return sys.modules[key]


feeds = _sibling("feeds")

RETRY_AFTER = 30  # seconds before a source that failed is tried again
NOTHING = {"value": None, "fetched_at": None, "stale": True}


class SourceCache:
    """Last values by source key, with one lock per key."""

    def __init__(self) -> None:
        self._values: dict[str, dict] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._guard = threading.Lock()

    def _lock(self, key: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(key, threading.Lock())

    def peek(self, key: str) -> dict:
        """The last value without fetching, marked stale; NOTHING when there has never been one."""
        held = self._values.get(key)
        if not held or held["value"] is None:
            return dict(NOTHING)
        return {"value": held["value"], "fetched_at": held["fetched_at"], "stale": True}

    def get(self, key: str, interval: float, fetch: Callable[[], dict],
            now: Callable[[], float] = time.monotonic) -> dict:
        """{"value": …, "fetched_at": unix time, "stale": bool}; fetches only when the value is older than interval
        (RETRY_AFTER after a failure). While another request is fetching this source, returns the last value at once.
        """
        lock = self._lock(key)
        if not lock.acquire(blocking=False):
            return self.peek(key)
        try:
            held = self._values.get(key)
            if held:
                wait_for = min(interval, RETRY_AFTER) if held["failed"] else interval
                if now() - held["at"] < wait_for:
                    return self.peek(key) if held["failed"] else {
                        "value": held["value"], "fetched_at": held["fetched_at"], "stale": False}
            try:
                value = fetch()
            except Exception:  # noqa: BLE001 - any failure of a source is shown as stale, never as an error
                self._values[key] = {"value": held["value"] if held else None,
                                     "fetched_at": held["fetched_at"] if held else None, "failed": True, "at": now()}
                return self.peek(key)
            self._values[key] = {"value": value, "fetched_at": time.time(), "failed": False, "at": now()}
            return {"value": value, "fetched_at": self._values[key]["fetched_at"], "stale": False}
        finally:
            lock.release()


CACHE = SourceCache()
# Fetches run here, so a page can stop waiting for a slow one; the pool is shared, so a hung service holds one
# worker until its HTTP timeout and no more (the per-source lock keeps later requests from piling onto it).
POOL = ThreadPoolExecutor(max_workers=6, thread_name_prefix="hb-live")

_CLIENT: httpx.Client | None = None
_CLIENT_GUARD = threading.Lock()


def _client() -> httpx.Client:
    """One HTTP client for every fetch, so connections are reused and nothing is left open."""
    global _CLIENT
    with _CLIENT_GUARD:
        if _CLIENT is None:
            _CLIENT = httpx.Client(timeout=httpx.Timeout(feeds.TIMEOUT - 1, connect=2.0))
        return _CLIENT
