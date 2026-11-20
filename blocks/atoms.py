"""The small pieces: heading, text, divider, badge, link, image and bar. (stat is with kpis, button with actions.)"""

from .common import (
    first_of,
    has_any_text,
    is_https,
    is_number,
    md_escape,
    md_link,
    needs_text,
    out_of,
    safe_text,
    safe_url,
)

# Where an image atom may carry its picture, in the order the drawing side looks: url, then src, then image.
IMAGE_URL_FIELDS = ("url", "src", "image")


# heading and text need text; the rest of their checking is the drawing side's.
check_heading = needs_text
check_text = needs_text


def check_divider(block: dict, path: str) -> list[tuple[str, str]]:
    return []


def check_badge(block: dict, path: str) -> list[tuple[str, str]]:
    if has_any_text(block, "text", "label"):
        return []
    return [(path, "badge needs text")]


def check_link(block: dict, path: str) -> list[tuple[str, str]]:
    if is_https(block.get("url")) or is_https(block.get("href")):
        return []
    return [(path, "link needs an https url")]


def check_image(block: dict, path: str) -> list[tuple[str, str]]:
    if any(is_https(block.get(k)) for k in IMAGE_URL_FIELDS):
        return []
    return [(path, "image needs an https url")]


def check_bar(block: dict, path: str) -> list[tuple[str, str]]:
    """A label and a value out of a max. A written null value is a figure nobody knows: kept, so the bar draws empty
    and reads "no data"; a bar with no value field at all is still refused.

    {"label": "Packed", "value": 6, "max": 9} → []
    {"label": "Spent", "value": None, "max": 500} → []
    {"label": "Spent", "max": 500} → [(path, "bar needs a label and a numeric value")]
    """
    value = block.get("value")
    if has_any_text(block, "label", "title") and (is_number(value) or ("value" in block and value is None)):
        return []
    return [(path, "bar needs a label and a numeric value")]


def text_heading(block: dict) -> str:
    text = safe_text(block.get("text"))
    return f"**{text}**" if text else ""


def text_text(block: dict) -> str:
    return safe_text(block.get("text"), inline=False)


def text_divider(block: dict) -> str:
    return "---"


def text_badge(block: dict) -> str:
    text = first_of(block, "text", "label")
    return f"[{text}]" if text else ""


def text_link(block: dict) -> str:
    text = first_of(block, "text", "label")
    url = safe_url(block.get("url") or block.get("href"), https_only=True)
    return md_link(text or md_escape(url), url)


def text_image(block: dict) -> str:
    """{"url": "https://a.org/k.jpg", "caption": "Kyoto"} → "![Kyoto](https://a.org/k.jpg)"; a bad URL keeps only the
    caption."""
    url = next((u for u in (safe_url(block.get(k)) for k in ("url", "src", "image")) if u), "")
    caption = first_of(block, "caption", "alt", "title")
    if not url:
        return caption
    return f"![{caption or 'image'}]({url})"


def text_bar(block: dict) -> str:
    goal = block.get("max", 100)
    return out_of(first_of(block, "label", "title"), block.get("value"), goal, block.get("unit"))
