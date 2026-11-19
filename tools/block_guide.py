"""block_guide: the fields and example of the blocks the model is about to draw, in the menu guide (#42).

block_guide({"blocks": ["table", "chart"]}) → table's spec, a blank line, chart's spec (core.catalog_text.spec).
"""

from ..core.catalog_text import icons_line, spec


def block_guide(params: dict, **kwargs) -> str:
    """Each named block's fields and example, in the order asked, each once; a line for any name the menu lacks."""
    names = params.get("blocks") if isinstance(params, dict) else None
    if isinstance(names, str):
        names = [names]
    if not isinstance(names, list) or not names:
        return 'Give the block names from the show_blocks menu, e.g. ["chart", "table"].'
    parts: list[str] = []
    seen: set[str] = set()
    for name in names:
        name = str(name).strip()
        if name in seen:
            continue
        seen.add(name)
        found = spec(name)
        parts.append(found or f'No block named "{name}". Pick names from the show_blocks menu.')
    text = "\n\n".join(parts)
    if "icon" in text:  # the allowed icons, once, for any block that takes one
        text += "\n" + icons_line()
    return text + "\n\nNow call show_blocks once, with all your blocks in order."


BLOCK_GUIDE_SCHEMA = {
    "name": "block_guide",
    "description": "The fields and an example for each block you'll draw. Call it with their names from the "
                   "show_blocks menu before calling show_blocks.",
    "parameters": {
        "type": "object",
        "properties": {
            "blocks": {"type": "array", "items": {"type": "string"},
                       "description": 'Block names from the show_blocks menu, e.g. ["kpis", "chart"].'},
        },
        "required": ["blocks"],
    },
}
