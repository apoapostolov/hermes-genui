"""Headline numbers: kpis (up to 4 in a row) and stat (one on its own)."""

import math
import sys

from .common import first_of, has_text, is_number, safe_text, with_unit

# A trend is a small line under the number: enough points to show a shape, few enough to stay small.
TREND_POINTS = (2, 60)

# The two units a change chip can carry: a share of the previous value, or points of the value's own unit.
CHANGE_UNITS = ("%", "pt")


def check_kpis(block: dict, path: str) -> list[tuple[str, str]]:
    items = block.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 4:
        return [(path, "kpis needs 1-4 items")]
    problems = []
    for i, item in enumerate(items):
        problems += _check_figure(item, f"{path}.items.{i}", "item")
    return problems


def check_stat(block: dict, path: str) -> list[tuple[str, str]]:
    return _check_figure(block, path, "stat")


def _check_figure(item: object, path: str, what: str) -> list[tuple[str, str]]:
    """One kpis item or a stat: a label and a value; a trend of 2-60 finite numbers; a previous number or null;
    invert_tone true or false.

    {"label": "Close", "value": 80, "trend": [100, 90, 80]} → []
    {"label": "Close", "value": 80, "trend": [100]} → [(path, "trend must be a list of 2-60 numbers")]
    {"label": "Close", "value": 80, "previous": 100} → []
    {"label": "Close", "value": 80, "previous": None} → []
    {"label": "Close", "value": 80, "previous": "high"} → [(path, "previous must be a number, or null")]
    {"label": "Close", "value": 80, "invert_tone": "yes"} → [(path, "invert_tone must be true or false")]
    """
    if not (isinstance(item, dict) and has_text(item.get("label"))):
        return [(path, f"{what} needs label and value")]
    if "value" not in item or item["value"] == "":
        return [(path, f"{what} needs label and value")]
    if item["value"] is not None and not _is_finite(item["value"]) and not has_text(item["value"]):
        return [(path, f"{what} needs label and value")]
    if "trend" in item and not _is_trend(item["trend"]):
        return [(path, "trend must be a list of 2-60 numbers")]
    if "previous" in item and not (item["previous"] is None or _is_finite(item["previous"])):
        return [(path, "previous must be a number, or null")]
    if "invert_tone" in item and not isinstance(item["invert_tone"], bool):
        return [(path, "invert_tone must be true or false")]
    return []


def _is_trend(trend: object) -> bool:
    """A list of 2-60 slots, each a finite number or null (a gap the sparkline breaks at), with 2 numbers at least.

    [100, 90.5, 80] → True;  [100, None, 80] → True;  [1] → False;  [1, "2"] → False;  [1, nan] → False;  61 → False
    """
    fewest, most = TREND_POINTS
    return (isinstance(trend, list) and fewest <= len(trend) <= most
            and all(v is None or _is_finite(v) for v in trend)
            and sum(1 for v in trend if v is not None) >= fewest)


def _is_finite(v: object) -> bool:
    """A number the drawing side reads as one: not NaN, not infinite, and no int too big for a float (10**400).
    Python compares an int with a float exactly, so this never overflows."""
    return is_number(v) and abs(v) <= sys.float_info.max


def _change(item: dict) -> tuple[float, str] | None:
    """The chip's number and unit for one figure, or None when there is no chip.

    `previous` wins over a written `change`. A change on a "%" figure counts points unless it says "%"; any other
    figure counts a share of the previous value unless it says "pt". A percentage has no answer from zero, and a
    text, missing or non-finite side leaves nothing to divide or subtract.

    {"change": 2.2} → (2.2, "%");  {"change": -0.9, "unit": "%"} → (-0.9, "pt")
    {"value": 18.6, "unit": "%", "previous": 19.5} → (-0.8999999999999986, "pt")
    {"value": 72275, "unit": "₹Cr", "previous": 70223} → (2.922119…, "%")
    {"value": 3, "previous": 3} → (0, "%");  {"value": 70, "previous": 0} → None
    {"value": 70, "previous": None} → None
    {"value": "Leeds (H)", "previous": 2} → None;  {"previous": 2} → None (no value);  {} → None
    """
    unit = item.get("unit")
    change_unit = item.get("change_unit")
    if change_unit not in CHANGE_UNITS:
        change_unit = "pt" if unit == "%" else "%"
    if "previous" in item:
        before, value = item["previous"], item.get("value")
        if not (_is_finite(before) and _is_finite(value)):
            return None
        if change_unit == "%":
            return None if before == 0 else ((value - before) / abs(before) * 100, "%")
        return (value - before, "pt")
    change = item.get("change")
    return (change, change_unit) if _is_finite(change) else None


def _tenths(v: float) -> str:
    """The number as a card prints it: one decimal, and a tie rounded away from zero the way the card's toFixed does.
    2.25 → "2.3" (f"{2.25:.1f}" would say "2.2", Python rounding the tie to even);  0.35 → "0.3";  12 → "12.0"
    """
    tenths = math.floor(v * 10 + 0.5)
    return f"{tenths // 10}.{tenths % 10}"


def _chip(item: dict) -> str:
    """The change as the card prints it: one decimal, an arrow only when it moved, and the unit as the card writes it.

    {"change": 2.2} → "(▲ 2.2%)";  {"value": 18.6, "unit": "%", "previous": 19.5} → "(▼ 0.9 pt)"
    {"value": 1.25, "unit": "%", "previous": 1} → "(▲ 0.3 pt)"
    {"value": 3, "previous": 3} → "(0.0%)";  {"change": 12} → "(▲ 12.0%)";  {"value": 70, "previous": 0} → ""
    """
    found = _change(item)
    if found is None:
        return ""
    change, unit = found
    arrow = "▼ " if change < 0 else "▲ " if change > 0 else ""
    return f"({arrow}{_tenths(abs(change))}{' ' if unit == 'pt' else ''}{unit})"


def _figure(item: dict) -> str:
    """One stat or KPI as a line: {"label": "Revenue", "value": 72275, "unit": "₹Cr", "previous": 70223}
    → "Revenue: 72,275 ₹Cr (▲ 2.9%)". A null value says "no data" with no unit, so it isn't read as a 0:
    {"label": "Chargebacks", "value": None} → "Chargebacks: no data"."""
    label = first_of(item, "label", "title")
    if not label:
        return ""
    raw = item.get("value")
    value = "no data" if raw is None else with_unit(safe_text(raw), safe_text(item.get("unit"), 20))
    if not value:
        return ""
    line = f"{label}: {value}"
    chip = _chip(item)
    return f"{line} {chip}" if chip else line


def text_stat(block: dict) -> str:
    return _figure(block)


def text_kpis(block: dict) -> str:
    items = block.get("items") if isinstance(block.get("items"), list) else []
    return "\n".join(line for line in (_figure(it) for it in items if isinstance(it, dict)) if line)
