"""Briefs: the plugin's `templates/*.json`, each a short brief of what a kind of dashboard covers ("Security posture:
risk, exposure, detection, compliance"). The model designs the page itself; a brief only says what belongs on it.

A brief: {"name", "about", "cover": [3-6 short topics], "best_for"}.
"""

import json
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[2]


def check_brief(brief: object) -> list[str]:
    if not isinstance(brief, dict):
        return ["a brief is an object"]
    problems = [f"{key}: text" for key in ("name", "about", "best_for")
                if not (isinstance(brief.get(key), str) and brief[key].strip())]
    cover = brief.get("cover")
    if not (isinstance(cover, list) and 3 <= len(cover) <= 6
            and all(isinstance(c, str) and 0 < len(c) <= 80 for c in cover)):
        problems.append("cover: 3-6 short topics")
    return problems


def load_all() -> dict[str, dict]:
    """Every shipped brief, by file name: {"executive": {...}, ...}. A file that doesn't load is skipped."""
    found = {}
    for path in sorted((PLUGIN / "templates").glob("*.json")):
        try:
            found[path.stem] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
    return found
