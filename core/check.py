"""Checks a list of blocks before it is stored, so the model can fix mistakes in the same turn.

Only what would make a block undrawable is a problem; the Desktop half reads the rest leniently.
Each problem is "<path>: <why>", where the path walks the JSON: "1.groups.0" is the first group
of the second block. Each type's own checker is in blocks/<type>.py, listed in blocks.TYPES.
"""

import json

from ..blocks import PAGE_TYPES, TYPES
from ..blocks.atoms import IMAGE_URL_FIELDS
from ..blocks.calculator import FORMULA_HELPERS
from ..blocks.chart import CHART_KINDS, chart_kind
from ..blocks.include import ID_PATTERN
from ..blocks.layout import CONTAINERS, LAYOUT_TYPES
from .catalog_text import CATALOG_PATH

__all__ = ["CHECKERS", "CONTAINERS", "FORMULA_HELPERS", "ID_PATTERN", "IMAGE_URL_FIELDS", "MAX_BLOCKS", "MAX_NESTING",
           "check_blocks", "chart_kind", "child_lists", "too_deep"]

# The checkers that look at one block on its own (every type but the layout ones, which hold other blocks).
CHECKERS = {kind: check for kind, (check, _) in TYPES.items() if kind not in LAYOUT_TYPES}
PAGE_CHECKERS = {**CHECKERS, **{kind: check for kind, (check, _) in PAGE_TYPES.items()}}


# A board is drawn on one screen and stored for good, so it stays small: at most 40 blocks at the top level, and
# containers (and tabs) at most 8 deep.
MAX_BLOCKS = 40
MAX_NESTING = 8


def check_blocks(blocks: list, page: bool = False) -> list[str]:
    """All problems in a list of blocks; an empty list means every block can be drawn. Too many blocks or nesting too
    deep is reported on its own, before anything else is looked at (the walk below is recursive).

    check_blocks([{"type": "text", "text": "hi"}]) → []
    check_blocks([{"type": "sundial"}]) → ['0: unknown type "sundial"']
    check_blocks([text] * 41) → ["blocks: too many blocks (max 40)"]
    check_blocks([9 rows, each inside the last]) → ["0.children.0.(…).children.0: nested too deep (max 8)"]
    page=True also accepts the Today page's own blocks (blocks.PAGE_TYPES), which a reply can't use.
    """
    if len(blocks) > MAX_BLOCKS:
        return [f"blocks: too many blocks (max {MAX_BLOCKS})"]
    deep = too_deep(blocks)
    if deep:
        return [deep]
    problems: list[str] = []
    for i, block in enumerate(blocks):
        problems += _check_one(block, str(i), inside_section=False, top=True, page=page)
    return problems


def _check_one(block: object, path: str, inside_section: bool, top: bool = False, page: bool = False) -> list[str]:
    """One block's problems. `top` is True only for the reply's own list, the one place tabs may sit.

    {"type": "tabs", ...} inside a section at "0.children.0" → ["0.children.0: tabs go at the top level only"]
    """
    if not isinstance(block, dict):
        return [f"{path}: not a block object"]
    kind = block.get("type")
    if kind == "tabs" and not top:
        return [f"{path}: tabs go at the top level only"]
    if kind in LAYOUT_TYPES:
        check, _ = TYPES[kind]
        def child(b: object, p: str, inside_section: bool, top: bool = False) -> list[str]:
            return _check_one(b, p, inside_section, top, page)
        return check(block, path, inside_section, child)
    if kind is None:
        return [f"{path}: {_no_type(block)}"]
    checker = (PAGE_CHECKERS if page else CHECKERS).get(kind)
    if checker is None and kind in CHART_KINDS:  # "bar" is also a block of its own, so only types with no checker
        return [f'{path}: "{kind}" is a chart kind: write {{"type": "chart", "kind": "{kind}", ...}}']
    if checker is None:
        return [f'{path}: unknown type "{kind}"']
    return [f"{where}: {why}" for where, why in checker(block, path)]


def _shape(block: dict) -> set[str]:
    """A block's field names, and the field names of the first item in each of its lists, for telling blocks apart.

    {"type": "kpis", "items": [{"label": "Revenue", "value": 4.2}]} → {"items", "items.label", "items.value"}
    """
    names = set()
    for key, value in block.items():
        if key == "type":
            continue
        names.add(key)
        if isinstance(value, list) and value and isinstance(value[0], dict):
            names |= {f"{key}.{sub}" for sub in value[0] if sub != "type"}
    return names


_SHAPES: list[tuple[str, set[str]]] = []


def guess_kinds(block: dict) -> list[str]:
    """The block types whose catalog example has the fields most like this block's, best first; [] when none share
    any. Ties are all returned, in catalog order.

    {"groups": [{"label": "Day 1", "items": [...]}]} → ["timeline"]
    {"text": "Heads up", "tone": "warn"} → ["callout", "badge"]
    """
    if not _SHAPES:
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        _SHAPES.extend((entry["kind"], _shape(entry["example"])) for entry in catalog["blocks"])
    mine = _shape(block)
    scores = [(len(mine & theirs) / len(mine | theirs), kind) for kind, theirs in _SHAPES if mine & theirs]
    if not scores:
        return []
    best = max(score for score, _ in scores)
    return [kind for score, kind in scores if score == best]


def _no_type(block: dict) -> str:
    """The problem for a block with no "type", naming the block its fields point to.

    {"groups": [...]} → 'no "type"; every block needs one, written first, e.g. {"type": "timeline", ...}'
    """
    kinds = guess_kinds(block)
    problem = 'no "type"; every block needs one, written first'
    if not kinds:
        return problem
    others = f" (or {', '.join(kinds[1:3])})" if len(kinds) > 1 else ""
    return f'{problem}, e.g. {{"type": "{kinds[0]}", ...}}{others}'


def child_lists(block: dict) -> list[tuple[str, list]]:
    """The lists of blocks a block holds, each with its path inside the block: a container's children, or each
    tab's children.

    {"type": "row", "children": [a, b]}                          → [("children", [a, b])]
    {"type": "tabs", "tabs": [{"label": "A", "children": [a]}]}  → [("tabs.0.children", [a])]
    {"type": "text", "text": "hi"}                               → []
    """
    if isinstance(block.get("children"), list):
        return [("children", block["children"])]
    if block.get("type") != "tabs" or not isinstance(block.get("tabs"), list):
        return []
    return [(f"tabs.{j}.children", tab["children"]) for j, tab in enumerate(block["tabs"])
            if isinstance(tab, dict) and isinstance(tab.get("children"), list)]


def too_deep(blocks: list, path: str = "", level: int = 0) -> str | None:
    """The problem for the first block holding others that sits more than MAX_NESTING levels down, or None. Walked
    with a list rather than recursion, so even a board nested hundreds deep gives a problem, not a crash. `path` and
    `level` say where `blocks` itself sits (show_blocks checks a list found inside a board this way).

    [row > row > text] → None (2 levels)
    [9 rows, each inside the last] → "0.children.0.children.0.children.0.children.0.children.0.children.0.children.0
    .children.0: nested too deep (max 8)" (the 9th row)
    [tabs > 8 rows] → the 8th row (the tabs are the first level)
    """
    stack = [(f"{path}{i}", block, level + 1) for i, block in reversed(list(enumerate(blocks)))]
    while stack:
        here, block, depth = stack.pop()
        if not isinstance(block, dict):
            continue
        lists = child_lists(block)
        if not lists:
            continue
        if depth > MAX_NESTING:
            return f"{here}: nested too deep (max {MAX_NESTING})"
        for where, children in reversed(lists):
            stack += [(f"{here}.{where}.{j}", child, depth + 1) for j, child in reversed(list(enumerate(children)))]
    return None
