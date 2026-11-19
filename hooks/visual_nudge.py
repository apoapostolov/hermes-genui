"""A short reminder added next to the user's message when it asks for something visual, in the Desktop app only.

Hermes's own Desktop guidance suggests HTML widgets (::preview) for anything rich or interactive. Right next to the
request, this reminder outweighs that general advice and keeps the answer in blocks.
"""

import re

from ..core import drawn, surface
from ..core.guide import GUIDE

# Surfaces that draw blocks: the Desktop app's local chat. Telegram, the CLI and the rest show tags as text.
DRAWING_PLATFORMS = frozenset({"local", "desktop"})

VISUAL = re.compile(
    r"\b(dashboard|visual\w*|chart|graph|plot|compare|comparison|vs\.?|versus|itinerary|plan|trip|timeline|"
    r"schedule|budget|breakdown|overview|report|interactive|rich|show me|photos?|pictures?|market|stocks?|"
    r"trend|progress|checklist|calculat\w*|emi|sip)\b",
    re.IGNORECASE,
)

# Asks to keep something on screen: putting it somewhere ("on the Today page", "to my sidebar"; "in my ticker" and
# "to the status bar" too, though there is no ticker: the recipe offers the Today page) or a persistence phrase.
# Checked before VISUAL, which would send "stocks" and "dashboard" to the blocks. The bare words aren't enough:
# "what's the ticker for Reliance", "a sidebar for this layout", "my SIM pin", "live NVDA price".
PLACE = r"(ticker|status ?bar|today page|sidebar)"
KEEP = re.compile(
    rf"\b(in|on|to|into|onto)\s+(my|the)\s+{PLACE}\b|\b(always show|keep (it |them )?on screen|keep an eye on)\b",
    re.IGNORECASE,
)

# Asks for a personal dashboard or assistant: the personal-assistant recipe sets it up. Checked first.
ASSISTANT = re.compile(
    r"\b(personal (dashboard|assistant)|be my assistant|watch my (mail|email|inbox|calendar))\b", re.IGNORECASE)

ASSISTANT_REMINDER = (
    "[Set this up with the personal-assistant recipe skill (skill_view(\"hermes-genui:personal-assistant\")): "
    "it asks where mail and calendar come from and creates the scheduled check. Don't draw a board for it.]"
)

KEEP_REMINDER = (
    "[Don't draw a new board for this. To keep something on the Today page, follow the today-page recipe skill: the "
    "dashboard tool puts it there and it refreshes without you (there is no status-bar ticker). To keep a dashboard "
    "you drew as a page in the sidebar, use board_page keep, as the dashboard recipe says.]"
)

REMINDER = (
    "[Draw this with the block tools (show_blocks, market_history, find_photos), following a recipe skill if one "
    "fits. Blocks are rich and interactive: buttons, photo tiles, checklists that save ticks, calculators with "
    "sliders, forms, sortable tables, flash cards, fold-out sections, side-by-side columns. Do not write HTML or "
    "use ::preview widgets.]"
)

# With the menu guide (#42), the reminder also asks for the blocks' fields first.
MENU_REMINDER = REMINDER[:-1] + " Get each block's fields with block_guide first, then call show_blocks once.]"


def _text_of(message: object) -> str:
    """The words of a user message: a plain string, or the text parts of a multimodal one.

    [{"type": "text", "text": "a dashboard"}, {"type": "image_url", ...}] → "a dashboard"
    """
    if isinstance(message, str):
        return message
    if isinstance(message, list):
        return " ".join(p.get("text", "") for p in message if isinstance(p, dict) and p.get("type") == "text")
    return ""


def visual_nudge(user_message: object = "", platform: str = "", **kwargs) -> str | None:
    """The reminder when a Desktop message asks for something visual, else None.

    ("make me a budget dashboard", "local") → REMINDER;  ("capital of Peru?", "local") → None;
    ("make me a dashboard", "telegram") → None;  ("put NVDA on my Today page", "local") → KEEP_REMINDER
    """
    surface.note_platform(str(kwargs.get("session_id") or ""), platform)  # so tools know this session's surface
    drawn.forget(str(kwargs.get("session_id") or ""))  # a new message: last turn's boards are settled
    if platform not in DRAWING_PLATFORMS:
        return None
    text = _text_of(user_message)
    if ASSISTANT.search(text):
        return ASSISTANT_REMINDER
    if KEEP.search(text):
        return KEEP_REMINDER
    if not VISUAL.search(text):
        return None
    return MENU_REMINDER if GUIDE == "menu" else REMINDER
