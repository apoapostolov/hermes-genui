"""Page records, one JSON file per page in the profile's plugin store: <store>/../pages/<slug>.json.

A page: {"slug", "title", "kind": "dashboard" | "today", "template", "servers", "notes", "layout": [slot],
"job_id", "snapshot": {"at", "slots": {slot id: [blocks]}} | None, "previous": snapshot | None,
"refresh": {"requested_at", "error"}}.
"""

import json
import re
from pathlib import Path

SLUG = re.compile(r"^[a-z0-9-]{1,40}$")
TODAY = "today"  # the slug of Today's work sections; no dashboard may take it


def slug_for(title: str) -> str:
    """A short, safe id from a title: "Sales / APAC" → "sales-apac"; nothing usable → "page"."""
    slug = re.sub(r"[^a-z0-9]+", "-", str(title).lower()).strip("-")[:40].strip("-")
    return slug or "page"


def _dir(root: Path) -> Path:
    return root.parent / "pages"


def _file(slug: str, root: Path) -> Path | None:
    return _dir(root) / f"{slug}.json" if isinstance(slug, str) and SLUG.match(slug) else None


def load(slug: str, root: Path) -> dict | None:
    path = _file(slug, root)
    if path is None:
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) and data.get("slug") == slug else None


def save(page: dict, root: Path) -> None:
    path = _file(page["slug"], root)
    if path is None:
        raise ValueError(f"not a page slug: {page['slug']!r}")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(page, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def list_pages(root: Path) -> list[dict]:
    """Every page's slug, title and kind, by title."""
    found = []
    for path in sorted(_dir(root).glob("*.json")) if _dir(root).is_dir() else []:
        page = load(path.stem, root)
        if page:
            found.append({"slug": page["slug"], "title": page.get("title") or page["slug"],
                          "kind": page.get("kind") or "dashboard"})
    return sorted(found, key=lambda p: (p["title"].lower(), p["slug"]))


def remove(slug: str, root: Path) -> bool:
    path = _file(slug, root)
    if path is None or not path.is_file():
        return False
    path.unlink()
    return True
