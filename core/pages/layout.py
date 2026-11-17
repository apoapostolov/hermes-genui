"""A page as catalog blocks: its latest snapshot, drawn as the model designed it. A page saved by the slot version of
pages (before free design) asks to be redesigned; a page never filled asks for a refresh."""

NOT_FILLED = "Not filled yet. Press Refresh, or ask Hermes to refresh this page."
OLD_VERSION = "This page was made by an older version of the plugin; ask Hermes to redesign it."


def blocks_for(page: dict) -> list[dict]:
    snapshot = page.get("snapshot")
    if not isinstance(snapshot, dict):
        return [{"type": "callout", "tone": "info", "text": NOT_FILLED}]
    blocks = snapshot.get("blocks")
    if not isinstance(blocks, list):
        return [{"type": "callout", "tone": "info", "text": OLD_VERSION}]
    return [b for b in blocks if isinstance(b, dict)]
