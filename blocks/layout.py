"""The layout types: row, section, grid and columns (containers) and tabs. They hold other blocks, so their checker and
text rendering also take the caller's own function for one child (core/check.py's and hooks/text_fallback.py's walk),
and nesting rules are applied as the walk goes down.

    check_container(block, path, inside_section, check_child) → problems as "<path>: <why>" strings
    text_container(block, depth, pieces) → text pieces, one per child that has text
"""

from .common import has_text, safe_text

CONTAINERS = ("row", "section", "grid", "columns")
LAYOUT_TYPES = (*CONTAINERS, "tabs")
MAX_IN = {"row": 3, "grid": 6}
MAX_TABS = 6
MAX_TAB_LABEL = 30
MAX_TAB_BADGE = 999  # an optional count beside a tab's label


def check_container(block: dict, path: str, inside_section: bool, check_child) -> list[str]:
    """A container needs children; a section can't hold another section.

    {"type": "row", "children": []} at "0" → ["0: row needs children"]
    a section inside a section at "0" → ["0.children.0: a section can't sit inside a section"]
    """
    kind = block["type"]
    children = block.get("children")
    if not isinstance(children, list) or not children:
        return [f"{path}: {kind} needs children"]
    if kind == "columns" and len(children) > 3:
        return [f"{path}: columns hold at most 3 children"]
    if kind in MAX_IN and len(children) > MAX_IN[kind]:
        return [f"{path}: a {kind} holds at most {MAX_IN[kind]} children"]
    problems: list[str] = []
    for i, child in enumerate(children):
        child_path = f"{path}.children.{i}"
        child_kind = child.get("type") if isinstance(child, dict) else None
        if kind == "section" and child_kind == "section":
            problems.append(f"{child_path}: a section can't sit inside a section")
            continue
        if kind == "columns" and child_kind in ("columns", "section"):
            problems.append(f"{child_path}: columns can't hold columns or a section")
            continue
        problems += check_child(child, child_path, inside_section=inside_section or kind == "section")
    return problems


def check_tabs(block: dict, path: str, inside_section: bool, check_child) -> list[str]:
    """2-6 tabs, each with a label (up to 30 characters), children and an optional count `badge` (1-999). A tab's
    children are checked as if at the top level (columns and sections are fine there), except that tabs can't hold
    tabs. (Tabs sit at the top level only, so `inside_section` is always False here; the caller turns away tabs
    anywhere else.)

    tabs = [{"label": "A", "children": [text]}] → ["0: tabs needs 2-6 tabs"]
    tabs[1] = {"label": "B", "children": [{"type": "text"}]} → ["0.tabs.1.children.0: text needs text"]
    """
    del inside_section
    tabs = block.get("tabs")
    if not isinstance(tabs, list) or not 2 <= len(tabs) <= MAX_TABS:
        return [f"{path}: tabs needs 2-{MAX_TABS} tabs"]
    problems: list[str] = []
    for i, tab in enumerate(tabs):
        where = f"{path}.tabs.{i}"
        if not isinstance(tab, dict):
            problems.append(f"{where}: tab is not an object")
            continue
        label, children = tab.get("label"), tab.get("children")
        if not has_text(label):
            problems.append(f"{where}: tab needs a label")
        elif len(label.strip()) > MAX_TAB_LABEL:
            problems.append(f"{where}: a tab's label is at most {MAX_TAB_LABEL} characters")
        elif not isinstance(children, list) or not children:
            problems.append(f"{where}: tab needs children")
        elif "badge" in tab and not (type(tab["badge"]) is int and 1 <= tab["badge"] <= MAX_TAB_BADGE):
            problems.append(f"{where}: a tab's badge is a whole number from 1 to {MAX_TAB_BADGE}")
        else:
            for j, child in enumerate(children):
                problems += check_child(child, f"{where}.children.{j}", inside_section=False)
    return problems


def text_container(block: dict, depth: int, pieces) -> list[str]:
    """Each child's text in order; a section's title in bold above them when any child has text."""
    kind = block.get("type")
    children = block.get("children") if isinstance(block.get("children"), list) else []
    title = safe_text(block.get("title")) if kind == "section" else ""
    inside = pieces(children, depth + 1)
    return ([f"**{title}**"] if title and inside else []) + inside


def text_tabs(block: dict, depth: int, pieces) -> list[str]:
    """Every tab one after another, each under its label in bold (a tab with no text is left out)."""
    out = []
    for tab in block.get("tabs", []) if isinstance(block.get("tabs"), list) else []:
        children = tab.get("children") if isinstance(tab, dict) and isinstance(tab.get("children"), list) else []
        inside = pieces(children, depth + 1)
        label = safe_text(tab.get("label")) if inside else ""
        out += ([f"**{label}**"] if label else []) + inside
    return out
