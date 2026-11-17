"""Dashboard sources: each turns data a tool already owns into catalog blocks. A source has a label (for notes), the
views it can show as (the first is the default), and make(section, ctx) → blocks. A source with nothing to show
returns []; one that can't work yet raises NotReady with a sentence for the page.

    calendar.today → calendar          calendar.upnext → upnext
    assistant.summary → kpis           assistant.open → checklist | list      assistant.suggestions → list
    assistant.<pile> → table | list | checklist                               assistant.done → list
    system → kpis    weather.<City> → kpis    stock.<SYMBOL> → kpis | chart    tasks → table | list
"""

import importlib.util
import re
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit
from typing import Any, NamedTuple

CORE = Path(__file__).resolve().parent.parent
PILES = {"bills": "Bills", "renewals": "Renewals", "orders": "Orders", "replies": "Replies", "events": "Events",
         "alerts": "Alerts", "personal": "Personal"}
START_HINT = "Say “Create my personal dashboard” to set up the assistant; this fills in after its first check."


def _load(key: str, *parts: str):
    if key not in sys.modules:
        spec = importlib.util.spec_from_file_location(key, CORE.joinpath(*parts))
        module = importlib.util.module_from_spec(spec)
        sys.modules[key] = module
        spec.loader.exec_module(module)
    return sys.modules[key]


memory = _load("hermes_genui_assistant_memory_dash", "assistant", "memory.py")
demo = _load("hermes_genui_assistant_demo_dash", "assistant", "demo.py")
track = _load("hermes_genui_assistant_track_dash", "assistant", "track.py")
live = _load("hermes_genui_live_cache", "live", "cache.py")
pages_store = _load("hermes_genui_pages_store_dash", "pages", "store.py")
pages_layout = _load("hermes_genui_pages_layout_dash", "pages", "layout.py")
pages_refresh = _load("hermes_genui_pages_refresh_dash", "pages", "refresh.py")


class Context(NamedTuple):
    now: datetime
    home: Path
    blocks_root: Path
    client: Any = None  # an httpx client for live sources; None uses the shared one


class NotReady(Exception):
    """The source can't show anything yet; the message is shown in its place."""


class Source(NamedTuple):
    label: str
    views: tuple[str, ...]
    make: Any
    open_ids: Any = None  # open_ids(ctx) → ids of the open items it shows, for a tab's badge; None: it shows none


# ---- helpers -------------------------------------------------------------------------------------------------------

def _config(ctx: Context) -> dict:
    config = memory.load_config(ctx.blocks_root)
    if not config:
        raise NotReady(START_HINT)
    return config


def _items(ctx: Context, *statuses: str) -> list[dict]:
    _config(ctx)
    return [i for i in memory.load_items(ctx.blocks_root) if i.get("status") in statuses]


def _open(ctx: Context, pile: str | None = None) -> list[dict]:
    return [i for i in _items(ctx, "suggested", "pending") if pile is None or i.get("pile") == pile]


def _ids(items) -> set[str]:
    return {i["id"] for i in items}


def _amount(text: object) -> float:
    digits = re.sub(r"[^\d.]", "", str(text or ""))
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


AT_REFERENCE = re.compile(r"@\w[\w-]*:|@(?:diff|staged)\b")  # the same rule as blocks/common.py


def _safe(text: object) -> str | None:
    """Text a tap may put in the message box, or None when Hermes would act on it itself (a /command, !shell or an
    @-reference), as the blocks' own check refuses: "Pay Xfinity" → kept; "/reset" → None."""
    if not isinstance(text, str) or not text.strip():
        return None
    value = text.strip()
    return None if value[:1] in ("/", "@", "!") or AT_REFERENCE.search(value) else value


def _real_day(text: object) -> str | None:
    try:
        return datetime.fromisoformat(str(text)[:10]).date().isoformat() if text and len(str(text)) >= 10 else None
    except ValueError:
        return None


def _hm(iso: str) -> str:
    return iso[11:16]


def _day_label(iso_date: str) -> str:
    d = datetime.fromisoformat(iso_date[:10])
    return f"{d:%a} {d.day} {d:%b}"


KIND_WORDS = [("birthday", "birthday"), ("wedding", "celebration"), ("flight", "travel"), ("delta", "travel"),
              ("trip", "travel"), ("dentist", "medical"), ("doctor", "medical"), ("dinner", "meal"),
              ("brunch", "meal"), ("lunch", "meal"), ("school", "school"), ("field trip", "school"),
              ("soccer", "fitness"), ("gym", "fitness"), ("run", "fitness"), ("yoga", "fitness"),
              ("call", "call"), ("review", "meeting"), ("planning", "meeting"), ("1:1", "meeting")]
PILE_KIND = {"bills": "bill", "orders": "delivery", "events": "meeting", "replies": "general", "alerts": "general",
             "personal": "celebration"}


def _kind(title: str, pile: str | None = None) -> str:
    low = title.lower()
    for word, kind in KIND_WORDS:
        if word in low:
            return kind
    return PILE_KIND.get(pile or "", "general")


# ---- calendar ------------------------------------------------------------------------------------------------------

def _calendar(ctx: Context, days: int) -> list[dict]:
    """The next `days` days of events: the demo's own calendar, or what the last check saved from a real source."""
    config = _config(ctx)
    if config.get("source") == "demo":
        anchor = config.get("demo_anchor")
        return demo.calendar(ctx.now, days, datetime.fromisoformat(anchor).date() if anchor else None)
    first = ctx.now.date()
    last = first + timedelta(days=days)
    found = []
    for event in memory.load_calendar(ctx.blocks_root):
        try:
            start = datetime.fromisoformat(event["start"])
        except (KeyError, TypeError, ValueError):
            continue
        local = start.astimezone(ctx.now.tzinfo) if ctx.now.tzinfo and start.tzinfo else start
        if first <= local.date() < last:
            end = event.get("end") or event["start"]
            try:
                end_local = datetime.fromisoformat(end)
                end_local = end_local.astimezone(ctx.now.tzinfo) if ctx.now.tzinfo and end_local.tzinfo else end_local
            except ValueError:
                end_local = local
            found.append({**event, "start": local.isoformat(), "end": end_local.isoformat()})
    return sorted(found, key=lambda e: e["start"])


def calendar_today(section: dict, ctx: Context) -> list[dict]:
    week = _calendar(ctx, 7)
    today = ctx.now.date().isoformat()
    events = [{"title": e["title"], "start": _hm(e["start"]), "end": _hm(e["end"]),
               **({"place": e["place"]} if e["place"] else {})} for e in week if e["start"][:10] == today]
    counts = Counter(e["start"][:10] for e in week)
    days = [(ctx.now.date() + timedelta(days=n)).isoformat() for n in range(7)]
    return [{"type": "calendar", "date": today, "events": events[:12],
             "week": [{"date": d, "count": counts.get(d, 0)} for d in days], "ask": "What's on my calendar today?"}]


def calendar_upnext(section: dict, ctx: Context) -> list[dict]:
    """Tracked items with a date (overdue first, with their state), then the next two weeks' events that aren't
    routine (a title on 3 or more of the next 7 days is routine: standups, school runs). Past events and orders drop
    out on their own."""
    today = ctx.now.date()
    dated = []
    for item in _open(ctx):
        due = _real_day(item.get("due"))
        kind, words = track.state(item, today)
        if not due or kind == "done":
            continue
        entry = {"date": due, "title": item["title"][:60], "kind": _kind(item["title"], item["pile"]), "source": "mail",
                 **({"amount": item["amount"]} if item.get("amount") else {}),
                 "ask": _safe(item.get("suggestion")) or f"Tell me about {item['title']}"}
        if kind in ("overdue", "today", "soon"):
            entry.update(state=kind, stateText=words)
        dated.append((track.ORDER.get(kind, 3), due, entry))
    dated = [e for _, _, e in sorted(dated, key=lambda d: d[:2])][:12]
    upcoming = _calendar(ctx, 14)
    seen = Counter(e["title"] for e in upcoming if e["start"] < (ctx.now + timedelta(days=7)).isoformat())
    events = []
    for event in upcoming:
        if seen[event["title"]] >= 3 or event["start"] < ctx.now.isoformat():
            continue
        events.append({"date": event["start"][:10], "title": event["title"], "kind": _kind(event["title"]),
                       "time": _hm(event["start"]), "source": "calendar"})
    events.sort(key=lambda f: (f["date"], f.get("time", "")))
    chosen = dated + events[:12 - len(dated)]
    chosen = [d for d in chosen if d.get("state")] + sorted((d for d in chosen if not d.get("state")),
                                                            key=lambda f: (f["date"], f.get("time", "")))
    if not chosen:
        return []
    return [{"type": "upnext", "items": chosen, **({"compact": True} if section.get("compact") else {})}]


# ---- assistant -----------------------------------------------------------------------------------------------------

def assistant_summary(section: dict, ctx: Context) -> list[dict]:
    open_items = _open(ctx)
    bills = round(sum(_amount(i.get("amount")) for i in open_items if i["pile"] == "bills"), 2)
    today = ctx.now.date().isoformat()
    events_today = sum(1 for e in _calendar(ctx, 1) if e["start"][:10] == today)
    return [{"type": "kpis", "items": [
        {"label": "Needs you", "value": len(open_items)},
        {"label": "Bills due", "value": bills, "unit": "$"},
        {"label": "Arriving", "value": sum(1 for i in open_items if i["pile"] == "orders")},
        {"label": "Events today", "value": events_today}]}]


def _as_rows(items: list[dict], view: str, title: str) -> list[dict]:
    if not items:
        return []
    if view == "checklist":
        return [{"type": "checklist", "title": title, "items": [
            {"text": i["title"], "id": i["id"], "group": PILES.get(i["pile"], "Other")} for i in items[:40]]}]
    if view == "table":
        due = [_real_day(i.get("due")) for i in items[:30]]
        rows = [[i["title"], _day_label(d) if d else "", i.get("amount") or "",
                 "in progress" if i["status"] == "pending" else "to do"] for i, d in zip(items[:30], due)]
        return [{"type": "table", "columns": ["Item", "Due", "Amount", "Status"], "rows": rows}]
    return [{"type": "list", "title": title, "items": [
        {"title": i["title"], "subtitle": i.get("detail") or PILES.get(i["pile"], ""),
         **({"run": _safe(i.get("suggestion"))} if _safe(i.get("suggestion")) else {})} for i in items[:12]]}]


def assistant_open(section: dict, ctx: Context) -> list[dict]:
    return _as_rows(_open(ctx), section.get("as") or "checklist", "Needs you")


def assistant_suggestions(section: dict, ctx: Context) -> list[dict]:
    items = [i for i in _open(ctx) if _safe(i.get("suggestion"))]
    if not items:
        return []
    return [{"type": "list", "title": "Suggested", "items": [
        {"title": _safe(i["suggestion"]), "subtitle": i["title"], "run": _safe(i["suggestion"])} for i in items[:12]]}]


def assistant_pile(pile: str):
    def make(section: dict, ctx: Context) -> list[dict]:
        view = section.get("as") or "list"
        return _as_rows(_open(ctx, pile), "list" if view == "table" else view, PILES[pile])
    return make


def assistant_done(section: dict, ctx: Context) -> list[dict]:
    done = sorted(_items(ctx, "done"), key=lambda i: i.get("updated", ""), reverse=True)[:12]
    if not done:
        return []
    def by(item: dict) -> str:
        last = (item.get("history") or [{}])[-1].get("what", "")
        if last == "page: done":
            return "You marked it done"
        if last == "chat: done":
            return "Marked done in chat"
        return last.removeprefix("closed: ") if last.startswith("closed: ") else (item.get("taken") or "Done")
    return [{"type": "list", "title": "Done", "items": [{"title": i["title"], "subtitle": by(i)} for i in done]}]


# ---- Today: briefing, Needs you / Handled, Prepared for you --------------------------------------------------------

ASKS = {"gift": "Help me pick a gift", "recipes": "Plan the menu with me", "places": "Plan the trip with me",
        "plan": "Help me plan it"}


def _when_text(iso: object) -> str | None:
    """"2026-11-11T08:15:00-08:00" → "Wed 11 Nov, 8:15 AM"."""
    try:
        at = datetime.fromisoformat(str(iso))
    except ValueError:
        return None
    hour = at.hour % 12 or 12
    return f"{at:%a} {at.day} {at:%b}, {hour}:{at:%M} {'AM' if at.hour < 12 else 'PM'}"


def _day_text(iso: object) -> str | None:
    day = _real_day(iso)
    return _day_label(day) if day else None


def _trail(item: dict, words: str) -> list[str]:
    noticed = _day_text((item.get("history") or [{}])[0].get("at"))
    steps = [f"Noticed {noticed}"] if noticed else []
    if item.get("taken"):
        steps.append(str(item["taken"]))
    for entry in item.get("history") or []:
        what = str(entry.get("what", ""))
        if what.startswith("closed: "):
            steps.append(what.removeprefix("closed: ").replace(" · ", ": ", 1))
        elif what == "you: reopened":
            steps.append(f"You reopened it {_day_text(entry.get('at')) or ''}".strip())
    if words:
        steps.append(words)
    return steps[:8]


def _details(item: dict, words: str = "") -> dict:
    return {k: v for k, v in {"from": item.get("from"), "received": _when_text(item.get("received")),
                              "about": list(item.get("facts") or []), "trail": _trail(item, words)}.items() if v}


def _link(item: dict) -> dict | None:
    """The pay or renew link, only when it's on the site the item's mail came from."""
    url, site = track.safe_url(str(item.get("pay_link") or "")), track.sender_domain(str(item.get("from") or ""))
    if item.get("flag") == "fake" or not (url and site and track.same_site(url, site)):
        return None
    host = (urlsplit(url).hostname or "").removeprefix("www.")
    return {"label": f"{'Renew' if item.get('pile') == 'renewals' else 'Pay'} on {host}", "url": url}


def _card(item: dict, today) -> dict:
    kind, words = track.state(item, today)
    card = {"id": item["id"], "title": item["title"], "state": kind if kind in ("overdue", "today", "soon") else "open",
            "stateText": words, "link": _link(item),
            "help": "Why does it look fake?" if item.get("flag") == "fake" else _safe(item.get("suggestion")),
            "details": _details(item, words), "amount": item.get("amount")}
    return {k: v for k, v in card.items() if v}


def _prepared(items: list[dict], today) -> dict | None:
    groups = []
    ready = [i for i in items if i.get("status") in ("suggested", "pending") and len(i.get("ideas") or []) >= 2
             and (i.get("prep") or {}).get("kind") in ASKS]
    for item in sorted(ready, key=lambda i: str(i.get("due") or "9999"))[:2]:
        label = ASKS[item["prep"]["kind"]]
        groups.append({k: v for k, v in {"title": item["title"], "date": _day_text(item.get("due")),
                                         "ideas": item["ideas"][:4],
                                         "ask": {"label": label, "text": f"{label}: {item['title']}"}}.items() if v})
    return {"type": "prepared", "groups": groups} if groups else None


def assistant_today(section: dict, ctx: Context) -> list[dict]:
    """Needs you / Handled (a tracker), beside Prepared for you when there are ideas."""
    _config(ctx)
    items = memory.load_items(ctx.blocks_root)
    today = ctx.now.date()
    by_id = {i["id"]: i for i in items}
    rows = []
    for row in track.handled(items, ctx.now):
        item = by_id.get(row["id"], {})
        details = _details(item)
        kept = {k: v for k, v in row.items() if v not in (None, "")}
        rows.append({**kept, "details": details} if details else kept)
    need = [_card(i, today) for i in track.needs_you(items, today)][:20]
    tracker = {"type": "tracker", "need": need, "handled": rows}
    prepared = _prepared(items, today) if section.get("ideas", True) is not False else None
    return [{"type": "columns", "children": [tracker, prepared]}] if prepared else [tracker]


SKY_CODES = [((0, 1), "clear"), ((2, 3), "cloud"), ((45, 48), "fog"), ((51, 67), "rain"), ((71, 77), "snow"),
             ((80, 82), "rain"), ((85, 86), "snow"), ((95, 99), "storm")]


def _sky(code: int, hour: int) -> str:
    sky = next((name for (low, high), name in SKY_CODES if low <= code <= high), "cloud")
    return "night" if sky in ("clear", "cloud") and (hour >= 18 or hour < 6) else sky


def today_briefing(section: dict, ctx: Context) -> list[dict]:
    """The sky band: the day, the weather (when its place is known and the feed answers) and the counts. The greeting
    is the spec's, put in by assemble."""
    _config(ctx)
    block = {"type": "briefing", "greeting": "Today", "date": f"{ctx.now:%A} {ctx.now.day} {ctx.now:%B}",
             "sky": "night" if ctx.now.hour >= 18 or ctx.now.hour < 6 else "clear",
             "counts": track.counts(memory.load_items(ctx.blocks_root), ctx.now)}
    place = section.get("place")
    if place:
        try:
            v = _get(f"weather:{place['lat']},{place['lon']}", live.feeds.INTERVALS["weather"],
                     lambda: live.feeds.weather({"feed": "weather", **place}, _client(ctx)()))
            block.update(place=place["city"], temp=round(v["temp"]), condition=live.feeds.condition(v["code"]),
                         high=round(v["high"]), low=round(v["low"]), sky=_sky(int(v["code"]), ctx.now.hour))
        except Exception:  # noqa: BLE001 - no weather is fine: the band still says what needs you
            pass
    return [block]


# ---- live feeds ----------------------------------------------------------------------------------------------------

def _client(ctx: Context):
    return (lambda: ctx.client) if ctx.client is not None else live._client


def _get(key: str, interval: float, fetch, deadline: float = 3.0) -> dict:
    """A live value through the shared cache and pool: never waits more than `deadline` seconds, and never fetches
    a value that is still fresh."""
    from concurrent.futures import wait
    job = live.POOL.submit(live.CACHE.get, key, interval, fetch)
    done, _ = wait([job], timeout=deadline)
    got = job.result() if done else live.CACHE.peek(key)
    if not got["value"]:
        raise RuntimeError("no value yet")
    return got["value"]


def system(section: dict, ctx: Context) -> list[dict]:
    parts = section.get("show") or ["cpu", "ram", "disk", "gpu"]
    v = _get("system", live.feeds.INTERVALS["system"], lambda: live.feeds.system({"feed": "system"}))
    gb = 2 ** 30
    items = []
    if "cpu" in parts:
        items.append({"label": "CPU", "value": round(v["cpu"]), "unit": "%"})
    if "ram" in parts:
        items.append({"label": "Memory", "value": round(v["ram_used"] / v["ram_total"] * 100), "unit": "%"})
    if "disk" in parts:
        items.append({"label": "Disk", "value": round(v["disk_used"] / v["disk_total"] * 100), "unit": "%"})
    if "gpu" in parts and isinstance(v.get("gpu_used"), int):
        items.append({"label": "GPU memory", "value": round(v["gpu_used"] / gb, 1), "unit": "GB"})
    return [{"type": "kpis", "items": items[:4]}] if items else []


def weather(section: dict, ctx: Context) -> list[dict]:
    place = section.get("place")
    if not place:
        raise NotReady("Add this city again with the dashboard tool so its place can be looked up.")
    item = {"feed": "weather", **place}
    key = f"weather:{place['lat']},{place['lon']}"
    v = _get(key, live.feeds.INTERVALS["weather"], lambda: live.feeds.weather(item, _client(ctx)()))
    if (section.get("as") or "weather") == "weather":
        return [{"type": "weather", "temp": round(v["temp"]), "place": place["city"],
                 "condition": live.feeds.condition(v["code"]), "high": round(v["high"]), "low": round(v["low"])}]
    return [{"type": "kpis", "items": [
        {"label": f"{place['city']} now", "value": round(v["temp"]), "unit": "°"},
        {"label": "High / low", "value": f"{round(v['high'])}° / {round(v['low'])}°"},
        {"label": "Rain", "value": v["rain"], "unit": "%"}]}]


def stock(section: dict, ctx: Context) -> list[dict]:
    symbol = (section.get("stock") or {}).get("symbol") or section["from"].split(".", 1)[1]
    name = (section.get("stock") or {}).get("name") or symbol
    item = {"feed": "stock", "symbol": symbol}
    if (section.get("as") or "kpis") == "chart":
        h = _get(f"history:{symbol}", 900, lambda: live.feeds.history(item, _client(ctx)()))
        return [{"type": "chart", "kind": "line", "title": f"{name}, last month", "x": h["x"],
                 "series": [{"name": symbol, "data": h["y"]}], "unit": "$"}]
    q = _get(f"stock:{symbol}", live.feeds.INTERVALS["stock"], lambda: live.feeds.quote(item, _client(ctx)()))
    return [{"type": "kpis", "items": [{"label": name, "value": q["price"], "unit": q["currency"].strip() or None,
                                        "change": q["change_pct"]}]}]


def tasks(section: dict, ctx: Context) -> list[dict]:
    jobs = live.feeds.tasks({"feed": "tasks"}, ctx.home)["jobs"]
    if not jobs:
        return []
    def when(iso):
        return f"{_day_label(iso[:10])} {_hm(iso)}" if iso else ""
    def status(job):
        return "ok" if job["last_status"] == "ok" else ("failed" if job["last_status"] else "not run yet")
    if (section.get("as") or "table") == "list":
        return [{"type": "list", "title": "Scheduled tasks", "items": [
            {"title": j["name"], "subtitle": f"next {when(j['next_run_at'])}" if j["enabled"] else "off",
             "value": status(j)} for j in jobs[:12]]}]
    return [{"type": "table", "columns": ["Task", "Last run", "Next run", "Status"], "rows": [
        [j["name"], when(j["last_run_at"]), when(j["next_run_at"]) if j["enabled"] else "off", status(j)]
        for j in jobs[:30]]}]


TODAY_PAGE = "page.today"


def today_work(section: dict, ctx: Context) -> list[dict]:
    """Today's work sections: the "today" page's latest snapshot, drawn as the model designed it, in one section
    titled with when it was taken ("Work · 09:12", or the day when it isn't today)."""
    page = pages_store.load(pages_store.TODAY, ctx.blocks_root)
    if page is None:
        raise NotReady("Ask Hermes to design your Today page again to add work sections.")
    snapshot = page.get("snapshot")
    blocks = pages_layout.blocks_for(page)
    if not snapshot:
        return blocks
    at = pages_refresh._when(snapshot.get("at"))
    stamp = ""
    if at:
        local = at.astimezone(ctx.now.tzinfo) if ctx.now.tzinfo else at
        stamp = f" · {local:%H:%M}" if local.date() == ctx.now.date() else f" · {local:%a} {local.day} {local:%b %H:%M}"
    return [{"type": "section", "title": "Work" + stamp, "children": blocks}]


def old_today_slot(section: dict, ctx: Context) -> list[dict]:
    """A Today spec from before work sections were drawn freely (page.today.<slot>)."""
    raise NotReady("Ask Hermes to design your Today page again.")


def today_status(ctx: Context) -> dict:
    """The refresh status of Today's work sections (the "today" page)."""
    page = pages_store.load(pages_store.TODAY, ctx.blocks_root) or {}
    return pages_refresh.status(page, ctx.now)


SOURCES: dict[str, Source] = {
    "calendar.today": Source("your calendar", ("calendar",), calendar_today),
    "calendar.upnext": Source("what's coming", ("upnext",), calendar_upnext),
    "assistant.summary": Source("the summary", ("kpis",), assistant_summary),
    "assistant.open": Source("Needs you", ("checklist", "list"), assistant_open, lambda ctx: _ids(_open(ctx))),
    "assistant.suggestions": Source("suggestions", ("list",), assistant_suggestions,
                                    lambda ctx: _ids(i for i in _open(ctx) if _safe(i.get("suggestion")))),
    **{f"assistant.{pile}": Source(label, ("table", "list", "checklist"), assistant_pile(pile),
                                   lambda ctx, pile=pile: _ids(_open(ctx, pile)))
       for pile, label in PILES.items()},
    "assistant.done": Source("Done", ("list",), assistant_done),
    "assistant.today": Source("what needs you", ("columns",), assistant_today,
                              lambda ctx: _ids(track.needs_you(memory.load_items(ctx.blocks_root), ctx.now.date()))),
    "system": Source("this computer", ("kpis",), system),
    "tasks": Source("scheduled tasks", ("table", "list"), tasks),
    TODAY_PAGE: Source("your work sections", ("section",), today_work),
}
PATTERNS: dict[str, Source] = {
    "page.today.": Source("an old work section", ("section",), old_today_slot),
    "weather.": Source("the weather", ("weather", "kpis"), weather),
    "today.briefing.": Source("your day", ("briefing",), today_briefing),
    "stock.": Source("the stock", ("kpis", "chart"), stock),
}


def source_for(name: str) -> Source | None:
    if name in SOURCES:
        return SOURCES[name]
    for prefix, source in PATTERNS.items():
        if name.startswith(prefix) and len(name) > len(prefix) and len(name) <= len(prefix) + 40:
            return source
    return None


def views_for(name: object) -> tuple[str, ...]:
    found = source_for(name) if isinstance(name, str) else None
    return found.views if found else ()


def catalogue() -> list[str]:
    """Every source with its views, for the tool's help: "assistant.bills (table, list, checklist)"."""
    return [f"{name} ({', '.join(s.views)})" for name, s in SOURCES.items()] + \
        ["weather.<City> (weather, kpis)", "today.briefing.<City> (briefing)", "stock.<SYMBOL> (kpis, chart)",
         "page.today (section)"]


LIVE_PREFIXES = ("system", "weather.", "stock.")
