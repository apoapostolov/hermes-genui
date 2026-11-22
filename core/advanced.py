"""The Advanced rendering setting and the per-model capability gate (#64).

The setting has three values: `off` hides the widget block from the model, `auto` checks one widget sample per model
before a widget is stored and falls back to text when that model keeps missing the contract, and `on` draws without
the gate. The gate is local and deterministic: it runs the same checker as show_blocks, stores nothing but a model id,
its last pass or fail and a count, and never calls a model or the network.

A cached failure is a decision, not a score: after a failed sample, every later widget from that model is refused
until the user turns Advanced rendering off or on, or a later check_render_capability call passes.
"""

import json
from pathlib import Path

from .check import check_blocks, child_lists

__all__ = ["CAPABILITY_FAIL_TAIL", "GATE_FALLBACK", "GATE_FALLBACK_PLAIN", "MODES", "OFF_REFUSAL", "SWITCH_OFF",
           "SWITCH_OFF_PLAIN", "check_widgets", "configure", "default_root", "filter_menu", "gate_failure", "mode",
           "model_id", "record", "status", "widgets"]

# The setting is read through Hermes's ctx.get_config, like the assistant's local_only. Outside Hermes nothing is set,
# and the default is what the plugin uses.
SETTING = "advanced_rendering"
MODES = ("off", "auto", "on")
DEFAULT_MODE = "auto"

SWITCH_OFF = ("Advanced rendering stays off for this model. Turn it on in Settings → Rendering only if you want to "
              "retry.")
# A tool result can reach a terminal or a chat app that shows the arrow badly: the same words without it.
SWITCH_OFF_PLAIN = ("Advanced rendering stays off for this model. Turn it on in Settings > Rendering only if you want "
                    "to retry.")
GATE_FALLBACK = ("Not drawn. This model did not produce a valid advanced block. Turn off advanced rendering in "
                 "Settings → Rendering, or fix the fields named above.")
GATE_FALLBACK_PLAIN = ("Not drawn. This model did not produce a valid advanced block. Turn off advanced rendering in "
                       "Settings > Rendering, or fix the fields named above.")
OFF_REFUSAL = "Not drawn. " + SWITCH_OFF_PLAIN
CAPABILITY_FAIL_TAIL = ("No block was drawn. Turn off advanced rendering in Settings > Rendering if this model keeps "
                        "missing the contract.")

_CONFIG = [lambda key, default=None: default]
# Where a profile keeps the gate, beside its boards under the Hermes home (the store's pattern, without its blocks/).
GATE_DIR = Path("plugin-data") / "hermes-genui"
GATE_FILE = "render-capability.json"
GATE_VERSION = 1
# The cache is small on purpose: a few model ids, not a history. The oldest entries go first when it is full.
MAX_MODELS = 64


def configure(get_config) -> None:
    """Read plugin settings with this (Hermes's ctx.get_config: plugins.entries.hermes-genui.settings.<key>)."""
    _CONFIG[0] = get_config


def mode() -> str:
    """This profile's Advanced rendering value: off, auto or on. An unknown or unreadable value means auto.

    Nothing stored → "auto";  " OFF " → "off";  "sometimes" → "auto"
    """
    try:
        raw = _CONFIG[0](SETTING, DEFAULT_MODE)
    except Exception:  # noqa: BLE001 - a broken reader must not stop a board from drawing
        return DEFAULT_MODE
    value = str(raw if raw is not None else "").strip().lower()
    return value if value in MODES else DEFAULT_MODE


def filter_menu(text: str) -> str:
    """The menu description without its widget line, since `off` offers no widget to the model.

    "Draw.\\n- widget: a card\\n- chart: a trend" → "Draw.\\n- chart: a trend"
    """
    kept: list[str] = []
    removed = False
    for line in text.splitlines():
        if not removed and line.startswith("- widget:"):
            removed = True
            continue
        kept.append(line)
    return "\n".join(kept)


def default_root() -> Path:
    """Where this profile keeps the gate: <hermes home>/plugin-data/hermes-genui."""
    from hermes_constants import get_hermes_home  # only importable inside Hermes

    return get_hermes_home() / GATE_DIR


def _key(model: object) -> str:
    """The model id the gate stores: its exact id, or "unknown" when the tool was given none."""
    text = str(model).strip() if model is not None else ""
    return text or "unknown"


def model_id(**kwargs) -> str:
    """The model that called a tool: the call's `model`, else its session's, else "unknown".

    model="qwen25" → "qwen25";  session={"model": "gpt-5"} → "gpt-5";  nothing → "unknown"
    """
    raw = kwargs.get("model")
    if not raw:
        session = kwargs.get("session")
        raw = session.get("model") if isinstance(session, dict) else None
    return _key(raw)


def _read(root: Path | None = None) -> dict:
    """The gate file's contents, or {} when it is missing, damaged or of an unknown shape."""
    path = (root or default_root()) / GATE_FILE
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return {}
    if not isinstance(data, dict) or not isinstance(data.get("models"), dict):
        return {}
    return data


def _write_whole(path: Path, text: str) -> None:
    """Write a file so a reader sees the old one or the new one, never half of it (store._write_whole's pattern)."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def status(model: str) -> str | None:
    """The cached gate answer for this model: "passed", "failed", or None when it has not been checked.

    status("new-model") with no gate file → None;  after record("new-model", False) → "failed"
    """
    entry = _read().get("models", {}).get(_key(model))
    if not isinstance(entry, dict):
        return None
    answer = entry.get("status")
    return answer if answer in ("passed", "failed") else None


def record(model: str, passed: bool) -> None:
    """Remember this model's latest gate result and add one to its count. A cache write failure is ignored: the gate
    must never stop a board from being drawn."""
    key = _key(model)
    data = _read()
    models = data.get("models")
    models = models if isinstance(models, dict) else {}
    previous = models.get(key)
    checks = previous.get("checks", 0) if isinstance(previous, dict) else 0
    models[key] = {"status": "passed" if passed else "failed", "checks": checks + 1 if isinstance(checks, int) else 1}
    while len(models) > MAX_MODELS:
        models.pop(next(iter(models)))
    try:
        root = default_root()
        root.mkdir(parents=True, exist_ok=True)
        _write_whole(root / GATE_FILE, json.dumps({"version": GATE_VERSION, "models": models}, ensure_ascii=False))
    except OSError:
        return


def widgets(blocks: list, path: str = "") -> list[tuple[str, dict]]:
    """Every widget block in a board, top level or inside a container or a tab, with its path in the board.

    [text, widget] → [("1", widget)]
    [tabs] holding a row holding a widget → [("0.tabs.0.children.0.children.0", widget)]
    """
    found: list[tuple[str, dict]] = []
    for i, block in enumerate(blocks):
        if not isinstance(block, dict):
            continue
        here = f"{path}{i}"
        if block.get("type") == "widget":
            found.append((here, block))
        for where, children in child_lists(block):
            found += widgets(children, f"{here}.{where}.")
    return found


def check_widgets(found: list[tuple[str, dict]]) -> list[str]:
    """The checker's problems for these widgets, each path rewritten to its place in the board.

    [("1", broken_widget)] → ['1.view.0: element needs an id like "heading"']
    """
    problems: list[str] = []
    for path, block in found:
        for problem in check_blocks([block]):
            problems.append(f"{path}{problem[1:]}" if problem.startswith("0") else f"{path}: {problem}")
    return problems


def gate_failure(problems: list[str]) -> str:
    """The refusal for a widget that failed the auto gate: what is wrong, then how to stop seeing it."""
    return ("Not drawn. The widget check failed for this model:\n"
            + "\n".join(f"- {problem}" for problem in problems)
            + "\n\n" + GATE_FALLBACK_PLAIN)
