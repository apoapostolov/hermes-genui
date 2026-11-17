"""What the assistant remembers, per profile, in <plugin store>/assistant/: its config (source, when it was set up,
the last check), the items it found (each keyed by the mail or event it came from, with a status and a history) and a
log of its checks. Every change is a read-modify-write under one lock, so a button pressed while a check writes
loses nothing.

Statuses: suggested (it suggests something), pending (the user started on it), done, dismissed (never raised again).

The lock is a file lock in the assistant's folder, not only a thread lock: the dashboard API loads this module by path
as a second copy with its own globals, and the scheduled check may run in another process.
"""

import contextlib
import importlib.util
import json
import os
import re
import secrets
import shutil
import sys
import threading
from datetime import datetime
from pathlib import Path

PILES = ("orders", "bills", "renewals", "events", "replies", "alerts", "personal")
VERBS = ("Paid", "Delivered", "Renewed", "Replied", "Cancelled", "Done")
PREP_KINDS = ("gift", "recipes", "places", "plan", "pay")
PREP_WORDS = re.compile(r"^[A-Za-z0-9 ,'-]{1,60}$")
FACTS_MAX, FACT_LEN = 4, 60
IDEAS_MAX = 4
CLOSE_FIELDS = ("closed_verb", "closed_why", "closed_at", "evidence_ref")
STATUSES = ("suggested", "pending", "done", "dismissed")
TITLE_MAX, DETAIL_MAX, LINE_MAX = 80, 160, 120
CALENDAR_MAX = 100  # events in the next 14 days
CHECKS_KEPT = 50
CALENDAR_MAX = 100  # events in the next 14 days, from a real source
LOCK = threading.RLock()
CONTROL = re.compile("[\\x00-\\x1f\\x7f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069]")


def _store():
    """core/store.py, loaded by path once per process."""
    name = "hermes_genui_live_store"
    if name not in sys.modules:
        spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parent.parent / "store.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sys.modules[name] = module
    return sys.modules[name]


def assistant_dir(root: Path | None = None) -> Path:
    """<plugin store>/assistant, beside the blocks folder `root`."""
    return (root or _store().default_root()).parent / "assistant"


def _read(path: Path, empty):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return empty
    return data if isinstance(data, type(empty)) else empty


def _write(path: Path, data) -> None:
    """Replace a file in one step, through a temporary file of this writer's own (two writers never share one)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


@contextlib.contextmanager
def _locked(root: Path | None):
    """Hold the assistant's lock: this module's thread lock and an exclusive lock on <assistant>/.lock."""
    folder = assistant_dir(root)
    folder.mkdir(parents=True, exist_ok=True)
    with LOCK, (folder / ".lock").open("a+b") as handle:
        if os.name == "nt":
            import msvcrt
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def load_config(root: Path | None = None) -> dict:
    return _read(assistant_dir(root) / "config.json", {})


def save_config(config: dict, root: Path | None = None) -> None:
    with _locked(root):
        _write(assistant_dir(root) / "config.json", config)


def note_inbox_read(at: datetime, root: Path | None = None) -> None:
    """Remember when the check read the inbox: the next check reads from there, so mail that arrives while the model
    is thinking isn't skipped."""
    with _locked(root):
        config = load_config(root)
        config["inbox_read_at"] = at.isoformat()
        _write(assistant_dir(root) / "config.json", config)


def load_items(root: Path | None = None) -> list[dict]:
    return [i for i in _read(assistant_dir(root) / "items.json", []) if isinstance(i, dict)]


def load_checks(root: Path | None = None) -> list[dict]:
    return _read(assistant_dir(root) / "checks.json", [])


def _clean(text: object, limit: int) -> str | None:
    """One line of plain text, at most `limit` characters; None for nothing."""
    if text is None:
        return None
    line = " ".join(CONTROL.sub(" ", str(text)).split())
    return line[:limit] if line else None


def _report_problems(report: object) -> list[str]:
    if not isinstance(report, dict) or not isinstance(report.get("items", []), list):
        return ['the report must be {"items": [...], "summary": "..."}']
    return []


def _item_problems(item: object) -> list[str]:
    if not isinstance(item, dict):
        return ["must be an object"]
    problems = []
    if not _clean(item.get("ref"), 120):
        problems.append("needs a ref")
    if item.get("pile") not in PILES:
        problems.append(f"unknown pile {item.get('pile')!r}")
    if not _clean(item.get("title"), TITLE_MAX):
        problems.append("needs a title")
    if item.get("status", "suggested") not in ("suggested", "done"):
        problems.append("status is suggested or done")
    elif item.get("status") == "done" and not (item.get("verb") in VERBS and _clean(item.get("why"), 120)):
        problems.append("needs verb and why to close")
    return problems


def _calendar_problems(calendar: object) -> list[str]:
    if calendar is None:
        return []
    if not isinstance(calendar, list) or len(calendar) > CALENDAR_MAX:
        return [f"calendar: a list of up to {CALENDAR_MAX} events"]
    return [f"calendar.{i}: needs a title and a start (ISO date and time)" for i, event in enumerate(calendar)
            if not (isinstance(event, dict) and _clean(event.get("title"), TITLE_MAX) and _when(event.get("start")))]


def _problems(report: object) -> list[str]:
    """Everything wrong with a report, item by item (for checking recipe examples): [] when all of it records."""
    found = _report_problems(report)
    if found:
        return found
    for n, item in enumerate(report.get("items", [])):
        found += [f"items.{n}: {why}" for why in _item_problems(item)]
    return found + _calendar_problems(report.get("calendar"))


def _when(text: object) -> str | None:
    """An event time kept only when it parses: "2026-11-17T08:00:00-08:00" → as given; "tomorrow" → None."""
    value = _clean(text, 40)
    try:
        return value if value and datetime.fromisoformat(value) else None
    except ValueError:
        return None


def _event(event: dict) -> dict:
    return {"id": _clean(event.get("id"), 120) or "", "title": _clean(event.get("title"), TITLE_MAX),
            "start": _when(event.get("start")), "end": _when(event.get("end")) or _when(event.get("start")),
            "place": _clean(event.get("place"), 120) or ""}


def load_calendar(root: Path | None = None) -> list[dict]:
    """The calendar the last check saw (a real source; the demo reads its own)."""
    return _read(assistant_dir(root) / "calendar.json", [])


def save_calendar(events: list[dict], root: Path | None = None) -> None:
    with _locked(root):
        _write(assistant_dir(root) / "calendar.json", [_event(e) for e in events])


def _day(text: object) -> str | None:
    """A due date kept only when it's a real day: "2026-11-18" → "2026-11-18"; "Friday" → None."""
    value = _clean(text, 10)
    try:
        return datetime.fromisoformat(value).date().isoformat() if value and len(value) == 10 else None
    except ValueError:
        return None


def _fields(item: dict) -> dict:
    """The parts of a reported item that are stored, cleaned and trimmed."""
    return {key: value for key, value in {
        "pile": item.get("pile"), "title": _clean(item.get("title"), TITLE_MAX),
        "detail": _clean(item.get("detail"), DETAIL_MAX), "due": _day(item.get("due")),
        "amount": _clean(item.get("amount"), 20), "suggestion": _clean(item.get("suggestion"), LINE_MAX),
        "taken": _clean(item.get("taken"), LINE_MAX), "from": _clean(item.get("from"), 120),
        "received": _when(item.get("received")), "facts": _facts(item.get("facts")),
        "flag": "fake" if item.get("flag") == "fake" else None,
    }.items() if value is not None}


def _facts(value: object) -> list[str] | None:
    """Up to 4 short facts for Details ("Amount $89.98", "Delivery code 4821"), each cut to 60 characters."""
    if not isinstance(value, list):
        return None
    kept = [line[:FACT_LEN] for line in (_clean(v, 400) for v in value) if line][:FACTS_MAX]
    return kept or None


def _prep(value: object) -> dict | None:
    """A tag for the ideas job: {kind, words} with a known kind and plain words (no links, no symbols)."""
    if not isinstance(value, dict) or value.get("kind") not in PREP_KINDS:
        return None
    words = " ".join(str(value.get("words") or "").split())
    return {"kind": value["kind"], "words": words} if PREP_WORDS.match(words) else None


def _new_id(items: list[dict]) -> str:
    taken = {i.get("id") for i in items}
    while True:
        item_id = secrets.token_hex(4)
        if item_id not in taken:
            return item_id


def _close(known: dict, reported: dict, at: str) -> str | None:
    """Close an open item: only its close fields change. The reason it was refused, or None when closed."""
    evidence = _clean(reported.get("evidence_ref"), 120)
    if known.get("reopened_by_user") and (not evidence or evidence == known.get("reopen_evidence")):
        return "the user reopened this; close it only on a newer mail, named in evidence_ref"
    verb, why = reported["verb"], _clean(reported.get("why"), 120)
    known.update({"status": "done", "closed_verb": verb, "closed_why": why, "closed_at": at, "reopened_by_user": False})
    if evidence:
        known["evidence_ref"] = evidence
    known["updated"] = at
    known.setdefault("history", []).append({"at": at, "what": f"closed: {verb} · {why}"})
    return None


def _set_prep(item: dict, reported: dict) -> bool:
    """Tag the item for the ideas job when the report asks for something new; True when it did. A fake mail is
    never tagged: it must not get a pay link or anything else prepared."""
    if item.get("flag") == "fake" or reported.get("flag") == "fake":
        return False
    prep = _prep(reported.get("prep"))
    if prep is None:
        return False
    old = item.get("prep") or {}
    if (old.get("kind"), old.get("words")) == (prep["kind"], prep["words"]):
        return False
    item["prep"] = prep
    item.pop("ideas", None)
    item.pop("pay_link", None)
    return True


def apply_report(report: dict, now: datetime, root: Path | None = None) -> str:
    """Record one check: new items opened, known ones (by ref) updated, closed ones closed (a close needs a verb and a
    reason, and only changes its close fields), dismissed ones left alone. A bad item is skipped and named; the rest
    is recorded. → "Recorded: 2 new, 1 updated, 0 closed. Not recorded: items.2: needs verb and why to close."
    """
    problems = _report_problems(report)
    if problems:
        return "Not recorded. Fix these and call assistant_report again:\n" + "\n".join(f"- {p}" for p in problems)
    at = now.isoformat()
    skipped: list[str] = []
    with _locked(root):
        items = load_items(root)
        by_ref = {i.get("ref"): i for i in items}
        new = updated = closed = fresh = 0
        left = []
        for n, reported in enumerate(report.get("items", [])):
            bad = _item_problems(reported)
            if bad:
                skipped += [f"items.{n}: {why}" for why in bad]
                continue
            ref = _clean(reported["ref"], 120)
            known = by_ref.get(ref)
            if known and known.get("status") == "dismissed":
                left.append(known.get("title", ref))
                continue
            if reported.get("status") == "done":
                if not known or known.get("status") not in ("suggested", "pending"):
                    skipped.append(f"items.{n}: no open item {ref} to close")
                    continue
                refused = _close(known, reported, at)
                if refused:
                    skipped.append(f"items.{n}: {refused}")
                else:
                    closed += 1
                continue
            fields = _fields(reported)
            if known:
                known.update(fields)
                fresh += _set_prep(known, reported)
                known["updated"] = at
                known.setdefault("history", []).append({"at": at, "what": "updated by the check"})
                updated += 1
                continue
            item = {"id": _new_id(items), "ref": ref, "status": "suggested", **fields,
                    "updated": at, "history": [{"at": at, "what": "found by the check"}]}
            fresh += _set_prep(item, reported)
            items.append(item)
            by_ref[ref] = item
            new += 1
        _write(assistant_dir(root) / "items.json", items)
        checks = load_checks(root) + [{"at": at, "summary": _clean(report.get("summary"), 200) or "",
                                       "new": new, "updated": updated, "closed": closed}]
        _write(assistant_dir(root) / "checks.json", checks[-CHECKS_KEPT:])
        calendar_bad = _calendar_problems(report.get("calendar"))
        skipped += calendar_bad
        if isinstance(report.get("calendar"), list) and not calendar_bad:
            _write(assistant_dir(root) / "calendar.json", [_event(e) for e in report["calendar"]])
        config = load_config(root)
        config["last_check"] = config.pop("inbox_read_at", None) or at
        _write(assistant_dir(root) / "config.json", config)
    reply = f"Recorded: {new} new, {updated} updated, {closed} closed."
    if left:
        reply += f" Left alone (dismissed): {', '.join(left)}."
    if skipped:
        reply += " Not recorded: " + "; ".join(skipped) + "."
    if fresh:  # only what this report tagged anew, so the ideas job never runs again for the same thing
        reply += f" Ideas needed: {fresh}."
    return reply


def pending_prep(items: list[dict]) -> list[dict]:
    """Open items tagged for the ideas job that it hasn't done yet."""
    return [i for i in items if i.get("status") in ("suggested", "pending") and isinstance(i.get("prep"), dict)
            and not i["prep"].get("done_at")]


def set_prep_result(item_id: str, ideas: list, pay_link: str | None, now: datetime,
                    root: Path | None = None) -> dict | None:
    """Store what the ideas job found for an item: up to 4 ideas {title, note?, photo, link?} and a pay link."""
    with _locked(root):
        items = load_items(root)
        item = next((i for i in items if i.get("id") == item_id), None)
        if item is None or not isinstance(item.get("prep"), dict):
            return None
        kept = []
        for idea in ideas if isinstance(ideas, list) else []:
            if not isinstance(idea, dict) or not _clean(idea.get("title"), 40) or not _clean(idea.get("photo"), 500):
                continue
            kept.append({k: v for k, v in {"title": _clean(idea["title"], 40), "note": _clean(idea.get("note"), 80),
                                            "photo": _clean(idea["photo"], 500),
                                            "link": _clean(idea.get("link"), 500)}.items() if v})
        item["ideas"] = kept[:IDEAS_MAX]
        if pay_link:
            item["pay_link"] = pay_link
        item["prep"]["done_at"] = now.isoformat()
        _write(assistant_dir(root) / "items.json", items)
        return item


def set_status(item_id: str, status: str, now: datetime, by: str, root: Path | None = None) -> dict | None:
    """Change one item's status (from the page's buttons or the chat), noting who; None when there's no such item."""
    if status not in STATUSES:
        raise ValueError(f"status must be one of {', '.join(STATUSES)}")
    with _locked(root):
        items = load_items(root)
        item = next((i for i in items if i.get("id") == item_id), None)
        if item is None:
            return None
        item["status"] = status
        item["updated"] = now.isoformat()
        item.setdefault("history", []).append({"at": now.isoformat(), "what": f"{by}: {status}"})
        _write(assistant_dir(root) / "items.json", items)
        return item


def reopen(item_id: str, now: datetime, by: str, root: Path | None = None) -> dict | None:
    """Undo a tick: reopen an item only if its last change was `by` marking it done (an item the check closed, or the
    user dismissed in chat, stays as it is). The item, or None when nothing was reopened."""
    with _locked(root):
        items = load_items(root)
        item = next((i for i in items if i.get("id") == item_id), None)
        if item is None or (item.get("history") or [{}])[-1].get("what") != f"{by}: done":
            return None
        item["status"] = "suggested"
        item["updated"] = now.isoformat()
        item["history"].append({"at": now.isoformat(), "what": f"{by}: reopened"})
        _write(assistant_dir(root) / "items.json", items)
        return item


def user_reopen(item_id: str, now: datetime, root: Path | None = None) -> dict | None:
    """The user's Reopen on something the check closed (or anything closed): open again, close fields cleared, and
    marked so the next check can't close it on the same mail. The item, or None when there's no such item."""
    with _locked(root):
        items = load_items(root)
        item = next((i for i in items if i.get("id") == item_id), None)
        if item is None:
            return None
        evidence = item.get("evidence_ref") or item.get("reopen_evidence")
        for key in CLOSE_FIELDS:
            item.pop(key, None)
        item.update({"status": "suggested", "reopened_by_user": True, "reopen_evidence": evidence,
                     "updated": now.isoformat()})
        item.setdefault("history", []).append({"at": now.isoformat(), "what": "you: reopened"})
        _write(assistant_dir(root) / "items.json", items)
        return item


def clear(root: Path | None = None) -> None:
    """Forget everything: config, items and the check log."""
    with LOCK:
        shutil.rmtree(assistant_dir(root), ignore_errors=True)
