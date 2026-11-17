"""Hermes GenUI: tools that store visual blocks and return a `::blocks{id}` tag for Hermes Desktop to draw.

Hermes imports this folder as a package and calls register(ctx). The tools come from the registry in tools/; the
hooks and the prompt section are in hooks/; the recipes in recipes/ become read-only skills named "<plugin>:<recipe>".
The plugin's name is read once from plugin.yaml (core/manifest.py).
"""

from .core import recipes
from .core.manifest import NAME
from .hooks.prompt_section import MAX_CHARS, drawing_rule
from .hooks.text_fallback import text_only
from .hooks.visual_nudge import visual_nudge
from .tools import TOOLS, assistant, board_page, photos
from .tools.save_recipe import CATEGORY, set_skill_writer


def register(ctx):
    for tool in TOOLS:
        ctx.register_tool(name=tool.name, toolset=tool.toolset, schema=tool.schema, handler=tool.handler)
    # Recipes are saved through Hermes's own skill_manage, so its write approval and guards apply.
    set_skill_writer(lambda name, content: ctx.dispatch_tool(
        "skill_manage", {"action": "create", "name": name, "content": content, "category": CATEGORY}))
    # Page photos come from the user's own web search, whatever backend Hermes is set to.
    photos.set_web_search(lambda query: ctx.dispatch_tool("web_search", {"query": query}))
    # A kept page's refresh replays its recorded MCP calls by name.
    board_page.set_dispatch(lambda tool, args: ctx.dispatch_tool(tool, args))
    ctx.register_hook("pre_llm_call", visual_nudge)
    # The assistant's change detector holds this plugin's folder: rewrite it in case the plugin moved.
    try:
        assistant.refresh_monitor()
    except Exception:  # noqa: BLE001 - outside Hermes, or no profile store yet: nothing to refresh
        pass
    ctx.register_hook("transform_llm_output", text_only)
    ctx.register_system_prompt_section(NAME, drawing_rule, max_chars=MAX_CHARS)
    # Each shipped recipe, read in place: skill_view("<plugin>:trip-planner"). Nothing is copied into the profile.
    for recipe in recipes.shipped():
        ctx.register_skill(recipe.name, recipe.path, description=recipe.description)
