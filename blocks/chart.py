"""chart: line, bar, area, stacked, hbar, combo, pie, donut, histogram or range."""

from .common import change_chip, fmt_num, is_number, safe_text

CHART_KINDS = ("line", "bar", "area", "stacked", "hbar", "combo", "pie", "donut", "histogram", "range")
KIND_ALIASES = {"doughnut": "donut", "stackedbar": "stacked", "horizontalbar": "hbar", "barh": "hbar",
                "hist": "histogram", "rangebar": "range", "floatingbar": "range"}


def chart_kind(name: object) -> str:
    """The kind the drawing side will use for the name written (the same rule as the web reader).

    "Donut" → "donut";  "stacked_bar" → "stacked";  "hist" → "histogram";  "scatter" → "line";  None → "line"
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
    null, low never above high) and an optional now.

    x = ["Mon", "Tue", "Wed"], series[0].data = [1, 2] → [("0.series.0", "data has 2 values but x has 3 labels")]
    a line chart with 4 series → [("0", "a line chart takes 1-3 series")]
    a range whose low is 40 and high 30 → [("0.series.0.1", "low must not be above high")]
    The optional tone is checked last (_check_tone).
    """
    x = block.get("x")
    series = block.get("series")
    kind = chart_kind(block.get("kind"))
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
    if kind in ("pie", "donut"):
        body = _slices(block.get("x") or [], series[0])
    elif kind == "histogram":
        body = _bins_line(block.get("x") or [], series[0])
    elif kind == "range":
        body = _windows_line(block.get("x") or [], series[0])
    else:
        body = "; ".join(line for line in (_series_line(s) for s in series[:6]) if line)
    if not body:
        return ""
    unit = safe_text(block.get("unit"), 20)
    title = f"**{safe_text(block.get('title')) or 'Chart'}**" + (f" ({unit})" if unit else "")
    return f"{title}: {body}"
