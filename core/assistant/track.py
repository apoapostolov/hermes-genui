"""What the assistant is tracking, worked out from dates, never by the model: each item's state (overdue, due today,
due soon, handled…), the Needs you list, the Handled list and the counts the Today page shows. Pure functions over the
items memory.py stores; "today" is the caller's local date, so a bill turns overdue at local midnight without a check.

    state({"pile": "bills", "due": "2026-11-15", "status": "suggested"}, date(2026, 11, 16))
    → ("overdue", "Overdue · 1 day")
"""

import re
from datetime import date, datetime
from urllib.parse import urlsplit

RED_PILES = ("bills", "renewals")  # a missed date there costs money or a licence: it turns red
SOON_DAYS = 7
HANDLED_DAYS = 3
HANDLED_MAX = 6
OPEN = ("suggested", "pending")
FAKE_WORDS = "⚠ Looks fake · look-alike sender"
ORDER = {"overdue": 0, "today": 1, "soon": 2, "open": 3}
SECOND_LEVEL = ("co", "com", "gov", "org", "net", "ac", "edu")


def _day(text: object) -> date | None:
    try:
        return date.fromisoformat(str(text)[:10]) if text else None
    except ValueError:
        return None


def _days(n: int) -> str:
    return f"{n} day" if n == 1 else f"{n} days"


def _closed_recently(item: dict, today: date) -> bool:
    closed = _day(item.get("closed_at"))
    return bool(item.get("closed_verb")) and closed is not None and (today - closed).days < HANDLED_DAYS


def state(item: dict, today: date) -> tuple[str, str]:
    """(kind, words): overdue | today | soon | open for open items, handled for one the check closed in the last 3
    days, done otherwise (closed long ago or by the user, or a past event or order)."""
    if item.get("status") not in OPEN:
        return ("handled", item["closed_verb"]) if _closed_recently(item, today) else ("done", "")
    if item.get("flag") == "fake":
        return ("overdue", FAKE_WORDS)
    due = _day(item.get("due"))
    if due is None:
        return ("open", "")
    left = (due - today).days
    pile = item.get("pile")
    if left < 0:
        if pile in RED_PILES:
            return ("overdue", f"Overdue · {_days(-left)}")
        if pile == "replies":
            return ("overdue", f"Late · {_days(-left)}")
        return ("done", "")
    if left == 0:
        detail = str(item.get("detail") or "")
        if pile == "orders":
            return ("today", detail[:60] if detail.startswith("Arriving") else "Arriving today")
        return ("today", "Due today")
    if left <= SOON_DAYS:
        return ("soon", "Tomorrow" if left == 1 else f"In {left} days")
    return ("open", f"Due {due.day} {due:%b}")


def needs_you(items: list[dict], today: date) -> list[dict]:
    """Open items that need the user: overdue, due today or soon, fake mail, replies owed. Most urgent first."""
    found = []
    for item in items:
        kind, _ = state(item, today)
        pile = item.get("pile")
        soon = kind == "soon" and pile in (*RED_PILES, "replies")  # an order or event needs you on its day only
        if kind in ("overdue", "today") or soon or (kind == "open" and pile == "replies"):
            found.append((ORDER[kind], str(item.get("due") or "9999"), len(found), item))
    return [entry[-1] for entry in sorted(found, key=lambda e: e[:3])]


def handled(items: list[dict], now: datetime) -> list[dict]:
    """What the assistant has done: closes from the last 3 days (newest first, with Reopen), fake mail it flagged, then
    open items it is quietly following (their `taken`). At most HANDLED_MAX rows."""
    today = now.date()
    waiting = {id(i) for i in needs_you(items, today)}
    closed = sorted((i for i in items if state(i, today)[0] == "handled"),
                    key=lambda i: str(i.get("closed_at")), reverse=True)
    rows = [_row(i, "closed", i["closed_verb"], str(i.get("closed_why") or ""), True) for i in closed]
    rows += [_row(i, "protected", "Protected you", "Look-alike sender; its link isn't shown", False)
             for i in items if i.get("flag") == "fake" and i.get("status") in OPEN]
    rows += [_row(i, "tracking", "Tracking", str(i["taken"]), False) for i in items
             if i.get("status") in OPEN and i.get("taken") and i.get("flag") != "fake" and id(i) not in waiting
             and state(i, today)[0] != "done"]
    return rows[:HANDLED_MAX]


def _row(item: dict, kind: str, verb: str, why: str, reopen: bool) -> dict:
    row = {"id": item.get("id"), "title": item.get("title"), "kind": kind, "verb": verb, "why": why, "reopen": reopen}
    if item.get("amount"):
        row["amount"] = item["amount"]
    return {"id": row.pop("id"), "title": row.pop("title"), **row}


def counts(items: list[dict], now: datetime) -> dict:
    need = needs_you(items, now.date())
    late = sum(1 for i in need if state(i, now.date())[0] == "overdue" and i.get("flag") != "fake")
    return {"overdue": late, "need": len(need),
            "handled": len(handled(items, now))}


def registrable(host: str) -> str:
    """The site a host belongs to: its last two labels, or three under a two-letter country code with a common
    second level ("www.bank.co.uk" → "bank.co.uk")."""
    labels = [part for part in host.lower().strip(".").split(".") if part]
    if len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in SECOND_LEVEL:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def sender_domain(sender: str) -> str | None:
    """The site a mail came from: "City Light <billing@citylight.example>" → "citylight.example"."""
    found = re.search(r"@([A-Za-z0-9.-]+)", sender or "")
    return registrable(found.group(1)) if found else None


HOST = re.compile(r"^[a-z0-9.-]+$")
UNSAFE = re.compile(r"[\\@\s\x00-\x1f\x7f]")


def safe_url(url: str) -> str | None:
    """An https link rebuilt from its parsed parts, or None when anything about it could make a browser read it
    differently than this check does: a backslash, an @, spaces or control characters, a host outside a-z 0-9 . -.

    " https://www.citylight.example/pay?x=1 " → "https://www.citylight.example/pay?x=1"
    "https://evil.example\\@citylight.example/pay" → None
    """
    text = (url or "").strip()
    if not text or UNSAFE.search(text):
        return None
    parts = urlsplit(text)
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not HOST.match(host) or parts.username or parts.password:
        return None
    port = f":{parts.port}" if parts.port else ""
    return f"https://{host}{port}{parts.path}" + (f"?{parts.query}" if parts.query else "")


def same_site(url: str, domain: str) -> bool:
    """Whether an https link (after safe_url) belongs to the same site as `domain` (both reduced to their registrable
    domain)."""
    safe = safe_url(url)
    return bool(safe) and registrable(urlsplit(safe).hostname or "") == registrable(domain)
