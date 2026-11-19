"""Turns catalog.json into the text the model reads in the show_blocks tool description."""

import json
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parent / "catalog.json"
# The short menu for the menu guide (#42): one line per block on what it is for. Every catalog block is named in it.
MENU_PATH = Path(__file__).resolve().parent / "menu.txt"


def _example(entry: dict) -> str:
    return json.dumps(entry["example"], ensure_ascii=False, separators=(",", ":"))


def menu() -> str:
    """The show_blocks description in the menu guide: how to draw, then one line per block (core/menu.txt)."""
    return MENU_PATH.read_text(encoding="utf-8").strip()


def spec(kind: str) -> str | None:
    """How to write one block type: its fields and example, as show_blocks returns them beside a refused block.
    None for a type the catalog doesn't have.

    spec("badge") → 'badge: write {"type": "badge", ...}. Fields: text. tone: good | warn (optional).\nExample: {...}'
    """
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entry = next((e for e in catalog["blocks"] if e["kind"] == kind), None)
    if entry is None:
        return None
    return f'{kind}: write {{"type": "{kind}", ...}}. Fields: {entry['fields']}\nExample: {_example(entry)}'


def icons_line() -> str:
    """The icons a block may use, as block_guide and a refusal list them for blocks with an icon field."""
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return "Icons (only these): " + ", ".join(catalog["icons"]) + "."


def describe() -> str:
    """One short paragraph per block type plus its example; the atoms (small pieces) one line each after them, e.g.

    timeline: A plan, day by day... Use for: Itineraries... Fields: title (optional). groups: [...]
    Example: {"type":"timeline",...}
    ...
    Atoms (small; fine in a row or grid):
    - badge: A small pill. Fields: text. tone: good | warn (optional). {"type":"badge","text":"Open now","tone":"good"}
    """
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    lines = [catalog["about"], "Icons: " + ", ".join(catalog["icons"]) + ".", ""]
    atoms = [entry for entry in catalog["blocks"] if entry.get("group") == "atom"]
    for entry in catalog["blocks"]:
        if entry.get("group") == "atom":
            continue
        lines.append(f"{entry['kind']}: {entry['for']} Use for: {entry['use_when']} Fields: {entry['fields']}")
        lines.append(f"Example: {_example(entry)}")
    if atoms:
        lines.append("Atoms (small; fine in a row or grid):")
        lines += [f"- {entry['kind']}: {entry['for']} Fields: {entry['fields']} {_example(entry)}" for entry in atoms]
    return "\n".join(lines)
