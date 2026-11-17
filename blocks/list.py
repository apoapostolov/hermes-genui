"""list: rows with a title, a subtitle and a value; ranked rows are numbered."""

from .common import (
    NO_SEND, acts_before_the_model, first_list, first_of, fmt_num,
    has_any_text, has_text, is_number, safe_text,
)


def check_list(block: dict, path: str) -> list[tuple[str, str]]:
    """At least one row with a title; a plain string is a title-only row. A row's run (sent when tapped) can't be a
    command or an @-reference.

    items = ["Third Wave", {"name": "Dyu"}] → [];  items = [{"subtitle": "no title"}] → [("0", "list needs ...")]
    rows = [{"title": "A", "run": "/reset"}] → [("0.rows.0", NO_SEND)]
    """
    key = next((k for k in ("items", "rows") if isinstance(block.get(k), list)), "items")
    rows = first_list(block, "items", "rows")
    risky = [(f"{path}.{key}.{i}", NO_SEND) for i, item in enumerate(rows)
             if isinstance(item, dict) and acts_before_the_model(item.get("run"))]
    if risky:
        return risky
    bars = []
    for i, item in enumerate(rows):
        if not isinstance(item, dict) or item.get("bar") is None or "bar" not in item:
            continue
        value = item.get("bar")
        if not is_number(value) or value < 0:
            bars.append((f"{path}.{key}.{i}.bar", "bar must be a number or null"))
        else:
            bars.append(None)
    if any(problem is not None for problem in bars):
        return [problem for problem in bars if problem is not None]
    for item in rows:
        if has_text(item) or (isinstance(item, dict) and has_any_text(item, "title", "name", "label", "text")):
            return []
    return [(path, "list needs at least one item with a title")]


def text_list(block: dict) -> str:
    """Rows numbered (ranked) or bulleted: "1. Third Wave — 80 Feet Road · 4.5★"; a plain string is a title."""
    items = next((block[k] for k in ("items", "rows") if isinstance(block.get(k), list)), [])
    lines = []
    for item in items[:12]:
        row = {"title": item} if isinstance(item, str) else item
        name = first_of(row, "title", "name", "label", "text") if isinstance(row, dict) else ""
        if not name:
            continue
        subtitle = safe_text(row.get("subtitle"))
        bar = row.get("bar") if isinstance(row, dict) else None
        value = safe_text(row.get("value"), 40) or (fmt_num(bar) if is_number(bar) else "")
        mark = f"{len(lines) + 1}." if block.get("ranked") else "-"
        lines.append(f"{mark} {name}" + (f" — {subtitle}" if subtitle else "") + (f" · {value}" if value else ""))
    title = safe_text(block.get("title"))
    return "\n".join(([f"**{title}**"] if title and lines else []) + lines)
