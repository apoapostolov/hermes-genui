"""dashboard: the Today dashboard's spec. A dashboard is an assembly of the plugin's own blocks: the spec lists
sections, each naming a source (calendar.today, assistant.bills, weather.Seattle, stock.NVDA …) and how to show it.
This tool only saves the spec; the plugin puts the board together from live data whenever Today is opened.
"""

import json
from pathlib import Path

import httpx

from ..core.dashboard import spec as specs
from ..core.live import resolve

EXAMPLE = {"title": "Today", "sections": [
    {"from": "calendar.today"}, {"from": "calendar.upnext"}, {"from": "assistant.summary"},
    {"tabs": [{"label": "Needs you", "sections": [{"from": "assistant.open", "as": "checklist"},
                                                  {"from": "assistant.suggestions"}]},
              {"label": "Bills", "sections": [{"from": "assistant.bills", "as": "table"}]}]},
    {"from": "stock.NVDA", "as": "chart", "title": "Markets"}]}


def _root(root: Path | None) -> Path:
    from ..core import store
    return root or store.default_root()


def _resolve(sections: list, client: httpx.Client) -> str | None:
    """Look up each weather city and stock once, storing what the sources need; a sentence when one isn't found."""
    for section in sections:
        if "tabs" in section:
            for tab in section["tabs"]:
                problem = _resolve(tab["sections"], client)
                if problem:
                    return problem
            continue
        name = section["from"]
        if name.startswith(("weather.", "today.briefing.")):
            city = name.removeprefix("today.briefing.").removeprefix("weather.")
            try:
                place = resolve.place(city, client)
            except resolve.Unavailable:
                return f"couldn't reach the place lookup for '{city}' just now; try again in a minute"
            if not place:
                return f"couldn't find a place called '{city}'"
            section["place"] = place
        elif name.startswith("stock."):
            asked = name.split(".", 1)[1]
            try:
                found = resolve.stock(asked, client)
            except resolve.Unavailable:
                return f"couldn't reach the stock lookup for '{asked}' just now; try again in a minute"
            if not found:
                return f"couldn't find a stock called '{asked}'"
            section["from"] = f"stock.{found['symbol']}"
            section["stock"] = found
    return None


def apply(params: dict, root: Path | None = None, client: httpx.Client | None = None) -> str:
    root = _root(root)
    action = params.get("action")
    if action == "show":
        current = specs.load_spec(root)
        sources = specs._sibling("sources").catalogue()
        return ((f"Current dashboard: {json.dumps(current, ensure_ascii=False)}" if current else "No dashboard yet.")
                + "\nSources (views): " + "; ".join(sources)
                + "\nExample: " + json.dumps(EXAMPLE, ensure_ascii=False))
    if action == "clear":
        specs.clear_spec(root)
        return "Cleared the Today dashboard."
    if action != "set":
        return 'action must be "show", "set" or "clear".'
    spec = params.get("spec")
    problems = specs.check_spec(spec)
    if problems:
        return "Not saved. Fix these and call dashboard again:\n" + "\n".join(f"- {p}" for p in problems)
    spec = json.loads(json.dumps(spec))  # a copy we can fill in
    with (httpx.Client(timeout=10) if client is None else _Borrowed(client)) as http:
        problem = _resolve(spec["sections"], http)
    if problem:
        return f"Not saved: {problem}."
    specs.save_spec(spec, root)
    reply = (f"Saved the Today dashboard: {len(spec['sections'])} sections. It's on the Today page in Hermes Desktop's "
             "sidebar and keeps itself up to date.")
    if _uses_mail(spec["sections"]) and len(root.parents) > 2:
        from . import assistant
        note = assistant.restore_note(root.parents[2])  # <home>/plugin-data/hermes-genui/blocks
        reply += f"\n{note}" if note else ""
    return reply


def _uses_mail(sections: list) -> bool:
    """Whether a spec shows anything the assistant's mail check keeps up to date."""
    for section in sections:
        if "tabs" in section:
            if any(_uses_mail(tab.get("sections", [])) for tab in section["tabs"]):
                return True
        elif str(section.get("from", "")).startswith(("assistant.", "calendar.")):
            return True
    return False


class _Borrowed:
    def __init__(self, client):
        self.client = client

    def __enter__(self):
        return self.client

    def __exit__(self, *exc):
        return None


def dashboard(params: dict, **kwargs) -> str:
    return apply(params or {})


DASHBOARD_SCHEMA = {
    "name": "dashboard",
    "description": (
        "The Today dashboard in Hermes Desktop's sidebar: an assembly of this plugin's blocks that keeps itself up "
        "to date, no redrawing. action \"show\": the current spec, every source with its views, and an example. "
        "\"set\": save a spec {\"title\", \"sections\": [{\"from\": source, \"as\": view, \"title\"} or {\"tabs\": "
        "[{\"label\", \"sections\": [...]}]}]}; it replaces the old one, so show first when editing. \"clear\" removes "
        "it. Sources include calendar.today, calendar.upnext, assistant.summary/open/suggestions/bills/orders/replies/"
        "done, system, weather.<City>, stock.<SYMBOL>, tasks."),
    "parameters": {"type": "object", "properties": {
        "action": {"type": "string", "enum": ["show", "set", "clear"]},
        "spec": {"type": "object", "description": "For set: {\"title\", \"sections\": [...]}"}},
        "required": ["action"]},
}
