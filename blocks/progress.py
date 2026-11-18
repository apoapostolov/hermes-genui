"""progress: a track toward a goal, with checkpoints or threshold marks, a shape and coloured parts."""

from .common import first_of, fmt_num, has_text, is_number, out_of, safe_text, short_text, with_unit

# The shapes a track can be drawn in, the tones a fill or a band can take, and how many marks and parts fit.
SHAPES = ("line", "circle", "dashboard")
TONES = ("good", "warn", "bad")
MAX_THRESHOLDS, MAX_SEGMENTS = 6, 5
LABEL = 28


def check_progress(block: dict, path: str) -> list[tuple[str, str]]:
    """A title, a numeric value and a goal above 0 (the track is value / goal); then the optional drawing.

    {"title": "x", "value": 5, "goal": 0} → [("0", "progress needs a goal above 0")]
    six toned marks with steps too → the steps and thresholds problem (a track carries one kind of mark)
    parts of 60 and 50 on a goal of 100 → [("0", "progress segments add up to more than the goal")]
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
    problems = []
    if block.get("shape") is not None and block.get("shape") not in SHAPES:
        problems.append((path, f"shape is {ways(SHAPES)}"))
    if block.get("show_percent") is not None and not isinstance(block.get("show_percent"), bool):
        problems.append((path, "show_percent is true or false"))
    if block.get("tone") is not None and block.get("tone") not in TONES:
        problems.append((path, f"tone is {ways(TONES)}"))
    problems += _mark_problems(block, path)
    problems += _segment_problems(block, path, goal)
    return problems


def ways(words: tuple[str, ...]) -> str:
    """"a, b or c": ("good", "warn", "bad") → "good, warn or bad" (the wording the other checkers use)."""
    return f"{', '.join(words[:-1])} or {words[-1]}"


def _mark_problems(block: dict, path: str) -> list[tuple[str, str]]:
    """What is wrong with the marks a track carries (its thresholds), if anything."""
    thresholds = block.get("thresholds")
    if thresholds is None:
        return []
    if not isinstance(thresholds, list):
        return [(path, "thresholds is a list of marks")]
    problems = []
    if len(thresholds) > MAX_THRESHOLDS:
        problems.append((path, f"progress takes up to {MAX_THRESHOLDS} thresholds"))
    if isinstance(block.get("steps"), list) and block["steps"]:
        problems.append((path, "progress takes steps or thresholds, not both"))
    for i, mark in enumerate(thresholds):
        why = _mark_problem(mark)
        if why:
            problems.append((f"{path}.thresholds.{i}", why))
    return problems


def _mark_problem(mark: object) -> str | None:
    """What stops one mark being drawn, or None.

    {"at": 60, "tone": "good"} → None;  {"label": "60"} → "threshold needs a number `at`"
    """
    if not isinstance(mark, dict):
        return "threshold is not an object"
    if not is_number(mark.get("at")):
        return "threshold needs a number `at`"
    label = mark.get("label")
    if label is not None and not is_number(label) and not (has_text(label) and short_text(label, LABEL)):
        return f"label is a number or text of at most {LABEL} characters"
    if mark.get("tone") is not None and mark.get("tone") not in TONES:
        return f"tone is {ways(TONES)}"
    return None


def _segment_problems(block: dict, path: str, goal: float) -> list[tuple[str, str]]:
    """What is wrong with the parts of the track (its segments), and whether together they ask for more than the
    goal."""
    segments = block.get("segments")
    if segments is None:
        return []
    if not isinstance(segments, list):
        return [(path, "segments is a list of parts")]
    problems = []
    if len(segments) > MAX_SEGMENTS:
        problems.append((path, f"progress takes up to {MAX_SEGMENTS} segments"))
    total = 0.0
    for i, segment in enumerate(segments):
        why, value = _segment_problem(segment)
        if why:
            problems.append((f"{path}.segments.{i}", why))
        else:
            total += value
    if total > goal:
        problems.append((path, "progress segments add up to more than the goal"))
    return problems


def _segment_problem(segment: object) -> tuple[str | None, float]:
    """What stops one part being drawn (or None) and how much of the goal it holds.

    {"value": 40, "label": "Done"} → (None, 40);  {"value": -2} → ("segment needs a number `value` of 0 or more", 0)
    """
    if not isinstance(segment, dict):
        return "segment is not an object", 0
    value = segment.get("value")
    if not is_number(value) or value < 0:
        return "segment needs a number `value` of 0 or more", 0
    if not short_text(segment.get("label"), LABEL):
        return f"label is text of at most {LABEL} characters", 0
    if segment.get("tone") is not None and segment.get("tone") not in TONES:
        return f"tone is {ways(TONES)}", 0
    return None, value


def marks(block: dict) -> list[dict]:
    """The marks a track carries, sorted by where they sit, at most MAX_THRESHOLDS of them."""
    thresholds = block.get("thresholds") if isinstance(block.get("thresholds"), list) else []
    found = [m for m in thresholds if isinstance(m, dict) and is_number(m.get("at"))]
    return sorted(found, key=lambda m: m["at"])[:MAX_THRESHOLDS]


def bands(block: dict) -> list[tuple[float, float, str]]:
    """The bands between toned marks, as (from, to, tone): marks at 60 good / 85 warn / 100 bad on a goal of 100 →
    [(0, 60, "good"), (60, 85, "warn"), (85, 100, "bad")]."""
    goal = block["goal"]
    if not is_number(goal):
        return []
    found, start = [], 0.0
    for mark in marks(block):
        if mark.get("tone") is None:
            continue
        end = max(start, min(mark["at"], goal))
        if end > start:
            found.append((start, end, mark["tone"]))
        start = end
    return found


def zone_tone(block: dict) -> str:
    """The tone of the band the value falls in; the block's own tone (good by default) when no mark is toned.

    marks 60 good / 85 warn / 100 bad: a value of 50 → "good", 70 → "warn", 88 → "bad"
    """
    fallback = block.get("tone") if block.get("tone") in TONES else "good"
    if block.get("value") is None:
        return fallback
    found = bands(block)
    if not found:
        return fallback
    for _, to, tone in found:
        if block["value"] <= to:
            return tone
    return found[-1][2]


def percent_of(value: float, goal: float) -> int:
    """The share of the goal reached as a whole percent, held between 0 and 100: (14, 21.1) → 66;  (150, 120) → 100."""
    if not is_number(goal) or goal <= 0:
        return 0
    return int(max(0.0, min(1.0, value / goal)) * 100 + 0.5)


def _label_text(label: object, unit: object) -> str:
    """A mark's or a part's label as text; a number is written in the block's unit, like the amount."""
    if is_number(label):
        return with_unit(fmt_num(label), safe_text(unit, 20))
    return safe_text(label, LABEL)


def text_progress(block: dict) -> str:
    """The amount, the percent when asked for, the tone when it isn't good, the marks and the parts.

    ("Server load", 88, 100, "%") as a gauge with 60 good / 85 warn / 100 bad → "Server load: 88 / 100% (bad)."
    ("Half marathon", 14, 21.1, "km") with marks "10K" and "Finish" → "Half marathon: 14 / 21.1 km. Marks: 10K, Finish."
    ("Sprint work", 60, 100) with parts Done 40 and In review 20 → "Sprint work: 60 / 100. Done 40, In review 20."
    """
    base = out_of(first_of(block, "title", "label"), block.get("value"), block.get("goal"), block.get("unit"))
    if not base:
        return ""
    unit = block.get("unit")
    if (block.get("show_percent") is True and safe_text(unit, 20) != "%"
            and is_number(block.get("value")) and is_number(block.get("goal"))):
        base += f" ({percent_of(block['value'], block['goal'])}%)"
    tone = zone_tone(block)
    if tone != "good":
        base += f" ({tone})"
    sentences = []
    labelled = [t for t in (_label_text(m.get("label"), unit) for m in marks(block)) if t]
    if labelled:
        sentences.append("Marks: " + ", ".join(labelled))
    segments = block.get("segments") if isinstance(block.get("segments"), list) else []
    parts = []
    for segment in segments[:MAX_SEGMENTS]:
        if not isinstance(segment, dict) or not is_number(segment.get("value")) or segment["value"] < 0:
            continue
        amount = with_unit(fmt_num(float(segment["value"])), safe_text(unit, 20))
        label = safe_text(segment.get("label"), LABEL)
        parts.append(f"{label} {amount}" if label else amount)
    if parts:
        sentences.append(", ".join(parts))
    if not sentences:
        return base
    return ". ".join([base, *sentences]) + "."
