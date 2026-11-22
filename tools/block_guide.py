"""block_guide: the fields and example of the blocks the model is about to draw, in the menu guide (#42), and the
longer references for the blocks that carry their own grammar (#62).

block_guide({"blocks": ["table", "chart"]}) → table's spec, a blank line, chart's spec (core.catalog_text.spec).
block_guide({"topics": ["widget.state"]}) → that reference, then the same closing line.
"""

from pathlib import Path

from ..core import advanced
from ..core.catalog_text import icons_line, spec

# The references a block can point the model at, written out under core/widget_guide. Each file is kept short enough to
# read in one go; a longer one is cut rather than swelling the reply.
GUIDE_DIR = Path(__file__).resolve().parent.parent / "core" / "widget_guide"
TOPIC_FILES = {
    "widget.layout": "widget.layout.md",
    "widget.state": "widget.state.md",
    "widget.collections": "widget.collections.md",
    "widget.blocks": "widget.blocks.md",
}
MAX_TOPIC_CHARS = 2000
NEXT = "\n\nNow call show_blocks once, with all your blocks in order."
ASK = 'Give the block names from the show_blocks menu, e.g. ["chart", "table"].'


def topic(name: str) -> str | None:
    """One reference as the model reads it: its name, then the file's text; None for a name there is no file for.

    topic("widget.state") → 'widget.state:\\nState and computed values are written before the view: ...'
    topic("widget.colours") → None
    """
    filename = TOPIC_FILES.get(name)
    if filename is None:
        return None
    body = (GUIDE_DIR / filename).read_text(encoding="utf-8").strip()
    if len(body) > MAX_TOPIC_CHARS:
        body = body[: MAX_TOPIC_CHARS - 1].rstrip() + "…"
    return f"{name}:\n{body}"


def _as_names(raw: object) -> list[str]:
    """The names asked for, each once, in order; a single name counts as one.

    ["table", "table"] → ["table"];  "chart" → ["chart"];  None → []
    """
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    names: list[str] = []
    for name in raw:
        name = str(name).strip()
        if name and name not in names:
            names.append(name)
    return names


def _topic_name(name: str) -> str:
    """The reference a model meant: "widget.state" and "state" both name widget.state."""
    return name if name in TOPIC_FILES else f"widget.{name}" if f"widget.{name}" in TOPIC_FILES else name


def block_guide(params: dict, **kwargs) -> str:
    """Each named block's fields and example, then each topic asked for, in the order asked, each once; a line for any
    name the menu or the references lack.

    block_guide({"blocks": ["chart"]}) → chart's spec, then the next step.
    block_guide({"blocks": ["widget"], "topics": ["widget.blocks"]}) → widget's spec, then that reference.
    """
    params = params if isinstance(params, dict) else {}
    names = _as_names(params.get("blocks"))
    wanted = [_topic_name(name) for name in _as_names(params.get("topics"))]
    if not names and not wanted:
        return ASK
    # Off: there is no widget to describe, and the next step (show_blocks) would refuse one; say what the setting is
    # instead of handing the model a reference it cannot use.
    if advanced.mode() == "off" and (wanted or "widget" in names):
        return advanced.SWITCH_OFF_PLAIN
    parts: list[str] = []
    for name in names:
        found = spec(name)
        parts.append(found or f'No block named "{name}". Pick names from the show_blocks menu.')
    topics = [name for name in wanted if name in TOPIC_FILES]
    for name in topics:
        parts.append(topic(name) or "")
    for name in wanted:
        if name not in TOPIC_FILES:
            parts.append(f'No topic named "{name}". Topics are {", ".join(TOPIC_FILES)}.')
    text = "\n\n".join(part for part in parts if part)
    if "icon" in text:  # the allowed icons, once, for any block that takes one
        text += "\n" + icons_line()
    return text + NEXT


BLOCK_GUIDE_SCHEMA = {
    "name": "block_guide",
    "description": "The fields and an example for each block you'll draw, and the longer references for blocks with "
                   "their own grammar. Call it with their names from the show_blocks menu before calling "
                   "show_blocks; a widget can also be asked for topics like \"widget.state\".",
    "parameters": {
        "type": "object",
        "properties": {
            "blocks": {"type": "array", "items": {"type": "string"},
                       "description": 'Block names from the show_blocks menu, e.g. ["kpis", "chart"].'},
            "topics": {"type": "array", "items": {"type": "string"},
                       "description": 'References to read in full, e.g. ["widget.layout", "widget.state"]. One of: '
                                      + ", ".join(TOPIC_FILES) + "."},
        },
    },
}
