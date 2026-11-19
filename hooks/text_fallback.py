"""Plain-text boards for chat apps that can't draw blocks.

Hermes Desktop draws a `::blocks{id="..."}` line as a board. Telegram, Discord, the CLI and the rest would show that
line as it is, so the `transform_llm_output` hook (text_only) swaps each tag for a Markdown version of its board.

Everything here is shown in apps that render Markdown, and the blocks came from a model: control characters are
stripped, every string is capped, only http(s) URLs survive, and a block that can't be read is skipped, never raised.
Each type's own text is in blocks/<type>.py (text_<type>), listed in blocks.TYPES; this file walks a board and fits
the result into one message.
"""

import re

from ..blocks import PAGE_TYPES, TYPES
from ..blocks.calculator import arithmetic
from ..blocks.layout import CONTAINERS, LAYOUT_TYPES
from ..blocks.steps import text_steps
from ..core.check import child_lists
from ..core import drawn, store

__all__ = ["CONTAINERS", "RENDERERS", "arithmetic", "blocks_as_text", "replace_tags", "text_only"]

LIMIT = 3500
MORE_NOTE = "… (more in Hermes Desktop)"
MAX_DEPTH = 6

# The renderers that turn one block on its own into text (every type but the layout ones, which hold other blocks).
RENDERERS = {kind: render for kind, (_, render) in {**TYPES, **PAGE_TYPES}.items() if kind not in LAYOUT_TYPES}


def _render(block: object, depth: int, labels: dict) -> list[str]:
    """One block as text pieces (a container gives one piece per child). Unknown types and includes give none. A steps
    block names the boxes it changes with `labels` from the flow it is for."""
    if not isinstance(block, dict) or depth > MAX_DEPTH:
        return []
    kind = block.get("type")
    if kind in LAYOUT_TYPES:
        _, render = TYPES[kind]
        return render(block, depth, lambda children, deeper: _pieces(children, deeper, labels))
    if kind == "steps":
        text = text_steps(block, labels.get(block.get("for")))
    else:
        renderer = RENDERERS.get(kind)
        text = renderer(block) if renderer else ""
    return [text] if text else []


def _render_safely(block: object, depth: int, labels: dict) -> list[str]:
    try:
        return _render(block, depth, labels)
    except Exception:  # a malformed block is skipped: the reply must still go out
        return []


def _pieces(blocks: list, depth: int, labels: dict) -> list[str]:
    out: list[str] = []
    for block in blocks:
        out += _render_safely(block, depth, labels)
    return out


def _flow_labels(blocks: list, depth: int = 0) -> dict[str, dict[str, str]]:
    """Each flow's node labels by flow id, from anywhere on the board (containers and tabs too), so a steps block can
    name the boxes it changes. [{"type": "flow", "id": "tf", "nodes": [{"id": "emb", "label": "Embeddings"}]}]
    → {"tf": {"emb": "Embeddings"}}"""
    found: dict[str, dict[str, str]] = {}
    for block in blocks if depth <= MAX_DEPTH else []:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "flow" and isinstance(block.get("id"), str) and isinstance(block.get("nodes"), list):
            nodes = [n for n in block["nodes"] if isinstance(n, dict)]
            found[block["id"]] = {n["id"]: n["label"] for n in nodes
                                  if isinstance(n.get("id"), str) and isinstance(n.get("label"), str)}
        for _, children in child_lists(block):
            found = {**_flow_labels(children, depth + 1), **found}
    return found


def _fit(pieces: list[str]) -> str:
    """The pieces joined by blank lines, kept under LIMIT characters by cutting between blocks and adding a note."""
    whole = "\n\n".join(pieces)
    if len(whole) <= LIMIT:
        return whole
    room = LIMIT - len(MORE_NOTE) - 2
    kept: list[str] = []
    size = 0
    for piece in pieces:
        if size + len(piece) + 2 > room:
            break
        kept.append(piece)
        size += len(piece) + 2
    if not kept:  # one huge block: keep its first lines
        lines = []
        for line in pieces[0].split("\n"):
            if size + len(line) + 1 > room:
                break
            lines.append(line)
            size += len(line) + 1
        kept = ["\n".join(lines)] if lines else []
    return "\n\n".join(kept + [MORE_NOTE])


def blocks_as_text(blocks: list) -> str:
    """A board as readable Markdown, at most LIMIT characters; "" when nothing in it can be shown as text.

    [{"type": "heading", "text": "Day 1"}, {"type": "stat", "label": "Saved", "value": 12500, "unit": "₹"}]
    → "**Day 1**\\n\\nSaved: 12,500 ₹"
    """
    if not isinstance(blocks, list):
        return ""
    try:
        labels = _flow_labels(blocks)
    except Exception:  # odd ids (unhashable, say) only cost the labels
        labels = {}
    return _fit(_pieces(blocks, 0, labels))


# A tag alone on its line (spaces around it allowed), the way the model pastes it: ::blocks{id="7f3a09bc"}
TAG = re.compile(r'^[ \t]*::blocks\{id="([^"\n]*)"\}[ \t]*(?=\r?$)', re.MULTILINE)
NOT_SHOWN = "(a visual that only shows in Hermes Desktop)"
# Platforms that draw the tag themselves: Hermes Desktop and its local session.
DRAWS_BLOCKS = ("local", "desktop")


def _board_text(block_id: str, load) -> str:
    """The text for one tag: its board as Markdown, or NOT_SHOWN when the id is malformed, nothing is stored under it,
    or nothing in it reads as text."""
    if not re.fullmatch(store.ID_PATTERN, block_id):
        return NOT_SHOWN
    try:
        blocks = load(block_id)
    except Exception:  # an unreadable file must not stop the reply
        return NOT_SHOWN
    return blocks_as_text(blocks) or NOT_SHOWN


def replace_tags(text: str, load=store.load) -> str:
    """The reply with each tag line swapped for its board as text. The swapped-in text is not searched again.

    'Plan:\n::blocks{id="7f3a09bc"}' → "Plan:\n**Kyoto**\n\nDays: 3"
    'Plan:\n::blocks{id="0badc0de"}' (nothing stored) → "Plan:\n(a visual that only shows in Hermes Desktop)"
    "No tags." → "No tags."
    """
    return TAG.sub(lambda match: _board_text(match.group(1), load), text)


def text_only(response_text: str = "", platform: str = "", **kwargs) -> str | None:
    """The transform_llm_output hook: on platforms that can't draw blocks, the reply with its tags as text.

    On Hermes Desktop ("local", "desktop") it only puts back a lost tag (see _with_lost_tag). None (leave the reply as
    it is) for a reply with no tag, or if anything goes wrong; Hermes then sends the reply unchanged.
    """
    session_drawn = drawn.take(str(kwargs.get("session_id") or ""))
    if not isinstance(response_text, str):
        return None
    if str(platform or "").strip().lower() in DRAWS_BLOCKS:
        return _with_lost_tag(response_text, session_drawn)
    if not TAG.search(response_text):
        return None
    try:
        replaced = replace_tags(response_text)
    except Exception:  # the hook must never break a reply
        return None
    return replaced if replaced and replaced != response_text else None


def _with_lost_tag(reply: str, drawn_ids: list[str]) -> str | None:
    """The reply with the last board drawn this turn added, when none of this turn's tags reached it; else None.
    Small models sometimes draw a board and then answer without its tag, and the user sees nothing.

    ("Here is your plan.", ["7f3a09bc"]) → 'Here is your plan.\n\n::blocks{id="7f3a09bc"}'
    ('Plan:\n::blocks{id="7f3a09bc"}', ["7f3a09bc"]) → None;  ("Hi", []) → None
    """
    if not drawn_ids or any(f'::blocks{{id="{block_id}"}}' in reply for block_id in drawn_ids):
        return None
    return reply.rstrip() + f'\n\n::blocks{{id="{drawn_ids[-1]}"}}'
