"""A board drawn this turn whose tag never reached the reply gets the tag added (#42 evals: Qwen and Gemma sometimes
drew a board and then replied without its tag, so the user saw nothing)."""

import importlib

import pytest

from conftest import load_plugin_package

load_plugin_package()
show_blocks = importlib.import_module("hermes_genui.tools.show_blocks")
text_fallback = importlib.import_module("hermes_genui.hooks.text_fallback")
visual_nudge = importlib.import_module("hermes_genui.hooks.visual_nudge")
plugin_store = importlib.import_module("hermes_genui.core.store")

TEXT = {"type": "text", "text": "hi"}


@pytest.fixture(autouse=True)
def store_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin_store, "default_root", lambda: tmp_path)
    return tmp_path


def draw(session: str) -> str:
    result = show_blocks.show_blocks({"blocks": [TEXT]}, session_id=session)
    return result.strip().splitlines()[-1]


def test_a_reply_without_the_tag_gets_it_added():
    tag = draw("s1")
    out = text_fallback.text_only(response_text="Here is your plan.", platform="local", session_id="s1")
    assert out == f"Here is your plan.\n\n{tag}"


def test_a_reply_with_the_tag_is_left_alone():
    tag = draw("s2")
    assert text_fallback.text_only(response_text=f"Plan:\n{tag}", platform="local", session_id="s2") is None


def test_only_the_last_board_is_added_and_none_if_any_tag_was_pasted():
    first, last = draw("s3"), draw("s3")
    assert text_fallback.text_only(response_text="Done.", platform="local", session_id="s3") == f"Done.\n\n{last}"
    first, last = draw("s4"), draw("s4")
    assert text_fallback.text_only(response_text=f"See:\n{first}", platform="local", session_id="s4") is None


def test_each_board_is_added_once_and_a_new_message_starts_afresh():
    draw("s5")
    text_fallback.text_only(response_text="One.", platform="local", session_id="s5")
    assert text_fallback.text_only(response_text="Two.", platform="local", session_id="s5") is None
    draw("s6")
    visual_nudge.visual_nudge(user_message="next question", platform="local", session_id="s6")
    assert text_fallback.text_only(response_text="Answer.", platform="local", session_id="s6") is None


def test_other_sessions_are_not_touched():
    draw("s7")
    assert text_fallback.text_only(response_text="Hello.", platform="local", session_id="other") is None
