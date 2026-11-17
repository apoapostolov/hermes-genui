"""actions: a row of up to 3 buttons that send a message; button: one on its own (a message or an https page)."""

from .common import NO_SEND, acts_before_the_model, has_text, is_https, md_link, name_heading, safe_text, safe_url


def check_actions(block: dict, path: str) -> list[tuple[str, str]]:
    """1-3 buttons, each with a label and the message it sends (not a command or an @-reference).

    items = [{"label": "Go"}] → [("0.items.0", "button needs label and run")]
    items = [{"label": "Go", "run": "/reset"}] → [("0.items.0", NO_SEND)]
    """
    items = block.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 3:
        return [(path, "actions needs 1-3 items")]
    problems = []
    for i, it in enumerate(items):
        if not (isinstance(it, dict) and has_text(it.get("label")) and has_text(it.get("run"))):
            problems.append((f"{path}.items.{i}", "button needs label and run"))
        elif acts_before_the_model(it["run"]):
            problems.append((f"{path}.items.{i}", NO_SEND))
    return problems


def check_button(block: dict, path: str) -> list[tuple[str, str]]:
    """A label, and a message to send (run) or an https page to open (url).

    {"label": "Go", "url": "http://x"} → [("0", "button needs run or an https url")]
    {"label": "Go", "run": "@file:notes.md"} → [("0", NO_SEND)]
    """
    if not has_text(block.get("label")):
        return [(path, "button needs a label")]
    if acts_before_the_model(block.get("run")):
        return [(path, NO_SEND)]
    if has_text(block.get("run")) or is_https(block.get("url")):
        return []
    return [(path, "button needs run or an https url")]


def _next_steps(labels: list[str]) -> str:
    labels = [label for label in labels if label]
    return "Next: " + " · ".join(labels) if labels else ""


def text_button(block: dict) -> str:
    label = safe_text(block.get("label"))
    return _next_steps([md_link(label, safe_url(block.get("url"), https_only=True)) if label else ""])


def text_actions(block: dict) -> str:
    """The group's heading, then "Next: A · B": {"name": "Next", "items": [{"label": "Analyze"}]}
    → "**Next**\\nNext: Analyze". No heading when the block gives no name or no label."""
    items = block.get("items") if isinstance(block.get("items"), list) else []
    buttons = _next_steps([safe_text(it.get("label")) for it in items if isinstance(it, dict)])
    if not buttons:
        return ""
    return "\n".join(line for line in (name_heading(block), buttons) if line)
