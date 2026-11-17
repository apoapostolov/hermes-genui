"""The plugin's own system-prompt section: when and how to draw blocks.

Hermes freezes it into each new session's prompt (`register_system_prompt_section`), under
"## Plugin Context: <plugin name>". It is told the session's platform, so the Desktop app gets the drawing rule and
every other surface (Telegram, the CLI, …) is told to answer in text.
"""

from ..core.manifest import NAME
from ..core.recipes import Recipe, shipped

MAX_CHARS = 1_500

# Surfaces that draw blocks: the Desktop app's local chat.
DRAWING_PLATFORMS = frozenset({"local", "desktop"})


def draw_rule(recipes: list[Recipe]) -> str:
    """The Desktop rule, naming each recipe the way the model loads it: a plugin skill is asked for by its namespaced
    name, skill_view("<plugin>:<recipe>").

    [Recipe("compare", …), Recipe("explain", …)] → '… and a recipe when one fits: load it with
    skill_view("hermes-genui:<recipe>"), recipes: compare, explain. Each tool returns …'
    """
    names = ", ".join(recipe.name for recipe in recipes)
    return f"""You answer inside Hermes Desktop, which draws visual blocks. When a reply reads better drawn than \
written (a plan or itinerary, a trend, a comparison, headline numbers, photos, a dashboard), use the block tools: \
market_history for markets, find_photos for photos, show_blocks for anything you lay out yourself, and a recipe \
when one fits: load it with skill_view("{NAME}:<recipe>"), recipes: {names}. \
Each tool returns a tag like ::blocks{{id="…"}}; put it on its own line in your reply, exactly as returned, never \
inside a sentence, list or code block. Keep the words around it short; the blocks carry the detail. Use only numbers \
and image URLs a tool returned.
Blocks are rich and interactive (tabs, side-by-side columns, buttons, calculators with live charts, checklists, \
forms, sortable tables). For anything visual or "interactive", never write an HTML page, ::preview widget or code \
block.
To keep something on screen and updating, put it on the Today page with the dashboard tool (an assembly of these \
blocks); see the today-page recipe. A personal dashboard or assistant (mail and calendar watched on a schedule): \
the personal-assistant recipe. A dashboard in the reply stays blocks."""


DRAW = draw_rule(shipped())

TEXT = """This chat surface can't draw blocks, so answer in plain text and Markdown. Don't call show_blocks, and \
don't paste ::blocks tags. Tools that fetch data (market_history, find_photos) are fine to use for their numbers \
and links."""


def drawing_rule(session: dict) -> str:
    """The section's text for one session: the drawing rule in the Desktop app, the text-only rule elsewhere.

    {"platform": "local"} → DRAW;  {"platform": "telegram"} → TEXT;  {} → TEXT
    """
    return DRAW if session.get("platform") in DRAWING_PLATFORMS else TEXT
