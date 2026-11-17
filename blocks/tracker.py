"""tracker (Today only): what the personal assistant is tracking, as a switch between Needs you (cards with a state, a
help button, a pay or renew link the plugin vouched for, and Details) and Handled (what it closed, follows or flagged).
"""

from .common import NO_SEND, acts_before_the_model, has_text, safe_text

STATES = ("overdue", "today", "soon", "open")
KINDS = ("closed", "tracking", "protected")
MAX_NEED, MAX_HANDLED = 20, 6


def _https(link: object) -> bool:
    return (isinstance(link, dict) and has_text(link.get("label")) and isinstance(link.get("url"), str)
            and link["url"].startswith("https://"))


def check_tracker(block: dict, path: str) -> list[tuple[str, str]]:
    """Up to 20 cards and 6 rows, each with an id and a title; known states and kinds; https links only.

    {"need": [{"id": "a", "title": "x", "state": "panic"}], …} → [("0.need.0.state", "overdue, today, soon or open")]
    """
    need, handled = block.get("need"), block.get("handled")
    if not (isinstance(need, list) and isinstance(handled, list)):
        return [(path, "tracker needs need and handled lists")]
    if len(need) > MAX_NEED or len(handled) > MAX_HANDLED:
        return [(path, f"at most {MAX_NEED} need and {MAX_HANDLED} handled")]
    problems = []
    for i, card in enumerate(need):
        at = f"{path}.need.{i}"
        if not (isinstance(card, dict) and has_text(card.get("id")) and has_text(card.get("title"))):
            problems.append((at, "a card needs an id and a title"))
        elif card.get("state") not in STATES:
            problems.append((f"{at}.state", "overdue, today, soon or open"))
        elif acts_before_the_model(card.get("help")):
            problems.append((f"{at}.help", NO_SEND))
        elif "link" in card and not _https(card["link"]):
            problems.append((f"{at}.link", "an https url and a label"))
    for i, row in enumerate(handled):
        at = f"{path}.handled.{i}"
        if not (isinstance(row, dict) and has_text(row.get("id")) and has_text(row.get("title"))):
            problems.append((at, "a row needs an id and a title"))
        elif row.get("kind") not in KINDS:
            problems.append((f"{at}.kind", "closed, tracking or protected"))
    return problems


def text_tracker(block: dict) -> str:
    """**Needs you** then "- City Light · $142.36 · Overdue · 1 day"; **Handled** then "- ✓ Xfinity · Paid · why"."""
    def line(*parts: object) -> str:
        return " · ".join(t for t in (safe_text(p) for p in parts) if t)
    need = [f"- {line(c.get('title'), c.get('amount'), c.get('stateText'))}"
            for c in block.get("need") or [] if isinstance(c, dict)]
    done = [f"- ✓ {line(r.get('title'), r.get('verb'), r.get('why'))}"
            for r in block.get("handled") or [] if isinstance(r, dict)]
    sections = [("**Needs you**", need), ("**Handled**", done)]
    return "\n\n".join("\n".join([head, *rows]) for head, rows in sections if rows)
