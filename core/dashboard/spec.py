"""The dashboard spec: what a skill writes once. {"title": "Today", "sections": [section, …]}; a section is
{"from": "<source>", "as": "<view>"?, "title"?, "show"?} or {"tabs": [{"label", "sections": [...]}]} (2-6 tabs, no
tabs inside tabs). Stored per profile as <plugin store>/dashboard.json.
"""

import importlib.util
import json
import sys
from pathlib import Path

MAX_SECTIONS = 20
SYSTEM_PARTS = ("cpu", "ram", "disk", "gpu")


def _sibling(name: str):
    key = f"hermes_genui_dashboard_{name}"
    if key not in sys.modules:
        spec = importlib.util.spec_from_file_location(key, Path(__file__).resolve().parent / f"{name}.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules[key] = module
        spec.loader.exec_module(module)
    return sys.modules[key]


def _file(root: Path) -> Path:
    return root.parent / "dashboard.json"


def load_spec(root: Path) -> dict | None:
    try:
        data = json.loads(_file(root).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) and isinstance(data.get("sections"), list) else None


def save_spec(spec: dict, root: Path) -> None:
    path = _file(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(spec, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def clear_spec(root: Path) -> None:
    _file(root).unlink(missing_ok=True)


def _check_sections(sections: object, where: str, in_tabs: bool) -> list[str]:
    sources = _sibling("sources")
    if not isinstance(sections, list) or not 1 <= len(sections) <= MAX_SECTIONS:
        return [f"{where}: 1-{MAX_SECTIONS} sections"]
    problems = []
    for i, section in enumerate(sections):
        at = f"{where}.{i}"
        if not isinstance(section, dict):
            problems.append(f"{at}: must be an object")
        elif "tabs" in section:
            tabs = section["tabs"]
            if in_tabs:
                problems.append(f"{at}: no tabs inside tabs")
            elif not isinstance(tabs, list) or not 2 <= len(tabs) <= 6:
                problems.append(f"{at}: tabs need 2-6 tabs")
            else:
                for t, tab in enumerate(tabs):
                    if not (isinstance(tab, dict) and isinstance(tab.get("label"), str) and tab["label"].strip()):
                        problems.append(f"{at}.tabs.{t}: tab needs a label")
                    else:
                        problems += _check_sections(tab.get("sections"), f"{at}.tabs.{t}.sections", True)
        else:
            name = section.get("from")
            views = sources.views_for(name) if isinstance(name, str) else ()
            if not views:
                problems.append(f"{at}: unknown source {name!r}; sources: {', '.join(sources.catalogue())}")
            elif section.get("as") is not None and section["as"] not in views:
                problems.append(f"{at}: {name} shows as {' or '.join(views)}")
            elif "show" in section and not (isinstance(section["show"], list) and section["show"]
                                            and all(p in SYSTEM_PARTS for p in section["show"])):
                problems.append(f"{at}: show is any of {', '.join(SYSTEM_PARTS)}")
    return problems


def check_spec(spec: object) -> list[str]:
    """What's wrong with a spec, or [] when it can be saved."""
    if not isinstance(spec, dict):
        return ['the spec must be {"title": "…", "sections": [...]}']
    problems = []
    if spec.get("title") is not None and not (isinstance(spec["title"], str) and len(spec["title"]) <= 60):
        problems.append("title: plain text up to 60 characters")
    if "greeting" in spec and not isinstance(spec["greeting"], bool):
        problems.append("greeting: true or false")
    if spec.get("name") is not None and not (isinstance(spec["name"], str) and len(spec["name"]) <= 40):
        problems.append("name: plain text up to 40 characters")
    return problems + _check_sections(spec.get("sections"), "sections", False)
