"""weather: the weather now at a place, as one wide strip after Odie's Today: the temperature large, the sky and the
place ("Cloudy in Pimpri Chinchwad"), and today's high and tonight's low."""

from .common import has_text, is_number, safe_text


def check_weather(block: dict, path: str) -> list[tuple[str, str]]:
    """A temperature (a number) and a place; high and low, when given, are numbers.

    {"temp": "hot", "place": "Pune"} → [("0", "weather needs a temp (number) and a place")]
    """
    if not (is_number(block.get("temp")) and has_text(block.get("place"))):
        return [(path, "weather needs a temp (number) and a place")]
    return [(f"{path}.{key}", f"{key} must be a number") for key in ("high", "low")
            if key in block and block[key] is not None and not is_number(block[key])]


def _deg(value: object) -> str:
    return f"{round(value)}°"


def text_weather(block: dict) -> str:
    """"**17°** Cloudy in Pimpri Chinchwad · High 30° · 16° tonight"."""
    if not (is_number(block.get("temp")) and has_text(block.get("place"))):
        return ""
    place, sky = safe_text(block.get("place")), safe_text(block.get("condition"))
    parts = [f"**{_deg(block['temp'])}** " + (f"{sky} in {place}" if sky else place)]
    if is_number(block.get("high")):
        parts.append(f"High {_deg(block['high'])}")
    if is_number(block.get("low")):
        parts.append(f"{_deg(block['low'])} tonight")
    return " · ".join(parts)
