"""check_render_capability: a local trial of whether this model can write a widget the checker accepts (#64).

The tool runs the same checker as show_blocks on a small sample, records the answer for the calling model and returns
text. It draws nothing, stores no board, returns no `::blocks` tag and changes no chat state.
"""

from ..core import advanced
from ..core.check import check_blocks
from .show_blocks import _as_list

__all__ = ["CHECK_RENDER_CAPABILITY_SCHEMA", "PASS_TEXT", "check_render_capability"]

PASS_TEXT = "Gate passed for this sample. Advanced rendering stays on Auto."
NO_SAMPLE = "blocks: give a small sample that includes one widget block"
NO_WIDGET = "blocks: the sample needs one widget block"


def _failure(problems: list[str]) -> str:
    """The short refusal: what is wrong, then what the person can do about it."""
    return "Gate failed: " + "; ".join(problems).rstrip(".") + ". " + advanced.CAPABILITY_FAIL_TAIL


def check_render_capability(params: dict, **kwargs) -> str:
    """Check one sample for the calling model and record pass or fail. A sample with no widget is refused without
    recording, since it says nothing about whether this model can write one.

    a valid widget → PASS_TEXT and a passed gate;  a widget with no element id → _failure([...]) and a failed gate
    """
    params = params if isinstance(params, dict) else {}
    blocks = _as_list(params.get("blocks"))
    if blocks is None:
        return _failure(["blocks: not valid JSON"])
    if not blocks:
        return _failure([NO_SAMPLE])
    if not advanced.widgets(blocks):
        return _failure([NO_WIDGET])
    problems = check_blocks(blocks)
    advanced.record(advanced.model_id(**kwargs), not problems)
    return _failure(problems) if problems else PASS_TEXT


CHECK_RENDER_CAPABILITY_SCHEMA = {
    "name": "check_render_capability",
    "description": "Trial this model's advanced rendering locally: send one small widget sample and get the checker's "
                   "answer as text. The same check runs before a widget is drawn. It stores no board and draws "
                   "nothing.",
    "parameters": {
        "type": "object",
        "properties": {
            "blocks": {
                "type": "array",
                "items": {"type": "object"},
                "description": "A small sample board containing one widget block, written as show_blocks takes it.",
            },
        },
        "required": ["blocks"],
    },
}
