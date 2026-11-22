"""chart: line, bar, area, stacked, hbar, combo, pie or donut."""

from .common import change_chip, fmt_num, is_number, safe_text

CHART_KINDS = ("line", "bar", "area", "stacked", "hbar", "combo", "pie", "donut")
KIND_ALIASES = {"doughnut": "donut", "stackedbar": "stacked", "horizontalbar": "hbar", "barh": "hbar"}


def chart_kind(name: object) -> str:
    """The kind the drawing side will use for the name written (the same rule as the web reader).

    "Donut" → "donut";  "stacked_bar" → "stacked";  "scatter" → "line";  None → "line"
    """
    if not isinstance(name, str):
        return "line"
    plain = "".join(ch for ch in name.lower() if ch not in " _-")
    if plain in CHART_KINDS:
        return plain
    return KIND_ALIASES.get(plain, "line")


def check_chart(block: dict, path: str) -> list[tuple[str, str]]:
    """x labels; 1-3 series (stacked and area up to 6); every series as long as x, holding numbers or null gaps;
    at least one number, and for a pie or donut at least one positive one.

    x = ["Mon", "Tue", "Wed"], series[0].data = [1, 2] → [("0.series.0", "data has 2 values but x has 3 labels")]
    a line chart with 4 series → [("0", "a line chart takes 1-3 series")]
    The optional tone is checked last (_check_tone).
    """
    x = block.get("x")
    series = block.get("series")
    kind = chart_kind(block.get("kind"))
    if not isinstance(x, list) or not x:
        return [(path, "chart needs x labels")]
    if not isinstance(series, list) or not series:
        return [(path, "chart needs 1-6 series")]
    most = 6 if kind in ("stacked", "area") else 3
    if len(series) > most:
        return [(path, f"a {kind} chart takes 1-{most} series")]
    problems = []
    numbers: list[float] = []
    for i, s in enumerate(series):
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
    if kind in ("pie", "donut") and not any(v > 0 for v in numbers):
        return [(path, f"a {kind} needs at least one positive value")]
    return _check_tone(block, kind, len(series), path) + _check_controls(block, kind, path)


def _check_controls(block: dict, kind: str, path: str) -> list[tuple[str, str]]:
    """The optional drawing controls, checked only when switched on: stepped (true) is for line and combo, sortDesc
    (true) for bar and hbar. Anything else (false, null, a string) means the control is off, as the reader treats it.
    height isn't checked: the reader clamps it to 120-480 and ignores a non-number."""
    problems = []
    if block.get("stepped") is True and kind not in ("line", "combo"):
        problems.append((path, "stepped is for a line or combo chart"))
    if block.get("sortDesc") is True and kind not in ("bar", "hbar"):
        problems.append((path, "sortDesc is for a bar or hbar chart"))
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


def _series_line(series: dict, labels: list) -> str:
    """One series, first value to last, then how many of its slots hold no value and up to three of their labels.

    {"name": "Shop A", "data": [12, None, 0, 9, 14]} → "Shop A 12 → 14, 1 gap (Tue)".
    No % when the first value is 0; first → last keeps working on the observed values, so the chip is unchanged.
    """
    raw = series.get("data", [])
    data = [v for v in raw if is_number(v)]
    if not data:
        return ""
    name = safe_text(series.get("name"))
    first, last = data[0], data[-1]
    line = f"{name} {fmt_num(first)} → {fmt_num(last)}".strip()
    if first:
        line += " " + change_chip(round((last - first) / abs(first) * 100, 1))
    missing = [safe_text(label, 24) for label, v in zip(labels, raw, strict=False) if v is None]
    if missing:
        shown = [label for label in missing if label][:3]
        named = ", ".join(shown) if shown else "unlabelled"
        if len(missing) > len(shown):
            named += f" and {len(missing) - len(shown)} more"
        line += f", {len(missing)} gap{'' if len(missing) == 1 else 's'} ({named})"
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


def text_chart(block: dict) -> str:
    """The title (and unit), then each series first → last, or a pie's top slices. A written caveat becomes a second
    italic line: "**Revenue** (₹Cr): Revenue 67,087 → 74,010 (▲ 10.3%)\n_Q3 onward is a projection._"
    """
    series = [s for s in block.get("series", []) if isinstance(s, dict)]
    x = list(block.get("x") or [])
    if block.get("sortDesc") is True and chart_kind(block.get("kind")) in ("bar", "hbar") and series:
        values = [v if is_number(v) else None for v in series[0].get("data", [])]
        order = sorted(range(len(x)), key=lambda i: (values[i] is None, -(values[i] or 0), i))
        x = [x[i] for i in order if i < len(x)]
        series = [
            {**s, "data": [s.get("data", [])[i] if i < len(s.get("data", [])) else None for i in order]}
            for s in series
        ]
    if not series:
        return ""
    if str(block.get("kind", "")).lower() in ("pie", "donut", "doughnut"):
        body = _slices(x, series[0])
    else:
        body = "; ".join(line for line in (_series_line(s, block.get("x") or []) for s in series[:6]) if line)
    if not body:
        return ""
    unit = safe_text(block.get("unit"), 20)
    title = f"**{safe_text(block.get('title')) or 'Chart'}**" + (f" ({unit})" if unit else "")
    line = f"{title}: {body}"
    caveat = safe_text(block.get("caveat"), 120)
    return f"{line}\n_{caveat}_" if caveat else line
