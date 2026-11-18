"""show_blocks: the model hands over blocks as JSON; they are checked, stored, and a tag comes back to paste."""

import json
import math

from ..core import store, surface
from ..core.catalog_text import describe
from ..core.check import IMAGE_URL_FIELDS, MAX_NESTING, check_blocks, child_lists, too_deep

__all__ = ["SHOW_BLOCKS_SCHEMA", "child_lists", "paste_instruction", "resolve_includes", "show_blocks",
           "tag_for", "unknown_photos"]

# A stored board bigger than this can't be included in another (the stored board as a whole is capped at
# store.BOARD_LIMIT, 256 KB), so a few includes can't multiply a board's size.
INCLUDE_LIMIT = 64 * 1024


def tag_for(block_id: str) -> str:
    """The line the model pastes into its reply: tag_for("7f3a09bc") → '::blocks{id="7f3a09bc"}'."""
    return f'::blocks{{id="{block_id}"}}'


def paste_instruction(block_id: str, includable: bool = False) -> str:
    """The line telling the model to paste the tag. A tool-made board also says how to place it inside a bigger
    layout (a dashboard), via an include block."""
    paste = f"Put this on its own line in your reply, exactly as it is:\n{tag_for(block_id)}"
    if not includable:
        return paste
    include = f'{{"type": "include", "id": "{block_id}"}}'
    return f"(To place this board inside a bigger layout instead, use {include} in show_blocks.)\n{paste}"


def _not_drawn(problems: list[str]) -> str:
    return "Not drawn. Fix these and call show_blocks again:\n" + "\n".join(f"- {p}" for p in problems)


def _as_list(raw: object) -> list | None:
    """What the model sent, as a list of blocks; None when it isn't JSON at all.

    [{"type": ...}] → the same list
    '[{"type": ...}]' (JSON as a string, which models often send) → the parsed list
    {"type": ...} (one block on its own) → [that block]
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return None
    if isinstance(raw, dict):
        return [raw]
    if isinstance(raw, list):
        return raw
    return None


def photos_in(block: dict) -> list[tuple[str, object]]:
    """Every photo URL one block would draw, each with where it sits inside the block.

    {"type": "images", "images": [{"url": "https://a/x.jpg"}]}  → [("images.0", "https://a/x.jpg")]
    {"type": "image", "src": "https://a/y.jpg"}                 → [("src", "https://a/y.jpg")]
    {"type": "flip", "cards": [{"front": "Q", "back": "A"}, {"front": "Q", "back": "A", "image": "https://a/z.jpg"}]}
    → [("cards.1.image", "https://a/z.jpg")]   (a card or list row without an image has nothing to check)
    {"type": "tiles", "items": [{"title": "Kyoto", "image": "https://a/k.jpg"}]} → [("items.0.image", "https://a/k.jpg")]
    {"type": "steps", "items": [{"title": "Attend", "image": "https://a/s.jpg"}]} → [("items.0.image", "https://a/s.jpg")]
    """
    kind = block.get("type")
    if kind == "images":
        return [(f"images.{j}", p.get("url") if isinstance(p, dict) else None)
                for j, p in enumerate(block.get("images") or [])]
    if kind == "image":
        field = next((k for k in IMAGE_URL_FIELDS if str(block.get(k, "")).startswith("https://")), None)
        return [(field, block[field])] if field else []
    parts = {"flip": ("cards",), "list": ("items", "rows"), "tiles": ("items",), "steps": ("items",)}.get(kind)
    if not parts:
        return []
    name = next((k for k in parts if isinstance(block.get(k), list)), None)
    if name is None:
        return []
    return [(f"{name}.{j}.image", item["image"]) for j, item in enumerate(block[name])
            if isinstance(item, dict) and item.get("image") is not None]


def _with_child_lists(block: dict, lists: dict[str, list]) -> dict:
    """The block with the lists child_lists named swapped for new ones (a copy; the block itself is left alone).

    ({"type": "tabs", "tabs": [{"label": "A", "children": [inc]}]}, {"tabs.0.children": [chart]})
    → {"type": "tabs", "tabs": [{"label": "A", "children": [chart]}]}
    """
    if "children" in lists:
        return {**block, "children": lists["children"]}
    tabs = [{**tab, "children": lists[f"tabs.{j}.children"]} if f"tabs.{j}.children" in lists else tab
            for j, tab in enumerate(block["tabs"])]
    return {**block, "tabs": tabs}


def unknown_photos(blocks: list, known: set[str], path: str = "") -> list[str]:
    """Photos whose URL no tool returned, as problems. Walks into containers and tabs.

    [{"type": "images", "images": [{"url": "https://made.up/x.jpg"}]}] with nothing known
    → ["0.images.0: use only image URLs that a Hermes tool returned"]
    [{"type": "image", "url": "https://made.up/y.jpg"}] → ["0.url: use only image URLs that a Hermes tool returned"]
    """
    problems = []
    for i, block in enumerate(blocks):
        here = f"{path}{i}"
        if not isinstance(block, dict):
            continue
        for where, url in photos_in(block):
            if url not in known:
                problems.append(f"{here}.{where}: use only image URLs that a Hermes tool returned")
        for where, children in child_lists(block):
            problems += unknown_photos(children, known, f"{here}.{where}.")
    return problems


def resolve_includes(blocks: list, problems: list[str], path: str = "", level: int = 0) -> list:
    """The blocks with each include swapped for the board it names (walking into containers and tabs). Unknown ids,
    boards over 64 KB and containers nested more than MAX_NESTING deep are added to `problems` (the walk stops there,
    so it never recurses deeper than that). `level` is how many containers `blocks` sits inside.

    [{"type": "include", "id": "7f3a09bc"}] where 7f3a09bc holds [chart, source] → [chart, source]
    [{"type": "include", "id": "0badc0de"}] (a 70 KB board) → problems ["0: board 0badc0de is too big to include
    (max 64 KB)"]
    """
    out = []
    for i, block in enumerate(blocks):
        here = f"{path}{i}"
        if isinstance(block, dict) and block.get("type") == "include":
            out.extend(_included(str(block.get("id", "")), here, problems))
            continue
        lists = child_lists(block) if isinstance(block, dict) else []
        if lists and level >= MAX_NESTING:
            problems.append(f"{here}: nested too deep (max {MAX_NESTING})")
        elif lists:
            resolved = {where: resolve_includes(children, problems, f"{here}.{where}.", level + 1)
                        for where, children in lists}
            block = _with_child_lists(block, resolved)
        out.append(block)
    return out


def _included(block_id: str, here: str, problems: list[str]) -> list:
    """The board an include at `here` names, or [] with a problem added: unknown, or over INCLUDE_LIMIT (its file's
    size is read before the board is, so a huge file is never loaded).

    "7f3a09bc" (a 2 KB board of [chart, source]) → [chart, source];  "0badc0de" (nothing stored) → [], a problem
    """
    size = store.size(block_id)
    board = store.load(block_id) if size is not None and size <= INCLUDE_LIMIT else None
    if size is not None and size > INCLUDE_LIMIT:
        problems.append(f"{here}: board {block_id} is too big to include (max {INCLUDE_LIMIT // 1024} KB)")
    elif board is None:
        problems.append(f"{here}: no stored board with id {block_id}")
    return board or []


def too_big(blocks: list) -> str | None:
    """The refusal for a board over store.BOARD_LIMIT as JSON, or None when it fits.

    a 300 KB board → "Not drawn: board too big (300 KB, max 256 KB). Draw less or split it.";  a 2 KB board → None
    """
    size = store.board_size(blocks)
    if size <= store.BOARD_LIMIT:
        return None
    return (f"Not drawn: board too big ({math.ceil(size / 1024)} KB, max {store.BOARD_LIMIT // 1024} KB). "
            "Draw less or split it.")


def show_blocks(params: dict, **kwargs) -> str:
    if not surface.can_draw(session_id=str(kwargs.get("session_id") or "")):
        return surface.CANT_DRAW
    blocks = _as_list(params.get("blocks"))
    if blocks is None:
        return _not_drawn(["blocks: not valid JSON"])
    if not blocks:
        return _not_drawn(["blocks: give at least one block"])
    problems = check_blocks(blocks)
    if not problems:
        blocks = resolve_includes(blocks, problems)
    if not problems:  # an included board can take the whole one past the nesting limit
        problems = [deep] if (deep := too_deep(blocks)) else []
    if problems:
        return _not_drawn(problems)
    refusal = too_big(blocks)
    if refusal:
        return refusal
    problems = unknown_photos(blocks, store.known_photo_urls())
    if problems:
        return _not_drawn(problems)
    return paste_instruction(store.save(blocks))


SHOW_BLOCKS_SCHEMA = {
    "name": "show_blocks",
    "description": (
        "Draw visual blocks in the reply (Hermes Desktop): itineraries, trends, comparisons, headline numbers, "
        "photos. Use it when the answer reads better drawn than written. "
        "Paste the returned tag on its own line exactly as returned. "
        "Use only numbers and image URLs a tool returned.\n\n" + describe()
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "blocks": {
                "type": "array",
                "items": {"type": "object"},
                "description": "The blocks to draw, in order. Each has a `type`.",
            }
        },
        "required": ["blocks"],
    },
}
