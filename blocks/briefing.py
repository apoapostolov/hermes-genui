"""briefing (Today only): the sky band at the top of Today. The greeting, the date, the weather (its sky sets the band's
look) and one sentence about the day built from counts: "1 overdue, 9 need you, and ✓ 4 handled"."""

from .common import has_text, is_number, safe_text

SKIES = ("clear", "cloud", "rain", "snow", "storm", "fog", "night")
COUNTS = ("overdue", "need", "handled")


def _count(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def check_briefing(block: dict, path: str) -> list[tuple[str, str]]:
    """A greeting, a known sky, and whole-number counts; the weather parts are optional.

    {"greeting": "Hi", "sky": "lava", …} → [("0.sky", "one of clear, cloud, rain, snow, storm, fog, night")]
    """
    if not has_text(block.get("greeting")):
        return [(path, "briefing needs a greeting")]
    problems = []
    if block.get("sky") not in SKIES:
        problems.append((f"{path}.sky", f"one of {', '.join(SKIES)}"))
    counts = block.get("counts")
    if not (isinstance(counts, dict) and all(_count(counts.get(k, 0)) for k in COUNTS)):
        problems.append((f"{path}.counts", "overdue, need and handled are whole numbers, 0 or more"))
    for key in ("temp", "high", "low"):
        if block.get(key) is not None and not is_number(block[key]):
            problems.append((f"{path}.{key}", f"{key} must be a number"))
    return problems


def sentence(counts: dict) -> str:
    """"1 overdue, 9 need you, ✓ 4 handled." with the zero parts left out; "Nothing needs you today." for none."""
    parts = [f"{counts['overdue']} overdue" if counts.get("overdue") else "",
             f"{counts['need']} need you" if counts.get("need") else "",
             f"✓ {counts['handled']} handled" if counts.get("handled") else ""]
    parts = [p for p in parts if p]
    if not counts.get("need"):
        parts = ["Nothing needs you today"] + ([parts[-1]] if counts.get("handled") else [])
    return ", ".join(parts) + "."


def text_briefing(block: dict) -> str:
    """"Good morning, Sam. 9° Light rain in Seattle. 1 overdue, 9 need you, ✓ 4 handled."."""
    pieces = [safe_text(block.get("greeting"))]
    if is_number(block.get("temp")):
        sky, place = safe_text(block.get("condition")), safe_text(block.get("place"))
        where = " in ".join(p for p in (sky, place) if p)
        pieces.append(f"{round(block['temp'])}°" + (f" {where}." if where else "."))
    pieces.append(sentence(block.get("counts") or {}))
    return " ".join(p for p in pieces if p)
