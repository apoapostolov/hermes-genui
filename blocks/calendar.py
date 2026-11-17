"""calendar: a day at a glance, after Odie's Today: a big date card with the next event and an Ask about it button,
the day's events in order, and a week strip with a dot on days that have something on."""

from datetime import date

from .common import NO_SEND, acts_before_the_model, has_text, safe_text

MAX_EVENTS = 12
MAX_DAYS = 7


def _day(text: object) -> date | None:
    """A real day from "YYYY-MM-DD", else None: "2026-11-14" → date(2026, 11, 14); "2026-02-30" → None."""
    if not isinstance(text, str):
        return None
    try:
        return date.fromisoformat(text.strip()[:10]) if len(text.strip()) == 10 else None
    except ValueError:
        return None


def check_calendar(block: dict, path: str) -> list[tuple[str, str]]:
    """A real date; up to 12 events, each with a title and a start; up to 7 week days with a real date; an `ask`
    that isn't a command.

    {"date": "14 Nov"} → [("0", "calendar needs date as YYYY-MM-DD")]
    """
    if _day(block.get("date")) is None:
        return [(path, "calendar needs date as YYYY-MM-DD")]
    problems = []
    events = block.get("events", [])
    if not isinstance(events, list) or len(events) > MAX_EVENTS:
        return [(path, f"calendar takes at most {MAX_EVENTS} events")]
    for i, event in enumerate(events):
        if not (isinstance(event, dict) and has_text(event.get("title")) and has_text(event.get("start"))):
            problems.append((f"{path}.events.{i}", "event needs a title and a start"))
    week = block.get("week", [])
    if not isinstance(week, list) or len(week) > MAX_DAYS:
        return problems + [(path, f"week takes at most {MAX_DAYS} days")]
    for i, day in enumerate(week):
        if not (isinstance(day, dict) and _day(day.get("date"))):
            problems.append((f"{path}.week.{i}", "day needs date as YYYY-MM-DD"))
    if acts_before_the_model(block.get("ask")):
        problems.append((f"{path}.ask", NO_SEND))
    return problems


def _hm(text: object) -> str:
    """A start or end as HH:MM: "09:00" → "09:00"; "2026-11-14T07:30:00" → "07:30"."""
    value = safe_text(text, 40)
    return value[11:16] if len(value) >= 16 and value[10] == "T" else value[:5]


def text_calendar(block: dict) -> str:
    """**Sat 14 Nov**, then "- 09:00–10:00 Farmers market · Ballard Ave NW" per event."""
    day = _day(block.get("date"))
    head = f"**{day:%a} {day.day} {day:%b}**" if day else ""
    lines = []
    for event in (block.get("events") or [])[:MAX_EVENTS]:
        if not isinstance(event, dict) or not safe_text(event.get("title")):
            continue
        when = _hm(event.get("start")) + (f"–{_hm(event.get('end'))}" if event.get("end") else "")
        place = safe_text(event.get("place"))
        lines.append(f"- {when} {safe_text(event.get('title'))}" + (f" · {place}" if place else ""))
    return "\n".join([head] + (lines or ["- Nothing planned"]))
