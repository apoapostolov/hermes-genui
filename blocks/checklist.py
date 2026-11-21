"""checklist: things to do or pack; the user's ticks are saved with the board."""

from .common import has_text, safe_text

# An item's state: where the work stands. "done" is also reachable through the older done: true.
STATES = ("pending", "active", "done", "blocked", "skipped")
STATE_RULE = "item state is pending, active, done, blocked or skipped"
OWNER_RULE = "item owner is text up to 40 characters"
NOTE_RULE = "item note is text up to 120 characters"

# The drawing side folds case, surrounding space and the common words for two states. The checker and the text
# fallback use the same map, so a board that draws is a board that renders.
STATE_ALIASES = {
    "pending": "pending", "todo": "pending", "to do": "pending",
    "active": "active", "in progress": "active", "doing": "active",
    "done": "done", "complete": "done", "completed": "done",
    "blocked": "blocked", "skipped": "skipped",
}


def read_state(value: object) -> str | None:
    """The state a model wrote, as one of the five words. "Done", "in progress" and "todo" are accepted."""
    if not isinstance(value, str):
        return None
    return STATE_ALIASES.get(value.strip().lower())

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
    problems = [
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
    if state is not None and read_state(state) is None:
        problems.append((path, STATE_RULE))
    for field, rule in (("owner", OWNER_RULE), ("note", NOTE_RULE)):
        value = item.get(field)
        if value is None:
            continue
        # The reader trims and cuts these to 40/120, and drops one that is empty after trimming. Accept the same
        # values here, including brackets, angle brackets and trailing space that safe_text would escape.
        if not isinstance(value, str):
            problems.append((path, rule))
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
        state = read_state(item.get("state")) or ""
        owner = safe_text(item.get("owner"))[:40]
        note = safe_text(item.get("note"))[:120]
        done = item.get("done") is True or item.get("checked") is True or state == "done"
    else:
        text, state, owner, note, done = safe_text(item), "", "", "", False
    if not text:
        return ""
    # A tick hides the state on the card, so the plain text hides it too.
    aside = ", ".join(part for part in ("" if done else STATE_WORDS.get(state, ""), owner) if part)
    if note:
        aside = f"{aside}: {note}" if aside else note
    return f"- [{'x' if done else ' '}] {text}" + (f" ({aside})" if aside else "")
