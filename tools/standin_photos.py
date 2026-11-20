"""A config-gated stand-in for image_generate, so the photo path can be tried without an image key.

Off by default: the tool is not registered at all until `photo_test_tool` is switched on in the plugin settings.
The three cases mirror what a real image tool returns: an https URL, a local path, and a dead https link.
"""

from __future__ import annotations

import json
from typing import Any

# A real image URL already shipped in the plugin's own catalogue, so the stand-in needs no network lookup.
EXAMPLE_URL = "https://upload.wikimedia.org/wikipedia/commons/1/16/KyotoFushimiInariLarge.jpg"
LOCAL_PATH = "C:/tmp/hermes-generated-image.png"
BROKEN_URL = "https://example.invalid/missing-image.png"

CASES = ("https", "local", "broken", "failed")


def standin_photos(params: dict | None = None, **kwargs: Any) -> str:
    """Hermes tool handler. `params` is the model's arguments, as Hermes calls every tool: `{"case": "https"}`.

    A bare string is still accepted so the handler can be called by hand, but the tool itself is always given a dict.
    """
    raw = params.get("case") if isinstance(params, dict) else params
    case = (raw or "https").strip().lower() if isinstance(raw, str) else "https"
    if case not in CASES:
        return json.dumps({"success": False, "error": f"case must be one of {', '.join(CASES)}"})
    if case == "failed":
        return json.dumps({"success": False, "image": None, "error": "Stand-in generation failed"})
    url = {"https": EXAMPLE_URL, "local": LOCAL_PATH, "broken": BROKEN_URL}[case]
    return json.dumps({"success": True, "image": url, "modality": "image"})


STANDIN_PHOTOS_SCHEMA = {
    "name": "standin_photos",
    "description": (
        "Testing only: stand in for an image tool and return an https image URL, a local path, a broken link or a "
        "failure. Available only when the plugin's photo_test_tool setting is on."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "case": {"type": "string", "enum": list(CASES), "description": "Which result shape to return."},
        },
    },
}
