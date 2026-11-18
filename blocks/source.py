"""source: one small line saying where the data came from."""

from .common import md_link, needs_text, safe_text, safe_url

def check_source(block: dict, path: str) -> list[tuple[str, str]]:
    if isinstance(block.get("items"), list) and block["items"]:
        return []
    return needs_text(block, path)


def text_source(block: dict) -> str:
    items = block.get("items")
    if isinstance(items, list) and items:
        lines = []
        for item in items[:32]:
            if not isinstance(item, dict):
                continue
            label = safe_text(item.get("label") or item.get("name"), 80)
            if not label:
                continue
            url = safe_url(item.get("url"))
            line = md_link(label, url) if url else label
            kind = safe_text(item.get("kind"), 12)
            if kind in {"web", "file", "tool", "derived"}:
                line += f" [{kind}]"
            accessed = safe_text(item.get("accessed") or item.get("accessed_at"), 32)[:10]
            if accessed[:4].isdigit():
                line += f" · accessed {accessed}"
            note = safe_text(item.get("note"), 160)
            if note:
                line += f" · {note}"
            lines.append(line)
        title = safe_text(block.get("title"), 80)
        prefix = f"**{title}**\n" if title else ""
        return f"{prefix}_Sources: {' · '.join(lines)}_" if lines else ""
    text = safe_text(block.get("text"))
    return f"_Source: {md_link(text, safe_url(block.get('url')))}_" if text else ""
