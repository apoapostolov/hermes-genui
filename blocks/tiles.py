"""tiles: 2-8 cover cards, optionally interactive via ask or run."""

from .common import NO_SEND, acts_before_the_model, has_text, safe_text


def check_tiles(block: dict, path: str) -> list[tuple[str, str]]:
    """2-8 cards, each with a title and something a tap does (ask fills the composer, run sends).

    items = [{"title": "Kyoto", "ask": "Plan Kyoto"}, {"title": "Nara"}] → [("0.items.1", "tile needs ...")]
    items[1] = {"title": "Nara", "ask": "/reset"} → [("0.items.1", NO_SEND)] (ask fills the composer, but the user
    may send it as it is)
    """
    items = block.get("items")
    if not isinstance(items, list) or not 2 <= len(items) <= 8:
        return [(path, "tiles needs 2-8 items")]
    problems = []
    for i, it in enumerate(items):
        if not (isinstance(it, dict) and has_text(it.get("title"))):
            problems.append((f"{path}.items.{i}", "tile needs a title"))
        elif acts_before_the_model(it.get("ask")) or acts_before_the_model(it.get("run")):
            problems.append((f"{path}.items.{i}", NO_SEND))
    return problems


def text_tiles(block: dict) -> str:
    """"- Arashiyama: Bamboo" per card; a card without a subtitle is just its title."""
    items = block.get("items") if isinstance(block.get("items"), list) else []
    lines = []
    for item in items[:8]:
        title = safe_text(item.get("title")) if isinstance(item, dict) else ""
        subtitle = safe_text(item.get("subtitle")) if title else ""
        if title:
            lines.append(f"- {title}: {subtitle}" if subtitle else f"- {title}")
    return "\n".join(lines)
