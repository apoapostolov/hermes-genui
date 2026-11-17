"""checklist: things to do or pack; the user's ticks are saved with the board."""

from .common import has_text, safe_text


def check_checklist(block: dict, path: str) -> list[tuple[str, str]]:
    """1-40 items, each text or {text, group, id}. An id (set by the plugin's dashboards, so a tick follows the item)
    is plain text up to 40 characters, unique in the block.

    items = ["Passport", {"group": "Clothes"}] → [("0.items.1", "item needs text")]
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
    return problems


def text_checklist(block: dict) -> str:
    """The title, then "- [ ] Jacket" per item (a string, or {text, group})."""
    items = block.get("items") if isinstance(block.get("items"), list) else []
    lines = []
    for item in items[:40]:
        text = safe_text(item.get("text")) if isinstance(item, dict) else safe_text(item)
        if text:
            lines.append(f"- [ ] {text}")
    title = safe_text(block.get("title"))
    return "\n".join(([f"**{title}**"] if title and lines else []) + lines)
