"""Putting a dashboard together: each section's source makes its blocks; a source with nothing to show becomes a small
note, one that fails becomes a warning, and the rest still draws. No model is involved.

    assemble({"title": "Today", "sections": [{"from": "calendar.today"}, {"from": "assistant.summary"}]}, ctx)
    → {"title": "Today", "blocks": [{"type": "calendar", …}, {"type": "kpis", …}], "live": False}
"""

import importlib.util
import sys
from collections.abc import Callable
from pathlib import Path

MAX_BLOCKS = 40


def _sources():
    key = "hermes_genui_dashboard_sources"
    if key not in sys.modules:
        spec = importlib.util.spec_from_file_location(key, Path(__file__).resolve().parent / "sources.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules[key] = module
        spec.loader.exec_module(module)
    return sys.modules[key]


def section_blocks(section: dict, ctx, check: Callable[[list], list] | None = None) -> list[dict]:
    """One section's blocks; a note in place of nothing, a warning in place of a failure or of invalid blocks."""
    sources = _sources()
    source = sources.source_for(section.get("from", ""))
    if source is None:
        return [{"type": "callout", "tone": "warn", "text": f"There's no source called {section.get('from')!r}."}]
    try:
        blocks = source.make(section, ctx)
    except sources.NotReady as note:
        return [{"type": "callout", "tone": "info", "text": str(note)}]
    except Exception:  # noqa: BLE001 - one source failing must not take the page down
        return [{"type": "callout", "tone": "warn", "text": f"Couldn't load {source.label} just now."}]
    if not blocks:
        return [{"type": "callout", "tone": "info", "text": f"Nothing in {source.label} right now."}]
    if check and check(blocks):
        return [{"type": "callout", "tone": "warn", "text": f"Couldn't load {source.label} just now."}]
    title = section.get("title")
    return ([{"type": "heading", "text": str(title)[:80]}] if title else []) + blocks


def _badge(sections: list, ctx) -> dict:
    """{"badge": n} for a tab whose sections show n open items between them (one in two sections counts once)."""
    ids: set[str] = set()
    for section in sections if isinstance(sections, list) else []:
        source = _sources().source_for(section.get("from", "")) if isinstance(section, dict) else None
        if source is None or source.open_ids is None:
            continue
        try:
            ids |= source.open_ids(ctx)
        except Exception:  # noqa: BLE001 - not set up yet, or failing: the section says so; the tab just has no badge
            continue
    return {"badge": min(len(ids), 999)} if ids else {}


def _sections(sections: list, ctx, check) -> list[dict]:
    out = []
    for section in sections:
        if not isinstance(section, dict):
            continue
        if "tabs" in section:
            tabs = [{"label": str(tab.get("label", ""))[:30],
                     "children": _sections(tab.get("sections", []), ctx, check),
                     **_badge(tab.get("sections", []), ctx)}
                    for tab in section.get("tabs", []) if isinstance(tab, dict)]
            out.append({"type": "tabs", "tabs": tabs})
        else:
            out += section_blocks(section, ctx, check)
    return out


def _is_live(sections: list) -> bool:
    prefixes = _sources().LIVE_PREFIXES
    for section in sections:
        if not isinstance(section, dict):
            continue
        if "tabs" in section and _is_live([s for tab in section["tabs"] for s in tab.get("sections", [])]):
            return True
        if str(section.get("from", "")).startswith(prefixes):
            return True
    return False


def greeting(spec: dict, now) -> str | None:
    """"Good morning, Sam." by the hour (before 12, before 17, after), when the spec asks for one; None otherwise."""
    if not spec.get("greeting"):
        return None
    part = "morning" if now.hour < 12 else "afternoon" if now.hour < 17 else "evening"
    name = spec.get("name")
    return f"Good {part}, {name.strip()}." if isinstance(name, str) and name.strip() else f"Good {part}."


def assemble(spec: dict, ctx, check: Callable[[list], list] | None = None) -> dict:
    """The whole board for a spec: {"title", "greeting", "blocks", "live"} (live: some section refreshes every few
    seconds)."""
    sections = spec.get("sections", []) if isinstance(spec, dict) else []
    board = {"title": spec.get("title") or "Today", "greeting": greeting(spec, ctx.now),
             "blocks": _sections(sections, ctx, check)[:MAX_BLOCKS], "live": _is_live(sections)}
    for block in board["blocks"]:
        if block.get("type") == "briefing":  # the band carries the page's greeting
            block["greeting"] = board["greeting"] or board["title"]
    if _uses_today_page(sections):
        board["snapshots"] = _sources().today_status(ctx)
    return board


def _uses_today_page(sections: list) -> bool:
    for section in sections:
        if not isinstance(section, dict):
            continue
        inner = [s for tab in section.get("tabs", []) if isinstance(tab, dict) for s in tab.get("sections", [])]
        if str(section.get("from", "")).startswith(_sources().TODAY_PAGE) or _uses_today_page(inner):
            return True
    return False
