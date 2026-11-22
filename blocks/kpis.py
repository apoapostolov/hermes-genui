"""Headline numbers: kpis (up to 4 in a row) and stat (one on its own)."""

import sys
from decimal import ROUND_HALF_UP, Decimal

from .common import first_of, has_text, is_number, safe_text, with_unit

# A trend is a small line under the number: enough points to show a shape, few enough to stay small.
TREND_POINTS = (2, 60)

# The two units a change chip can carry: a share of the previous value, or points of the value's own unit.
CHANGE_UNITS = ("%", "pt")

# A chip prints one decimal, so it only carries numbers a reader can scan; past this the digits say nothing and the
# decimal quantise cannot hold them. A larger change loses its chip instead of the board.
MAX_CHIP = 1e15


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
    """One kpis item or a stat: a label, a value, and a trend of 2-60 finite numbers with gaps allowed when one is
    given.

    The optional fields are not checked, because the reader draws what it can and skips the rest: a `previous`,
    `invert_tone` or `change` it cannot use costs the chip, not the board. A null value is one nobody measured; it
    reads "no data" and costs the board nothing.

    Only a missing value is refused; anything written is read by the drawing side, which shows "no data" for a value it
    can't use (so a stricter check here would refuse a board the card draws).
    {"label": "Close", "value": 80, "trend": [100, 90, 80]} → []
    {"label": "Close", "value": 80, "trend": [100]} → [(path, "trend must be a list of 2-60 numbers")]
    {"label": "Close", "value": 80, "previous": 100} → []
    {"label": "Close", "value": 80, "previous": "high", "invert_tone": "yes"} → [] (the reader ignores both)
    {"label": "Chargebacks", "value": null} → [] (a value nobody measured; it reads "no data")
    {"label": "Chargebacks", "value": true} → [] (unusable, drawn "no data", and not a reason to refuse the board)
    {"label": "Chargebacks"} → [(path, "item needs label and value")]
    {"label": "", "value": 80} → [(path, "item needs label and value")]
    """
    if not (isinstance(item, dict) and has_text(item.get("label"))):
        return [(path, f"{what} needs label and value")]
    if "value" not in item or item["value"] == "":
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


def _written_unit(item: dict, fallback: str) -> str:
    """The change unit the figure asks for, or the one its kind defaults to: only "%" and "pt" are units.

    {"change_unit": "pt"}, "%" → "pt";  {"change_unit": "furlongs"}, "%" → "%";  {}, "pt" → "pt"
    """
    unit = item.get("change_unit")
    return unit if unit in CHANGE_UNITS else fallback


def _chip_number(v: object, unit: str) -> tuple[float, str] | None:
    """A change and its unit, or None when a chip cannot print the number: not a number, or past MAX_CHIP.

    2.2, "%" → (2.2, "%");  1e308, "%" → None;  "2.2", "%" → None;  None, "pt" → None
    """
    return (v, unit) if _is_finite(v) and abs(v) < MAX_CHIP else None


def _change(item: dict) -> tuple[float, str] | None:
    """The chip's number and unit for one figure, or None when there is no chip.

    `previous` wins over a written `change`. A change worked out from `previous` counts points on a "%" figure and a
    share of the previous value elsewhere; a written change keeps its own meaning and counts a share, even on a "%"
    figure. A written `change_unit` wins either way. A percentage has no answer from zero, and a text, missing,
    non-finite or unprintably large side leaves nothing to draw.

    {"change": 2.2} → (2.2, "%");  {"change": 5, "unit": "%"} → (5, "%")
    {"value": 18.6, "unit": "%", "previous": 19.5} → (-0.8999999999999986, "pt")
    {"value": 72275, "unit": "₹Cr", "previous": 70223} → (2.922119…, "%")
    {"value": 3, "previous": 3} → (0, "%");  {"value": 70, "previous": 0} → None
    {"value": 70, "previous": None} → None;  {"change": 1e308} → None (too large to print)
    {"value": "Leeds (H)", "previous": 2} → None;  {"previous": 2} → None (no value);  {} → None
    """
    if "previous" in item:
        unit = _written_unit(item, "pt" if item.get("unit") == "%" else "%")
        before, value = item["previous"], item.get("value")
        if not (_is_finite(before) and _is_finite(value)):
            return None
        if unit == "pt":
            return _chip_number(value - before, "pt")
        return _chip_number(None if before == 0 else (value - before) / abs(before) * 100, "%")
    return _chip_number(item.get("change"), _written_unit(item, "%"))


def _tenths(v: float) -> str:
    """The number as a card prints it: one decimal, rounded half away from zero the way the card's toFixed does.
    Both sides round the same stored double, so a value just under a tie prints below it: 0.35 is stored as
    0.34999… and gives "0.3" on the card and here.

    2.25 → "2.3" (f"{2.25:.1f}" rounds the tie to even and would say "2.2");  0.35 → "0.3";  0.15 → "0.1";
    12 → "12.0";  2.922119… → "2.9"
    """
    return str(Decimal(v).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _chip(item: dict) -> str:
    """The change as the card prints it: one decimal, an arrow only when it moved, and the unit as the card writes it.

    {"change": 2.2} → "(▲ 2.2%)";  {"change": 5, "unit": "%"} → "(▲ 5.0%)"
    {"value": 18.6, "unit": "%", "previous": 19.5} → "(▼ 0.9 pt)"
    {"value": 1.25, "unit": "%", "previous": 1} → "(▲ 0.3 pt)"
    {"value": 3, "previous": 3} → "(0.0%)";  {"change": 12} → "(▲ 12.0%)";  {"value": 70, "previous": 0} → ""
    {"change": 1e308} → "" (no chip for a number a chip cannot print)
    """
    found = _change(item)
    if found is None:
        return ""
    change, unit = found
    arrow = "▼ " if change < 0 else "▲ " if change > 0 else ""
    return f"({arrow}{_tenths(abs(change))}{' ' if unit == 'pt' else ''}{unit})"


def _figure(item: dict) -> str:
    """One stat or KPI as a line: {"label": "Revenue", "value": 72275, "unit": "₹Cr", "previous": 70223}
    → "Revenue: 72,275 ₹Cr (▲ 2.9%)". A value nobody measured — null, or one the text side can't write (true, a list,
    NaN) — reads "no data", without the unit, so it is never read as a 0:
    {"label": "Chargebacks", "value": None} → "Chargebacks: no data";  {"value": True} → the same."""
    label = first_of(item, "label", "title")
    if not label:
        return ""
    raw = item.get("value")
    shown = "" if raw is None else safe_text(raw)
    value = with_unit(shown, safe_text(item.get("unit"), 20)) if shown else "no data"
    line = f"{label}: {value}"
    chip = _chip(item)
    return f"{line} {chip}" if chip else line


def text_stat(block: dict) -> str:
    return _figure(block)


def text_kpis(block: dict) -> str:
    items = block.get("items") if isinstance(block.get("items"), list) else []
    return "\n".join(line for line in (_figure(it) for it in items if isinstance(it, dict)) if line)
