"""Hermes GenUI: tools that store visual blocks and return a `::blocks{id}` tag for Hermes Desktop to draw.

Hermes imports this folder as a package and calls register(ctx). The tools come from the registry in tools/; the
hooks and the prompt section are in hooks/; the recipes in recipes/ become read-only skills named "<plugin>:<recipe>".
The plugin's name is read once from plugin.yaml (core/manifest.py).
"""

from dataclasses import replace

from .core import advanced, recipes
from .core.guide import GUIDE
from .core.manifest import NAME
from .hooks.prompt_section import MAX_CHARS, drawing_rule
from .hooks.text_fallback import text_only
from .hooks.tool_photos import note_tool_photos
from .hooks import tool_photos
from .hooks.visual_nudge import visual_nudge
from .tools import assistant, board_page, photos, tools_for
from .tools.save_recipe import CATEGORY, set_skill_writer


def _tool_specs():
    """The tools to register. Advanced rendering off hides the widget line from show_blocks; the schema is copied, so
    the module's constant still describes every block for any later mode."""
    specs = tools_for(GUIDE)
    if advanced.mode() != "off":
        return specs
    return tuple(
        replace(tool, schema={**tool.schema, "description": advanced.filter_menu(tool.schema["description"])})
        if tool.name == "show_blocks" else tool
        for tool in specs
    )


def register(ctx):
    get_config = getattr(ctx, "get_config", None)
    if callable(get_config):
        assistant.set_config_reader(get_config)
        advanced.configure(get_config)
    standin_on = bool(get_config("photo_test_tool", False)) if callable(get_config) else False
    # The stand-in walks the whole path (tool, hook, board) only while its setting is on.
    tool_photos.record_standin(standin_on)
    for tool in _tool_specs():
        if tool.name == "standin_photos" and not standin_on:
            continue
        ctx.register_tool(name=tool.name, toolset=tool.toolset, schema=tool.schema, handler=tool.handler)
    # Recipes are saved through Hermes's own skill_manage, so its write approval and guards apply.
    set_skill_writer(lambda name, content: ctx.dispatch_tool(
        "skill_manage", {"action": "create", "name": name, "content": content, "category": CATEGORY}))
    # Page photos come from the user's own web search, whatever backend Hermes is set to.
    photos.set_web_search(lambda query: ctx.dispatch_tool("web_search", {"query": query}))
    # A kept page's refresh replays its recorded MCP calls by name.
    board_page.set_dispatch(lambda tool, args: ctx.dispatch_tool(tool, args))
    ctx.register_hook("pre_llm_call", visual_nudge)
    # Generated images come through Hermes's own image tool, not find_photos; note their https URLs in the same store.
    ctx.register_hook("post_tool_call", note_tool_photos)
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
