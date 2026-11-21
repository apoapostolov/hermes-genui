"""list: rows with a title, a subtitle and a value; ranked rows are numbered."""

from .common import (
    NO_SEND, acts_before_the_model, first_list, first_of, fmt_num,
    has_any_text, has_text, is_number, safe_text,
)

# A row's right-hand text, in the order the drawing side reads it (web read.ts): the bar is the last resort, so a row
# that shows its own value never repeats the bar number.
VALUE_KEYS = ("value", "price", "rating", "score", "meta", "badge")


def check_list(block: dict, path: str) -> list[tuple[str, str]]:
    """At least one row with a title; a plain string is a title-only row. A row's run (sent when tapped) can't be a
    command or an @-reference. A row's bar is never refused: the reader draws no bar for a string, a negative number,
    a true/false or anything else that isn't a number, so the board stays usable and is drawn without that track.

    items = ["Third Wave", {"name": "Dyu"}] → [];  items = [{"subtitle": "no title"}] → [("0", "list needs ...")]
    rows = [{"title": "A", "run": "/reset"}] → [("0.rows.0", NO_SEND)]
    rows = [{"title": "A", "bar": "62"}, {"title": "B", "bar": -3}] → []
    """
    key = next((k for k in ("items", "rows") if isinstance(block.get(k), list)), "items")
    rows = first_list(block, "items", "rows")
    risky = [(f"{path}.{key}.{i}", NO_SEND) for i, item in enumerate(rows)
             if isinstance(item, dict) and acts_before_the_model(item.get("run"))]
    if risky:
        return risky
    for item in rows:
        if has_text(item) or (isinstance(item, dict) and has_any_text(item, "title", "name", "label", "text")):
            return []
    return [(path, "list needs at least one item with a title")]


def text_list(block: dict) -> str:
    """Rows numbered (ranked) or bulleted: "1. Third Wave — 80 Feet Road · 4.5★"; a plain string is a title.

    A row's own value is the row's text, and the bar only stands in for it when the row has none, as the card does.
    """
    items = next((block[k] for k in ("items", "rows") if isinstance(block.get(k), list)), [])
    lines = []
    for item in items[:12]:
        row = {"title": item} if isinstance(item, str) else item
        name = first_of(row, "title", "name", "label", "text") if isinstance(row, dict) else ""
        if not name:
            continue
        subtitle = safe_text(row.get("subtitle"))
        value = next(filter(None, (safe_text(row.get(k), 40) for k in VALUE_KEYS)), "")
        bar = row.get("bar") if isinstance(row, dict) else None
        if not value and is_number(bar) and bar >= 0:
            value = fmt_num(bar)
        mark = f"{len(lines) + 1}." if block.get("ranked") else "-"
        lines.append(f"{mark} {name}" + (f" — {subtitle}" if subtitle else "") + (f" · {value}" if value else ""))
    title = safe_text(block.get("title"))
    return "\n".join(([f"**{title}**"] if title and lines else []) + lines)
