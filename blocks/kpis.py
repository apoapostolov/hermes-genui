"""Headline numbers: kpis (up to 4 in a row) and stat (one on its own)."""

import sys

from .common import change_chip, first_of, has_text, is_number, safe_text, with_unit

# A trend is a small line under the number: enough points to show a shape, few enough to stay small.
TREND_POINTS = (2, 60)


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
    """One kpis item or a stat: a label and a value, and when there is a trend, 2-60 numbers with gaps allowed.

    {"label": "Close", "value": 80, "trend": [100, 90, 80]} → []
    {"label": "Close", "value": 80, "trend": [100]} → [(path, "trend must be a list of 2-60 numbers")]
    {"label": "Chargebacks", "value": null} → [] (a value nobody measured; it reads "no data")
    {"label": "Chargebacks"} → [(path, "item needs label and value")]
    """
    if not (isinstance(item, dict) and has_text(item.get("label"))):
        return [(path, f"{what} needs label and value")]
    if "value" not in item or item["value"] == "":
        return [(path, f"{what} needs label and value")]
    if item["value"] is not None and not _is_finite(item["value"]) and not has_text(item["value"]):
        return [(path, f"{what} needs label and value")]
    if "trend" in item and not _is_trend(item["trend"]):
        return [(path, "trend must be a list of 2-60 numbers")]
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


def _figure(item: dict) -> str:
    """One stat or KPI as a line: {"label": "Revenue", "value": 72275, "unit": "₹Cr", "change": 2.2}
    → "Revenue: 72,275 ₹Cr (▲ 2.2%)". An unknown value says "no data" with no unit, so it isn't read as a 0:
    {"label": "Chargebacks", "value": None} → "Chargebacks: no data"."""
    label = first_of(item, "label", "title")
    if not label:
        return ""
    raw = item.get("value")
    value = "no data" if raw is None else with_unit(safe_text(raw), safe_text(item.get("unit"), 20))
    if not value:
        return ""
    line = f"{label}: {value}"
    chip = change_chip(item.get("change"), item.get("change_unit", "%"))
    return f"{line} {chip}" if chip else line


def text_stat(block: dict) -> str:
    return _figure(block)


def text_kpis(block: dict) -> str:
    items = block.get("items") if isinstance(block.get("items"), list) else []
    return "\n".join(line for line in (_figure(it) for it in items if isinstance(it, dict)) if line)
