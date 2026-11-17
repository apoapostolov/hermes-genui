"""Every block type the plugin knows, in one place: its checker (run before a board is stored, so the model can fix
mistakes in the same turn) and its text rendering (for chat apps that can't draw blocks). core/check.py and
hooks/text_fallback.py look types up here, so a type missing here is unknown.

    check_<x>(block, path) → [(path, why), ...]   (empty when the block can be drawn)
    text_<x>(block) → Markdown, or "" when nothing in it reads as text

The layout types (row, section, grid, columns, tabs) hold other blocks, so theirs take more: see layout.py.
Adding a type: a module here with check_<x> and text_<x>, and one line in TYPES (see CONTRIBUTING.md).
"""

from .actions import check_actions, check_button, text_actions, text_button
from .atoms import (
    check_badge,
    check_bar,
    check_divider,
    check_heading,
    check_image,
    check_link,
    check_text,
    text_badge,
    text_bar,
    text_divider,
    text_heading,
    text_image,
    text_link,
    text_text,
)
from .briefing import check_briefing, text_briefing
from .calculator import check_calculator, text_calculator
from .calendar import check_calendar, text_calendar
from .callout import check_callout, text_callout
from .upnext import check_upnext, text_upnext
from .weather import check_weather, text_weather
from .chart import check_chart, text_chart
from .checklist import check_checklist, text_checklist
from .flip import check_flip, text_flip
from .flow import check_flow, text_flow
from .form import check_form, text_form
from .heatmap import check_heatmap, text_heatmap
from .images import check_images, text_images
from .include import check_include, text_include
from .kpis import check_kpis, check_stat, text_kpis, text_stat
from .layers import check_layers, text_layers
from .layout import check_container, check_tabs, text_container, text_tabs
from .list import check_list, text_list
from .prepared import check_prepared, text_prepared
from .progress import check_progress, text_progress
from .simulate import check_simulate, text_simulate
from .source import check_source, text_source
from .steps import check_steps, text_steps
from .streak import check_streak, text_streak
from .table import check_table, text_table
from .tiles import check_tiles, text_tiles
from .timeline import check_timeline, text_timeline
from .tracker import check_tracker, text_tracker

TYPES = {
    "chart": (check_chart, text_chart),
    "kpis": (check_kpis, text_kpis),
    "timeline": (check_timeline, text_timeline),
    "images": (check_images, text_images),
    "table": (check_table, text_table),
    "callout": (check_callout, text_callout),
    "source": (check_source, text_source),
    "list": (check_list, text_list),
    "progress": (check_progress, text_progress),
    "streak": (check_streak, text_streak),
    "heatmap": (check_heatmap, text_heatmap),
    "flip": (check_flip, text_flip),
    "actions": (check_actions, text_actions),
    "tiles": (check_tiles, text_tiles),
    "checklist": (check_checklist, text_checklist),
    "calendar": (check_calendar, text_calendar),
    "upnext": (check_upnext, text_upnext),
    "weather": (check_weather, text_weather),
    "calculator": (check_calculator, text_calculator),
    "simulate": (check_simulate, text_simulate),
    "form": (check_form, text_form),
    "flow": (check_flow, text_flow),
    "steps": (check_steps, text_steps),
    "layers": (check_layers, text_layers),
    "row": (check_container, text_container),
    "section": (check_container, text_container),
    "grid": (check_container, text_container),
    "columns": (check_container, text_container),
    "tabs": (check_tabs, text_tabs),
    "include": (check_include, text_include),
    "heading": (check_heading, text_heading),
    "text": (check_text, text_text),
    "stat": (check_stat, text_stat),
    "divider": (check_divider, text_divider),
    "badge": (check_badge, text_badge),
    "link": (check_link, text_link),
    "button": (check_button, text_button),
    "image": (check_image, text_image),
    "bar": (check_bar, text_bar),
}

# Blocks the Today page draws from the plugin's own data, never offered to the model (they aren't in the catalog): a
# reply that uses one is refused; check_blocks(page=True) accepts them.
PAGE_TYPES = {
    "briefing": (check_briefing, text_briefing),
    "tracker": (check_tracker, text_tracker),
    "prepared": (check_prepared, text_prepared),
}
