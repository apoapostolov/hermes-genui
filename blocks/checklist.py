"""checklist: things to do or pack; the user's ticks are saved with the board."""

from .common import has_text, safe_text

# An item's state: where the work stands. "done" is also reachable through the older done: true.
STATES = ("pending", "active", "done", "blocked", "skipped")
STATE_RULE = "item state is pending, active, done, blocked or skipped"
OWNER_RULE = "item owner is plain text up to 40 characters"
NOTE_RULE = "item note is plain text up to 120 characters"
DENSITY_RULE = "density can only be compact or expanded"
SOURCE_IDS_RULE = "item sourceIds is up to 4 plain strings of 40 characters"

# How a state reads in the plain-text version: lower case, a word rather than a colour. done is carried by the tick.
STATE_WORDS = {"pending": "not started", "active": "in progress", "blocked": "blocked", "skipped": "skipped"}


def check_checklist(block: dict, path: str) -> list[tuple[str, str]]:
    """1-40 items, each text or {text, group, id, state, owner, note}. An id (set by the plugin's dashboards, so a tick
    follows the item) is plain text up to 40 characters, unique in the block. A state is one of five words; an owner is
    plain text up to 40 characters and a note up to 120.

    items = ["Passport", {"group": "Clothes"}, {"text": "Ship", "state": "waiting"}] →
      [("0.items.1", "item needs text"), ("0.items.2", "item state is pending, active, done, blocked or skipped")]
    """
    items = block.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 40:
        return [(path, "checklist needs 1-40 items")]
    problems = []
    if "density" in block and block["density"] not in ("compact", "expanded"):
        problems.append((path, DENSITY_RULE))
    problems += [
        (f"{path}.items.{i}", "item needs text")
        for i, it in enumerate(items)
        if not (has_text(it) or (isinstance(it, dict) and has_text(it.get("text"))))
    ]
    seen = set()
    for i, it in enumerate(items):
        item_id = it.get("id") if isinstance(it, dict) else None
        if item_id is None:
            continue
        if not (isinstance(item_id, str) and 0 < len(item_id) <= 40 and safe_text(item_id) == item_id):
            problems.append((f"{path}.items.{i}", "item id is plain text up to 40 characters"))
        elif item_id in seen:
            problems.append((f"{path}.items.{i}", "item id is used twice"))
        seen.add(item_id)
    for i, it in enumerate(items):
        if isinstance(it, dict):
            problems += _item_problems(it, f"{path}.items.{i}")
    return problems


def _item_problems(item: dict, path: str) -> list[tuple[str, str]]:
    """The state, owner and note an item may carry, checked for shape.

    {"state": "blocked", "owner": "Priya", "note": "Waiting"} → [];  {"state": "waiting"} →
      [(path, "item state is pending, active, done, blocked or skipped")]
    """
    problems = []
    state = item.get("state")
    if state is not None and state not in STATES:
        problems.append((path, STATE_RULE))
    for field, rule, limit in (("owner", OWNER_RULE, 40), ("note", NOTE_RULE, 120)):
        value = item.get(field)
        if value is None:
            continue
        if not (isinstance(value, str) and 0 < len(value) <= limit and safe_text(value) == value):
            problems.append((path, rule))
    ids = item.get("sourceIds")
    if ids is not None and not (
        isinstance(ids, list) and 1 <= len(ids) <= 4
        and all(isinstance(i, str) and 0 < len(i) <= 40 and safe_text(i) == i for i in ids)
    ):
        problems.append((path, SOURCE_IDS_RULE))
    return problems


def text_checklist(block: dict) -> str:
    """The title, then "- [ ] Jacket" per item (a string, or {text, group, state, owner, note}); a done item is
    "- [x]", and a state, owner or note follows the text in brackets.

    {"title": "Move", "items": [{"text": "Copy", "state": "active", "owner": "P"}]} →
      "**Move**\\n- [ ] Copy (in progress, P)"
    """
    items = block.get("items") if isinstance(block.get("items"), list) else []
    lines = [line for line in (_item_line(item) for item in items[:40]) if line]
    title = safe_text(block.get("title"))
    return "\n".join(([f"**{title}**"] if title and lines else []) + lines)


def _item_line(item: object) -> str:
    """One item as its line: "- [ ] text (state word, owner: note)", or "" when it has no text.
    {"text": "Verify", "state": "blocked", "note": "Waiting on storage"} → "- [ ] Verify (blocked: Waiting on storage)"
    """
    if isinstance(item, dict):
        text = safe_text(item.get("text"))
        state = item.get("state") if item.get("state") in STATES else ""
        owner = safe_text(item.get("owner"))[:40]
        note = safe_text(item.get("note"))[:120]
        done = item.get("done") is True or state == "done"
        raw_ids = item.get("sourceIds")
        ids = [safe_text(i)[:40] for i in raw_ids[:4] if isinstance(i, str)] if isinstance(raw_ids, list) else []
        sources = f"sources {', '.join(ids[:4])}" if ids else ""
    else:
        text, state, owner, note, done, sources = safe_text(item), "", "", "", False, ""
    if not text:
        return ""
    aside = ", ".join(part for part in (STATE_WORDS.get(state, ""), owner, sources) if part)
    if note:
        aside = f"{aside}: {note}" if aside else note
    return f"- [{'x' if done else ' '}] {text}" + (f" ({aside})" if aside else "")
