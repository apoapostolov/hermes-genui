"""The plugin's tools, and the registry Hermes is given them from. Adding a tool: a module here with a handler
`(params, **kwargs) -> str` and its schema, then one ToolSpec line in TOOLS (see CONTRIBUTING.md)."""

from collections.abc import Callable
from dataclasses import dataclass

from ..core.manifest import NAME
from . import (
    assistant,
    assistant_ideas,
    block_guide,
    board_page,
    check_render_capability,
    dashboard,
    market_history,
    photos,
    save_recipe,
    show_blocks,
    standin_photos,
)

# The toolset the tools are listed under: the plugin's name in snake case, "hermes-genui" → "hermes_genui".
TOOLSET = NAME.replace("-", "_")


@dataclass(frozen=True)
class ToolSpec:
    """One tool as Hermes registers it: its name, the JSON schema the model reads, and the handler it calls."""

    name: str
    schema: dict
    handler: Callable[..., str]
    toolset: str = TOOLSET


# Registered in this order.
TOOLS: tuple[ToolSpec, ...] = (
    ToolSpec("show_blocks", show_blocks.SHOW_BLOCKS_SCHEMA, show_blocks.show_blocks),
    ToolSpec("check_render_capability", check_render_capability.CHECK_RENDER_CAPABILITY_SCHEMA,
             check_render_capability.check_render_capability),
    ToolSpec("market_history", market_history.MARKET_HISTORY_SCHEMA, market_history.market_history),
    ToolSpec("find_photos", photos.FIND_PHOTOS_SCHEMA, photos.find_photos),
    ToolSpec("standin_photos", standin_photos.STANDIN_PHOTOS_SCHEMA, standin_photos.standin_photos),
    ToolSpec("save_recipe", save_recipe.SAVE_RECIPE_SCHEMA, save_recipe.save_recipe),
    ToolSpec("dashboard", dashboard.DASHBOARD_SCHEMA, dashboard.dashboard),
    ToolSpec("board_page", board_page.BOARD_PAGE_SCHEMA, board_page.board_page),
    ToolSpec("assistant_setup", assistant.SCHEMAS["assistant_setup"], assistant.handler("assistant_setup")),
    ToolSpec("assistant_items", assistant.SCHEMAS["assistant_items"], assistant.handler("assistant_items")),
    ToolSpec("assistant_open", assistant.SCHEMAS["assistant_open"], assistant.handler("assistant_open"),
             assistant.CHECK_TOOLSET),
    ToolSpec("assistant_inbox", assistant.SCHEMAS["assistant_inbox"], assistant.handler("assistant_inbox"),
             assistant.CHECK_TOOLSET),
    ToolSpec("assistant_calendar", assistant.SCHEMAS["assistant_calendar"], assistant.handler("assistant_calendar"),
             assistant.CHECK_TOOLSET),
    ToolSpec("assistant_report", assistant.SCHEMAS["assistant_report"], assistant.handler("assistant_report"),
             assistant.CHECK_TOOLSET),
    ToolSpec("assistant_ideas", assistant_ideas.SCHEMA, assistant_ideas.handler, assistant_ideas.IDEAS_TOOLSET),
)


def tools_for(guide: str) -> tuple[ToolSpec, ...]:
    """The tools to register: TOOLS, plus block_guide after show_blocks with the menu guide (#42)."""
    if guide != "menu":
        return TOOLS
    return TOOLS[:1] + (ToolSpec("block_guide", block_guide.BLOCK_GUIDE_SCHEMA, block_guide.block_guide),) + TOOLS[1:]
