"""Refresh: the page's Refresh starts its Hermes job, once, and the page can tell whether that refresh is running,
finished (a newer snapshot) or stuck. A refresh that hasn't saved a snapshot in 15 minutes counts as not finished."""

from collections.abc import Callable
from datetime import datetime, timedelta

STUCK_AFTER = timedelta(minutes=15)
STUCK = "The last refresh didn't finish."
NO_JOB = "This page has no refresh job; ask Hermes to redesign it."


def _when(iso: object) -> datetime | None:
    try:
        return datetime.fromisoformat(str(iso)) if iso else None
    except ValueError:
        return None


def status(page: dict, now: datetime) -> dict:
    """{"at": the last snapshot's time, "refreshing": bool, "error": a sentence or None}."""
    at = (page.get("snapshot") or {}).get("at")
    refresh = page.get("refresh") or {}
    asked, done = _when(refresh.get("requested_at")), _when(at)
    if refresh.get("error"):
        return {"at": at, "refreshing": False, "error": refresh["error"]}
    if asked and (done is None or asked > done):
        if now - asked < STUCK_AFTER:
            return {"at": at, "refreshing": True, "error": None}
        return {"at": at, "refreshing": False, "error": STUCK}
    return {"at": at, "refreshing": False, "error": None}


def _plain(output: object, code: int) -> str:
    """A sentence for how a refresh job ended badly, from what it printed."""
    text = output.decode("utf-8", "replace") if isinstance(output, bytes) else str(output or "")
    if "not found" in text.lower():
        return NO_JOB
    if code == 0:
        return "The refresh ended without saving a snapshot."
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    return f"The refresh failed: {lines[-1][:160]}" if lines else "The refresh failed."


def start(page: dict, now: datetime, run: Callable[[str], None], save: Callable[[dict], None] = lambda p: None) -> dict:
    """Start the page's job unless a refresh is already running. The refresh is marked (and saved, so a second tap
    or the job's own end sees it) before the job starts, and saved again if it can't start; returns the status after.
    The caller doesn't save `page` afterwards: the job's end may already have written to it."""
    if not page.get("job_id"):
        page["refresh"] = {"requested_at": None, "error": NO_JOB}
        save(page)
        return status(page, now)
    if status(page, now)["refreshing"]:
        return status(page, now)
    page["refresh"] = {"requested_at": now.isoformat(), "error": None}
    save(page)
    try:
        run(page["job_id"])
    except Exception as exc:  # noqa: BLE001 - whatever stopped it, the page says so
        output = getattr(exc, "output", None) or getattr(exc, "stderr", None) or ""
        text = output.decode("utf-8", "replace") if isinstance(output, bytes) else str(output)
        if "not found" in text.lower():
            error = NO_JOB
        else:
            first = text.strip().splitlines()[0] if text.strip() else type(exc).__name__
            error = f"Couldn't start the refresh: {first[:160]}"
        page["refresh"] = {"requested_at": None, "error": error}
        save(page)
    return status(page, now)


def finish(page: dict, requested_at: str, code: int, output: object) -> bool:
    """The job started at `requested_at` has ended with `code`. If it didn't save a newer snapshot (and no later
    refresh has started), record why on the page. True when the page changed (the caller saves it)."""
    refresh = page.get("refresh") or {}
    if refresh.get("requested_at") != requested_at or refresh.get("error"):
        return False
    done, asked = _when((page.get("snapshot") or {}).get("at")), _when(requested_at)
    if done and asked and done >= asked:
        return False
    page["refresh"] = {"requested_at": requested_at, "error": _plain(output, code)}
    return True
