"""The demo source: a Seattle household's mailbox that tells a story in two acts, from seed.json. Act 1 is in the
inbox once its time has come (days are counted from the anchor, the day the demo was set up): bills, a renewal, an
order on its way, family mail, a fake "pay now" mail. Act 2 arrives when the user asks for it ("next act"), seconds
after that moment: a payment received, a renewal complete, a delivery, a late fee, a promo that must close
nothing. Ids are the seed's keys, so the same mail keeps its id. Date tokens ({d+3}) are relative to a mail's day.
"""

import json
import re
from datetime import date, datetime, time, timedelta
from pathlib import Path

SEED = Path(__file__).resolve().parent / "seed.json"
TOKEN = re.compile(r"\{d([+-]\d+)\}")


def load_seed() -> dict:
    return json.loads(SEED.read_text(encoding="utf-8"))


def render(text: str, day: date) -> str:
    """Date tokens written out: render("Due {d+3}", Fri 13 Nov) → "Due Mon 16 Nov"."""
    def written(m: re.Match) -> str:
        d = day + timedelta(days=int(m.group(1)))
        return f"{d:%a} {d.day} {d:%b}"  # .day, not the no-padding directive: that is glibc-only

    return TOKEN.sub(written, text)


def _at(day: date, hhmm: str, tz) -> datetime:
    return datetime.combine(day, time.fromisoformat(hhmm), tzinfo=tz)


def inbox(now: datetime, since: datetime | None, anchor: date | None = None, act: int = 1,
          next_at: datetime | None = None) -> list[dict]:
    """The mail that has arrived by `now` (and after `since`, when given), oldest first.

    → [{"id": "xfinity-bill", "from": "Xfinity <…>", "subject": "…", "received": "2026-11-14T08:15:00-08:00",
        "text": "Your bill … Pay by Thu 19 Nov …"}]
    """
    tz = now.tzinfo
    anchor = anchor or now.date()
    found = []
    for mail in load_seed()["mail"]:
        if mail["act"] > act:
            continue
        if mail["act"] == 1:
            day = anchor + timedelta(days=mail["day"])
            received = _at(day, mail["time"], tz)
        else:
            start = (next_at or now).astimezone(tz)
            received = start + timedelta(seconds=mail["after"])  # in the inbox within seconds of "next"
            day = received.date()
        if received > now or (since is not None and received <= since.astimezone(tz)):
            continue
        found.append({"id": mail["key"], "from": mail["from"], "subject": render(mail["subject"], day),
                      "received": received.isoformat(), "text": render(mail["text"], day)})
    return sorted(found, key=lambda m: m["received"])


def calendar(now: datetime, days: int = 7, anchor: date | None = None) -> list[dict]:
    """Events from today for `days` days: the weekly routine, plus the story's own events (a birthday, a dinner, a
    flight) on their days counted from the anchor. Soonest first.

    → [{"id": "client-wed-20261118", "title": "Northwind proposal call", "start": "…T15:00:00-08:00", "end": "…",
        "place": "Zoom"}]
    """
    tz = now.tzinfo
    anchor = anchor or now.date()
    seed = load_seed()
    last = now.date() + timedelta(days=days)
    events = []
    for offset in range(days):
        day = now.date() + timedelta(days=offset)
        for event in seed["events"]:
            if event["weekday"] == day.weekday():
                events.append({"id": f"{event['key']}-{day:%Y%m%d}", "title": event["title"],
                               "start": _at(day, event["start"], tz).isoformat(),
                               "end": _at(day, event["end"], tz).isoformat(), "place": event["place"]})
    for event in seed.get("story", []):
        day = anchor + timedelta(days=event["day"])
        if now.date() <= day < last:
            events.append({"id": event["key"], "title": event["title"],
                           "start": _at(day, event["start"], tz).isoformat(),
                           "end": _at(day, event["end"], tz).isoformat(), "place": event["place"]})
    return sorted(events, key=lambda e: e["start"])
