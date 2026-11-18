"""chart: line, bar, area, stacked, hbar, combo, pie, donut, scatter, waterfall, histogram or range."""

import re

from .common import change_chip, fmt_num, is_number, safe_text, short_text

CHART_KINDS = ("line", "bar", "area", "stacked", "hbar", "combo", "pie", "donut", "scatter", "waterfall", "histogram", "range")
KIND_ALIASES = {"doughnut": "donut", "stackedbar": "stacked", "horizontalbar": "hbar", "barh": "hbar",
                "hist": "histogram", "rangebar": "range", "floatingbar": "range"}
SCATTER_POINTS = 200   # a scatter series's cap, the same one the web reader keeps
MAX_LABEL = 40         # a point's name, as the web reader keeps it


def chart_kind(name: object) -> str:
    """The kind the drawing side will use for the name written (the same rule as the web reader).

    "Donut" → "donut";  "stacked_bar" → "stacked";  "hist" → "histogram";  "scatter" → "scatter";  "ridge" → "line";
    None → "line"
    """
    if not isinstance(name, str):
        return "line"
    plain = "".join(ch for ch in name.lower() if ch not in " _-")
    if plain in CHART_KINDS:
        return plain
    return KIND_ALIASES.get(plain, "line")


def _limit(kind: str, most: int) -> str:
    """How many series a kind takes, as the problem puts it; a kind that takes one says so without a range.
    ("line", 3) → "a line chart takes 1-3 series";  ("histogram", 1) → "a histogram chart takes 1 series"."""
    return f"a {kind} chart takes 1 series" if most == 1 else f"a {kind} chart takes 1-{most} series"


def check_chart(block: dict, path: str) -> list[tuple[str, str]]:
    """x labels; 1-3 series (stacked and area up to 6, histogram and range exactly 1); every series as long as x,
    holding numbers or null gaps; at least one number, a histogram at least one count above zero and no negative ones,
    and for a pie or donut at least one positive one. A range series carries low and high per x (both numbers or both
    null, low never above high) and an optional now. A scatter's and a waterfall's series hold points instead of data
    and their checks are their own (_check_scatter, _check_waterfall).

    x = ["Mon", "Tue", "Wed"], series[0].data = [1, 2] → [("0.series.0", "data has 2 values but x has 3 labels")]
    a line chart with 4 series → [("0", "a line chart takes 1-3 series")]
    a range whose low is 40 and high 30 → [("0.series.0.1", "low must not be above high")]
    The optional tone is checked last (_check_tone).
    """
    x = block.get("x")
    series = block.get("series")
    kind = chart_kind(block.get("kind"))
    if kind == "scatter":
        return _check_scatter(block, path)
    if kind == "waterfall":
        return _check_waterfall(block, path)
    if not isinstance(x, list) or not x:
        return [(path, "chart needs x labels")]
    if not isinstance(series, list) or not series:
        return [(path, "chart needs 1-6 series")]
    most = 1 if kind in ("histogram", "range") else 6 if kind in ("stacked", "area") else 3
    if len(series) > most:
        return [(path, _limit(kind, most))]
    problems = []
    numbers: list[float] = []
    for i, s in enumerate(series):
        if kind == "range":
            problems += _check_window(s, i, len(x), f"{path}.series.{i}")
            for key in ("low", "high", "now"):
                values = s.get(key) if isinstance(s, dict) else None
                if isinstance(values, list):
                    numbers += [v for v in values if is_number(v)]
            continue
        data = s.get("data") if isinstance(s, dict) else None
        if not isinstance(data, list):
            problems.append((f"{path}.series.{i}", "series needs a data list"))
        elif len(data) != len(x):
            problems.append((f"{path}.series.{i}", f"data has {len(data)} values but x has {len(x)} labels"))
        elif not all(v is None or is_number(v) for v in data):
            problems.append((f"{path}.series.{i}", "data must be numbers (null for a gap)"))
        else:
            numbers += [v for v in data if v is not None]
    if problems:
        return problems
    if not numbers:
        return [(path, "chart needs at least one number")]
    if kind == "histogram":
        if any(v < 0 for v in numbers):
            return [(path, "a histogram counts, so no negative values")]
        if not any(v > 0 for v in numbers):
            return [(path, "a histogram needs a count above zero")]
    if kind in ("pie", "donut") and not any(v > 0 for v in numbers):
        return [(path, f"a {kind} needs at least one positive value")]
    return _check_tone(block, kind, len(series), path)


def _check_scatter(block: dict, path: str) -> list[tuple[str, str]]:
    """1-2 series of points, each a number on both scales (y may be null for unknown), at most 200 points a series.

    series[0].points = [{"x": 9, "y": 24.6}] → []
    points[0] = {"x": "9", "y": 1} → [("0.series.0.points.0", "point needs a numeric x")]
    3 series → [("0", "a scatter chart takes 1-2 series")]
    """
    series = block.get("series")
    if not isinstance(series, list) or not series:
        return [(path, "scatter needs 1-2 series with points")]
    if len(series) > 2:
        return [(path, "a scatter chart takes 1-2 series")]
    problems: list[tuple[str, str]] = []
    drawn = 0
    for i, s in enumerate(series):
        where = f"{path}.series.{i}"
        points = s.get("points") if isinstance(s, dict) else None
        if not isinstance(points, list) or not points:
            problems.append((where, "series needs a points list"))
            continue
        if len(points) > SCATTER_POINTS:
            problems.append((where, f"a scatter series takes at most {SCATTER_POINTS} points"))
            continue
        for j, p in enumerate(points):
            at = f"{where}.points.{j}"
            if not isinstance(p, dict):
                problems.append((at, "point is not an object"))
            elif not is_number(p.get("x")):
                problems.append((at, "point needs a numeric x"))
            elif p.get("y") is not None and not is_number(p.get("y")):
                problems.append((at, "point's y is a number, or null for unknown"))
            elif is_number(p.get("y")):
                drawn += 1
    if problems:
        return problems
    if not drawn:
        return [(path, "scatter needs at least one point with a y")]
    return _check_tone(block, "scatter", len(series), path)


def _check_waterfall(block: dict, path: str) -> list[tuple[str, str]]:
    """One series of points: a label, a signed value or total: true, and a value of null for an unknown step.

    points = [{"label": "Revenue", "value": 120, "total": True}, {"label": "Returns", "value": -8}] → []
    value "8" → [("0.series.0.points.1", "point's value is a number, or null for unknown")]
    two series → [("0", "a waterfall chart takes 1 series")]
    """
    series = block.get("series")
    if not isinstance(series, list) or not series:
        return [(path, "waterfall needs 1 series with points")]
    if len(series) > 1:
        return [(path, "a waterfall chart takes 1 series")]
    points = series[0].get("points") if isinstance(series[0], dict) else None
    if not isinstance(points, list) or not points:
        return [(path, "series needs a points list")]
    problems: list[tuple[str, str]] = []
    drawn = 0
    for j, p in enumerate(points):
        at = f"{path}.series.0.points.{j}"
        if not isinstance(p, dict):
            problems.append((at, "point is not an object"))
            continue
        if not short_text(p.get("label"), MAX_LABEL):
            problems.append((at, f"label is text of at most {MAX_LABEL} characters"))
        if p.get("value") is not None and not is_number(p.get("value")):
            problems.append((at, "point's value is a number, or null for unknown"))
        elif is_number(p.get("value")) or p.get("total") is True:
            drawn += 1
    if problems:
        return problems
    if not drawn:
        return [(path, "waterfall needs at least one point with a value or a total")]
    return _check_tone(block, "waterfall", 1, path)

def _check_window(series: dict, i: int, count: int, path: str) -> list[tuple[str, str]]:
    """A range series: low and high as long as x, each a number or (both) null, low never above high, and now
    optional.

    low = [18], high = [34], x has 1 label → [];  low = [40], high = [30] → [("….1", "low must not be above high")]
    low = [18], high = [None] → [("….1", "a window needs both low and high, or null for neither")]
    """
    if not isinstance(series, dict):
        return [(path, "a range needs low and high for each x")]
    problems = []
    for key in ("low", "high"):
        values = series.get(key)
        if not isinstance(values, list):
            return [(path, f"a range needs {key} for each x")]
        if len(values) != count:
            problems.append((f"{path}.{key}", f"{key} has {len(values)} values but x has {count} labels"))
        elif not all(v is None or is_number(v) for v in values):
            problems.append((f"{path}.{key}", f"{key} must be numbers (null for no window)"))
    if problems:
        return problems
    for j, (low, high) in enumerate(zip(series["low"], series["high"], strict=True)):
        if (low is None) != (high is None):
            problems.append((f"{path}.{j}", "a window needs both low and high, or null for neither"))
        elif is_number(low) and is_number(high) and low > high:
            problems.append((f"{path}.{j}", "low must not be above high"))
    now = series.get("now")
    if now is not None:
        if not isinstance(now, list):
            problems.append((f"{path}.now", "now must be a list of numbers"))
        elif len(now) != count:
            problems.append((f"{path}.now", f"now has {len(now)} values but x has {count} labels"))
        elif not all(v is None or is_number(v) for v in now):
            problems.append((f"{path}.now", "now must be numbers (null for none)"))
    return problems


def _check_tone(block: dict, kind: str, series_count: int, path: str) -> list[tuple[str, str]]:
    """The optional tone: only "change" (one line, green above its first value and orange below), only on a line
    chart with one series.

    {"tone": "change"} on a one-series line → [];  {"tone": "green"} → [("0", 'tone can only be "change"')]
    """
    if "tone" not in block:
        return []
    if block["tone"] != "change":
        return [(path, 'tone can only be "change"')]
    if kind != "line" or series_count != 1:
        return [(path, 'tone "change" is for a one-series line chart')]
    return []


def _series_line(series: dict) -> str:
    """One series, first value to last: {"name": "Revenue", "data": [67087, None, 72275]}
    → "Revenue 67,087 → 72,275 (▲ 7.7%)". No % when the first value is 0."""
    data = [v for v in series.get("data", []) if is_number(v)]
    if not data:
        return ""
    name = safe_text(series.get("name"))
    first, last = data[0], data[-1]
    line = f"{name} {fmt_num(first)} → {fmt_num(last)}".strip()
    if first:
        line += " " + change_chip(round((last - first) / abs(first) * 100, 1))
    return line


def _slices(x: list, series: dict, top: int = 4) -> str:
    """A pie or donut as its biggest slices with their shares: "A 50%, B 20%, C 15%, D 10%, +1 more"."""
    data = series.get("data", [])
    parts = [(safe_text(label), v) for label, v in zip(x, data, strict=False) if is_number(v) and v > 0]
    total = sum(v for _, v in parts)
    if not total:
        return ""
    parts.sort(key=lambda part: part[1], reverse=True)
    shown = [f"{label} {round(v / total * 100)}%".strip() for label, v in parts[:top]]
    if len(parts) > top:
        shown.append(f"+{len(parts) - top} more")
    return ", ".join(shown)


# A title that puts one measure against another names a scatter's two axes: everything before "against", "by" or
# "vs" is the measure up the side, everything after it the one along the bottom (the same rule as axisNames on the
# web side).
AGAINST = re.compile(r"^(.+?)\s+(?:against|by|vs\.?)\s+(.+)$", re.IGNORECASE)


def _axis_word(text: str) -> str:
    """("Price ", "Mileage (km/l)") → "price", "mileage (km/l)"."""
    return re.sub(r"[\s:,.?!]+$", "", text.strip().lower())


def _axis_names(title: str) -> tuple[str, str]:
    """A scatter's axes, along the bottom then up the side; "x" and "y" when the title names neither.

    "Price against mileage" → ("mileage", "price");  "Revenue" → ("x", "y")
    """
    match = AGAINST.match(title.strip())
    if match is None:
        return "x", "y"
    across, up = _axis_word(match.group(2)), _axis_word(match.group(1))
    return (across, up) if across and up else ("x", "y")


def _count(n: int) -> str:
    """(1) → "1 point";  (24) → "24 points"."""
    return f"{n} point" if n == 1 else f"{n} points"


def _drawn_points(series: dict) -> list[dict]:
    """A scatter series' points that have a number on both scales, in the order written."""
    return [p for p in series.get("points", [])
            if isinstance(p, dict) and is_number(p.get("x")) and is_number(p.get("y"))]


def _scatter_line(series: list[dict], title: str) -> str:
    """How a scatter reads: what it plots, then the highest point; several groups give each one's range.

    one series → "4 points; mileage 9 to 62, price 1.2 to 24.6; highest 24.6 at 9 (Fortuner)"
    two series → "Petrol 2 points, mileage 480 to 610; Diesel 2 points, mileage 540 to 690"
    """
    across, up = _axis_names(title)
    groups = [(safe_text(s.get("name"), MAX_LABEL), _drawn_points(s)) for s in series[:2]]
    groups = [(name, points) for name, points in groups if points]
    if not groups:
        return ""
    if len(groups) > 1:
        parts = []
        for name, points in groups:
            xs = [p["x"] for p in points]
            parts.append(f"{name or 'Series'} {_count(len(points))}, {across} {fmt_num(min(xs))} to {fmt_num(max(xs))}")
        return "; ".join(parts)
    points = groups[0][1]
    xs, ys = [p["x"] for p in points], [p["y"] for p in points]
    top = max(points, key=lambda p: (p["y"], -p["x"]))
    line = (f"{_count(len(points))}; {across} {fmt_num(min(xs))} to {fmt_num(max(xs))}, "
            f"{up} {fmt_num(min(ys))} to {fmt_num(max(ys))}; highest {fmt_num(top['y'])} at {fmt_num(top['x'])}")
    label = safe_text(top.get("label"), MAX_LABEL)
    return f"{line} ({label})" if label else line


def _signed(value: float) -> str:
    """A step with its sign: 3200 → "+3,200";  -1450 → "-1,450";  0 → "0"."""
    return f"+{fmt_num(value)}" if value > 0 else fmt_num(value)


def _waterfall_line(series: dict) -> str:
    """A bridge as its points in order: each step with its sign, each total as its balance, an unknown step named.

    → "Gross revenue 120 → -8 Returns → -5 Discounts → Net profit 107"
    → "Opening 2,140 → +3,200 Salary → -1,450 Rent → card, unknown → closing not stated"
    """
    points = [p for p in series.get("points", []) if isinstance(p, dict)]
    balance = 0
    moved = False     # whether a step has moved the balance yet
    broken = False
    parts = []
    for p in points:
        label = safe_text(p.get("label"), MAX_LABEL)
        total = p.get("total") is True
        if broken:
            if total:
                parts.append(f"{label} not stated" if label else "closing not stated")
            continue
        if total:
            opening = p.get("value")
            if not moved and is_number(opening):
                balance = opening
            parts.append(f"{label} {fmt_num(balance)}".strip())
            continue
        value = p.get("value")
        if not is_number(value):
            parts.append(f"{label}, unknown" if label else "unknown")
            broken = True
            continue
        balance += value
        moved = True
        parts.append(f"{_signed(value)} {label}".strip())
    return " → ".join(part for part in parts if part)


def text_chart(block: dict) -> str:
    """The title (and unit), then each series first → last, a scatter's ranges and highest point, a waterfall's steps,
    or a pie's top slices. A written caveat becomes a second italic line.

    → "**Revenue vs profit** (₹Cr): Revenue 67,087 → 72,275 (▲ 7.7%); Net profit 10,720 → 13,420 (▲ 25.2%)"
    → "**Price against mileage** (₹L): 4 points; mileage 9 to 62, price 1.2 to 24.6; highest 24.6 at 9 (Fortuner)"
    → "**Cash flow** (€): Opening 2,140 → +3,200 Salary → -1,450 Rent → card, unknown → closing not stated"
    → "**Revenue** (₹Cr): Revenue 67,087 → 74,010 (▲ 10.3%)\n_Q3 onward is a projection._"
    """

def _bins_line(x: list, series: dict, top: int = 8) -> str:
    """A histogram read left to right: how many it counted, then the bins with their counts (up to 8 of them), or for a
    long one just where the most fell. A bin with no count is not counted and isn't named.

    bins 0-50: 4, 50-100: 12 → "16 counted in 2 bins: 0-50 4, 50-100 12";  20 bins → "29 counted in 20 bins, most in
    50-100 (12)";  no counts → ""
    """
    pairs = [(safe_text(label), v) for label, v in zip(x, series.get("data", []), strict=False)
             if is_number(v) and v >= 0]
    if not pairs:
        return ""
    total = sum(v for _, v in pairs)
    head = f"{fmt_num(total)} counted in {len(pairs)} bin{'s' if len(pairs) != 1 else ''}"
    if len(pairs) > top:
        name, most = max(pairs, key=lambda part: part[1])
        return f"{head}, most in {name} ({fmt_num(most)})"
    return f"{head}: " + ", ".join(f"{label} {fmt_num(v)}".strip() for label, v in pairs)


def _windows_line(x: list, series: dict) -> str:
    """A range read left to right: each x's window, its dot, and where the dot sits if it falls outside.

    Mon 18-34 now 26, Tue 19-36, Wed 20-38 now 42 (above the band) → "Mon 18-34, now 26; Tue 19-36; Wed 20-38,
    now 42 (above the band)";  an x with no window → "Thu no window"
    """
    lows, highs, nows = series.get("low") or [], series.get("high") or [], series.get("now") or []
    parts = []
    for i, label in enumerate(x):
        low = lows[i] if i < len(lows) else None
        high = highs[i] if i < len(highs) else None
        now = nows[i] if i < len(nows) else None
        name = safe_text(label)
        if not (is_number(low) and is_number(high)):
            parts.append(f"{name} no window".strip())
            continue
        part = f"{name} {fmt_num(low)}-{fmt_num(high)}".strip()
        if is_number(now):
            part += f", now {fmt_num(now)}"
            part += " (above the band)" if now > high else " (below the band)" if now < low else ""
        parts.append(part)
    return "; ".join(parts)


def text_chart(block: dict) -> str:
    """One line: the title (and unit), then each series first → last, a histogram's bins and counts, a range's windows,
    or a pie's top slices.

    → "**Revenue vs profit** (₹Cr): Revenue 67,087 → 72,275 (▲ 7.7%); Net profit 10,720 → 13,420 (▲ 25.2%)"
    → "**Calls**: 16 counted in 2 bins: 0-50 4, 50-100 12"
    """
    series = [s for s in block.get("series", []) if isinstance(s, dict)]
    if not series:
        return ""
    kind = chart_kind(block.get("kind"))
    title = safe_text(block.get("title"), 80)
    if kind in ("pie", "donut"):
        body = _slices(block.get("x") or [], series[0])
    elif kind == "scatter":
        body = _scatter_line(series, title)
    elif kind == "waterfall":
        body = _waterfall_line(series[0])
    elif kind == "histogram":
        body = _bins_line(block.get("x") or [], series[0])
    elif kind == "range":
        body = _windows_line(block.get("x") or [], series[0])
    else:
        body = "; ".join(line for line in (_series_line(s) for s in series[:6]) if line)
    if not body:
        return ""
    unit = safe_text(block.get("unit"), 20)
    head = f"**{title or 'Chart'}**" + (f" ({unit})" if unit else "")
    line = f"{head}: {body}"
    caveat = safe_text(block.get("caveat"), 120)
    return f"{line}\n_{caveat}_" if caveat else line
