"""progress: a track toward a goal, with checkpoints or threshold marks, a shape and coloured parts."""

from .common import first_of, fmt_num, has_text, is_number, out_of, safe_text, with_unit

# The shapes a track can be drawn in, the tones a fill or a band can take, and how many marks and parts fit.
SHAPES = ("line", "circle", "dashboard")
TONES = ("good", "warn", "bad")
MAX_THRESHOLDS, MAX_SEGMENTS = 6, 5
LABEL = 28

# The words models reach for, mapped the way the web reader maps them (web/src/blocks/progress/read.ts), so a board the
# reader draws is not refused here. Anything else is a word neither side knows.
SHAPE_ALIASES = {"line": "line", "bar": "line", "circle": "circle", "ring": "circle",
                 "dashboard": "dashboard", "gauge": "dashboard"}
TONE_ALIASES = {"good": "good", "success": "good", "positive": "good", "ok": "good",
                "warn": "warn", "warning": "warn", "caution": "warn",
                "bad": "bad", "danger": "bad", "negative": "bad", "error": "bad"}


def shape_of(value: object) -> str | None:
    """The shape a word means: "ring" → "circle";  "Circle" → "circle";  "bar" → "line";  "pie" → None."""
    return SHAPE_ALIASES.get(value.strip().lower()) if isinstance(value, str) else None


def tone_of(value: object) -> str | None:
    """The tone a word means: "Good" → "good";  "warning" → "warn";  "danger" → "bad";  "blue" → None."""
    return TONE_ALIASES.get(value.strip().lower()) if isinstance(value, str) else None


def check_progress(block: dict, path: str) -> list[tuple[str, str]]:
    """A title, a value and a goal (the track is value / goal). Either may be null: a figure nobody knows, which
    draws an empty track and reads "no data" instead of a 0; a written zero stays a zero.

    {"title": "x", "value": 5, "goal": 0} → [("0", "progress needs a goal above 0")]
    {"title": "x", "value": null, "goal": 120} → []
    {"title": "x", "value": 95, "goal": null} → []
    {"title": "x", "value": "5", "goal": 120} → [("0", "progress needs a numeric value")]
    shape "gauge", tone "warning", parts of 60 and 50 on a goal of 100 → [] (the reader maps the words and clamps)
    shape "pie" → [("0", "shape is line, circle or dashboard")]
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
    if block.get("shape") is not None and shape_of(block.get("shape")) is None:
        problems.append((path, f"shape is {ways(SHAPES)}"))
    if block.get("show_percent") is not None and not isinstance(block.get("show_percent"), bool):
        problems.append((path, "show_percent is true or false"))
    if block.get("tone") is not None and tone_of(block.get("tone")) is None:
        problems.append((path, f"tone is {ways(TONES)}"))
    problems += _mark_problems(block, path)
    problems += _segment_problems(block, path)
    return problems


def ways(words: tuple[str, ...]) -> str:
    """"a, b or c": ("good", "warn", "bad") → "good, warn or bad" (the wording the other checkers use)."""
    return f"{', '.join(words[:-1])} or {words[-1]}"


def _mark_problems(block: dict, path: str) -> list[tuple[str, str]]:
    """What is wrong with the marks a track carries (its thresholds), if anything.

    More marks than the drawing has room for is not a problem: it keeps the first MAX_THRESHOLDS by position, and the
    text writes the same ones. Steps sent as well are ignored, because a threshold is the mark that gets drawn.
    """
    thresholds = block.get("thresholds")
    if thresholds is None:
        return []
    if not isinstance(thresholds, list):
        return [(path, "thresholds is a list of marks")]
    problems = []
    for i, mark in enumerate(thresholds):
        why = _mark_problem(mark)
        if why:
            problems.append((f"{path}.thresholds.{i}", why))
    return problems


def _mark_problem(mark: object) -> str | None:
    """What stops one mark being drawn, or None.

    {"at": 60, "tone": "good"} → None;  {"label": "60"} → "threshold needs a number `at`";  a long label → None (cut)
    """
    if not isinstance(mark, dict):
        return "threshold is not an object"
    if not is_number(mark.get("at")):
        return "threshold needs a number `at`"
    label = mark.get("label")
    if label is not None and not is_number(label) and not isinstance(label, str):
        return "label is a number or text"
    if mark.get("tone") is not None and tone_of(mark.get("tone")) is None:
        return f"tone is {ways(TONES)}"
    return None


def _segment_problems(block: dict, path: str) -> list[tuple[str, str]]:
    """What is wrong with the parts of the track (its segments), if anything.

    Parts that together ask for more than the goal are fine: both sides draw only what fits in the track.
    """
    segments = block.get("segments")
    if segments is None:
        return []
    if not isinstance(segments, list):
        return [(path, "segments is a list of parts")]
    problems = []
    for i, segment in enumerate(segments):
        why, _ = _segment_problem(segment)
        if why:
            problems.append((f"{path}.segments.{i}", why))
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
    label = segment.get("label")
    if label is not None and not isinstance(label, str):
        return "label is text", 0
    if segment.get("tone") is not None and tone_of(segment.get("tone")) is None:
        return f"tone is {ways(TONES)}", 0
    return None, value


def marks(block: dict) -> list[dict]:
    """The marks a track carries, sorted by where they sit, at most MAX_THRESHOLDS of them."""
    thresholds = block.get("thresholds") if isinstance(block.get("thresholds"), list) else []
    found = [m for m in thresholds if isinstance(m, dict) and is_number(m.get("at"))]
    return sorted(found, key=lambda m: m["at"])[:MAX_THRESHOLDS]


def bands(block: dict) -> list[tuple[float, float, str]]:
    """The bands between toned marks, as (from, to, tone), each mark held at the goal: marks at 60 good / 85 warn / 100
    bad on a goal of 100 → [(0, 60, "good"), (60, 85, "warn"), (85, 100, "bad")]; a mark past the goal ends its band
    there and colours nothing beyond it."""
    goal = block["goal"]
    if goal is None:
        return []  # no goal to hold a band against
    found, start = [], 0.0
    for mark in marks(block):
        tone = tone_of(mark.get("tone"))
        if tone is None:
            continue
        end = max(start, min(mark["at"], goal))
        if end > start:
            found.append((start, end, tone))
        start = end
    return found


def zone_tone(block: dict) -> str:
    """The tone of the band the value falls in; the block's own tone (good by default) when no mark is toned.

    marks 60 good / 85 warn / 100 bad: a value of 50 → "good", 70 → "warn", 88 → "bad"
    marks 60 good / 100 warn / 150 bad on a goal of 100: a value of 120 → "warn" (the 150 mark colours nothing)
    """
    fallback = tone_of(block.get("tone")) or "good"
    if block.get("value") is None:
        return fallback  # an unknown reading colours no band
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
    if block.get("show_percent") is True and block.get("value") is not None and safe_text(unit, 20) != "%":
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
