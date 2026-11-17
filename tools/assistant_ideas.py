"""assistant_ideas: the tool of the "Assistant ideas" job, which prepares things before the user asks (gift ideas for
a birthday, recipes for a guest, a bill's own payment page). It runs in its own toolset with web search and nothing
that reads mail: it sees only each tagged item's id, title, kind, a few plain words and the sender's site.

    list   → the tagged items still waiting for ideas
    photos → photos for a query (noted, so the page's photo rule lets them in)
    record → ideas for an item (photos must be ones `photos` returned) and a pay link (only on the sender's site)
"""

import json
from datetime import datetime
from pathlib import Path

from ..core import store
from ..core.assistant import memory, track
from . import photos as photo_tool

IDEAS_TOOLSET = "hermes_genui_ideas"
PHOTO_LIMIT = 6


def _blocks(home: Path) -> Path:
    return home / store.STORE_DIR


def _default_home() -> Path:
    return store.default_root().parents[2]


def _list(blocks: Path) -> str:
    waiting = []
    for item in memory.pending_prep(memory.load_items(blocks)):
        entry = {"id": item["id"], "title": item.get("title"), "kind": item["prep"]["kind"],
                 "words": item["prep"]["words"]}
        if item["prep"]["kind"] == "pay":
            entry["site"] = track.sender_domain(str(item.get("from") or ""))
        waiting.append(entry)
    return json.dumps(waiting, ensure_ascii=False) if waiting else "[]"


def _photos(query: str, blocks: Path, find) -> str:
    found = find(query, PHOTO_LIMIT) if query.strip() else []
    store.remember_photo_urls([p["url"] for p in found], blocks)
    return json.dumps([{"url": p["url"], "caption": p.get("caption", ""), "source": p.get("source", "")}
                       for p in found], ensure_ascii=False)


def _record(params: dict, blocks: Path, now: datetime) -> str:
    item = next((i for i in memory.load_items(blocks) if i.get("id") == params.get("id")), None)
    if item is None or not isinstance(item.get("prep"), dict):
        return "No item with that id is waiting for ideas."
    known = store.known_photo_urls(blocks)
    kept, refused = [], []
    for idea in params.get("ideas") or []:
        if isinstance(idea, dict) and idea.get("photo") in known:
            kept.append(idea)
        elif isinstance(idea, dict):
            refused.append(str(idea.get("photo")))
    notes = []
    asked = params.get("pay_link")
    pay = track.safe_url(str(asked)) if asked else None
    site = track.sender_domain(str(item.get("from") or ""))
    if asked and not (pay and site and track.same_site(pay, site)):
        pay = asked
        notes.append(f"pay link {pay} refused: not the sender's site ({site or 'unknown'})")
        pay = None
    elif pay:
        notes.append("pay link kept")
    memory.set_prep_result(item["id"], kept, pay, now, blocks)
    if refused:
        notes.append(f"left out (not from photos): {', '.join(refused)}")
    return f"Recorded {len(kept)} idea{'s' if len(kept) != 1 else ''}" + (f"; {'; '.join(notes)}." if notes else ".")


def run(params: dict, home: Path | None = None, now: datetime | None = None, find=None) -> str:
    """One assistant_ideas call; home, now and the photo finder are injectable for tests."""
    home = home or _default_home()
    now = now or datetime.now().astimezone()
    blocks = _blocks(home)
    action = params.get("action")
    if action == "list":
        return _list(blocks)
    if action == "photos":
        return _photos(str(params.get("query") or ""), blocks, find or (lambda q, n: photo_tool.find(q, n)))
    if action == "record":
        return _record(params, blocks, now)
    return 'action must be "list", "photos" or "record".'


def handler(params, **kwargs) -> str:
    return run(params or {})


SCHEMA = {"name": "assistant_ideas", "description": (
    "The ideas step of the personal assistant. \"list\": items waiting for ideas (id, title, kind, words, and for "
    "kind pay the sender's site). \"photos\" with query: photos to use as ideas. \"record\" with id, ideas "
    "[{title, note, photo (from photos), link}] up to 4, and pay_link (the biller's own https page) for kind pay."),
    "parameters": {"type": "object", "properties": {
        "action": {"type": "string", "enum": ["list", "photos", "record"]}, "query": {"type": "string"},
        "id": {"type": "string"}, "pay_link": {"type": "string"},
        "ideas": {"type": "array", "items": {"type": "object", "properties": {
            "title": {"type": "string"}, "note": {"type": "string"}, "photo": {"type": "string"},
            "link": {"type": "string"}}}}}, "required": ["action"]}}
