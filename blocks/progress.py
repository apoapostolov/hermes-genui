"""progress: a track toward a goal, with optional checkpoints."""

from .common import first_of, has_text, is_number, out_of


def check_progress(block: dict, path: str) -> list[tuple[str, str]]:
    """A title, a value and a goal (the track is value / goal). Either may be null: a figure nobody knows, which draws
    an empty track and reads "no data" instead of a 0.

    {"title": "x", "value": 5, "goal": 0} → [("0", "progress needs a goal above 0")]
    {"title": "x", "value": null, "goal": 120} → []
    {"title": "x", "value": 95, "goal": null} → []
    {"title": "x", "value": "5", "goal": 120} → [("0", "progress needs a numeric value")]
    """
    if not has_text(block.get("title")):
        return [(path, "progress needs a title")]
    if "value" not in block:
        return [(path, "progress needs a numeric value")]
    if block["value"] is not None and not is_number(block["value"]):
        return [(path, "progress needs a numeric value")]
    if "goal" not in block:
        return [(path, "progress needs a goal above 0")]
    goal = block["goal"]
    if goal is not None and (not is_number(goal) or goal <= 0):
        return [(path, "progress needs a goal above 0")]
    return []


def text_progress(block: dict) -> str:
    return out_of(first_of(block, "title", "label"), block.get("value"), block.get("goal"), block.get("unit"))
