"""source: one small line saying where the data came from, or a list of them with kind, date and note."""

import re

from .common import md_link, needs_text, safe_text, safe_url

KINDS = ("web", "file", "tool", "derived")
MAX_ITEMS = 32
# A date and nothing else, so both sides print the same "accessed 2026-11-17".
ACCESSED = re.compile(r"(\d{4}-\d{2}-\d{2})")


def kept_items(block: dict) -> list[dict]:
    """The list items that carry a label. `label`, `url`, `kind`, `accessed`, `note` are the only names either side
    reads. An item without a label is skipped, and a list that keeps nothing is no list at all."""
    items = block.get("items")
    if not isinstance(items, list):
        return []
    return [item for item in items[:MAX_ITEMS] if isinstance(item, dict) and safe_text(item.get("label"), 80)]


def check_source(block: dict, path: str) -> list[tuple[str, str]]:
    if kept_items(block):
        return []
    return needs_text(block, path)


def _item_line(item: dict) -> str:
    label = safe_text(item.get("label"), 80)
    url = safe_url(item.get("url"))
    line = md_link(label, url) if url else label
    kind = safe_text(item.get("kind"), 12)
    if kind in KINDS:
        line += f" [{kind}]"
    match = ACCESSED.match(safe_text(item.get("accessed"), 32))
    if match:
        line += f" · accessed {match.group(1)}"
    note = safe_text(item.get("note"), 160)
    if note:
        line += f" · {note}"
    return line


def text_source(block: dict) -> str:
    items = kept_items(block)
    if items:
        title = safe_text(block.get("title"), 80)
        prefix = f"**{title}**\n" if title else ""
        return f"{prefix}_Sources: {' · '.join(_item_line(item) for item in items)}_"
    text = safe_text(block.get("text"))
    return f"_Source: {md_link(text, safe_url(block.get('url')))}_" if text else ""
