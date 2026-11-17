"""upnext: what's coming, as a row of cards after Odie's Today: each with its date, an illustration for its kind
(birthday, bill, travel, delivery …), the title and the time or amount; a tap asks about it."""

from .calendar import _day
from .common import NO_SEND, acts_before_the_model, has_text, safe_text

MAX_ITEMS = 12
STATES = ("overdue", "today", "soon")


def check_upnext(block: dict, path: str) -> list[tuple[str, str]]:
    """1-12 items, each with a real date and a title; an item's `ask` can't be a command.

    items = [{"title": "No date"}] → [("0.items.0", "item needs a date (YYYY-MM-DD) and a title")]
    """
    items = block.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_ITEMS:
        return [(path, f"upnext needs 1-{MAX_ITEMS} items")]
    problems = []
    for i, item in enumerate(items):
        if not (isinstance(item, dict) and _day(item.get("date")) and has_text(item.get("title"))):
            problems.append((f"{path}.items.{i}", "item needs a date (YYYY-MM-DD) and a title"))
        elif acts_before_the_model(item.get("ask")):
            problems.append((f"{path}.items.{i}.ask", NO_SEND))
        elif item.get("state") is not None and item["state"] not in STATES:
            problems.append((f"{path}.items.{i}.state", "overdue, today or soon"))
    return problems


def text_upnext(block: dict) -> str:
    """**Up next**, then "- Tue 17 Nov · Emma's birthday · 08:00" per item."""
    lines = []
    for item in (block.get("items") or [])[:MAX_ITEMS]:
        day = _day(item.get("date")) if isinstance(item, dict) else None
        title = safe_text(item.get("title")) if isinstance(item, dict) else ""
        if not (day and title):
            continue
        extra = [safe_text(item.get("time")) or safe_text(item.get("amount"))]
        if item.get("state") in STATES:
            extra.append(safe_text(item.get("stateText")))
        tail = "".join(f" · {e}" for e in extra if e)
        lines.append(f"- {day:%a} {day.day} {day:%b} · {title}{tail}")
    head = safe_text(block.get("title")) or "Up next"
    return "\n".join([f"**{head}**"] + lines) if lines else ""
