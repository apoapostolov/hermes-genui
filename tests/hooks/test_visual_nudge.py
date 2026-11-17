import importlib

from conftest import load_plugin_package

load_plugin_package()
nudge = importlib.import_module("hermes_genui.hooks.visual_nudge")


def test_visual_asks_get_the_reminder_in_the_desktop_app():
    for ask in ["Create an interesting dashboard of my profiles, rich and interactive",
                "show the analysis visually", "compare Alphabet and Microsoft", "plan 3 days in Lisbon",
                "chart my spending", "how's the market?"]:
        context = nudge.visual_nudge(user_message=ask, platform="local")
        assert context and "show_blocks" in context and "::preview" in context, ask


def test_plain_questions_get_nothing():
    assert nudge.visual_nudge(user_message="what's the capital of Peru?", platform="local") is None


def test_other_surfaces_get_nothing():
    assert nudge.visual_nudge(user_message="make a dashboard", platform="telegram") is None
    assert nudge.visual_nudge(user_message="make a dashboard", platform="cli") is None


def test_multimodal_messages_are_read_from_their_text_parts():
    parts = [{"type": "text", "text": "turn this into a dashboard"}, {"type": "image_url", "image_url": {"url": "x"}}]
    assert nudge.visual_nudge(user_message=parts, platform="local")


def test_things_to_keep_on_screen_get_the_keep_reminder():
    for ask in ["put NVDA and Pune weather on my Today page", "always show my CPU and RAM",
                "keep an eye on my scheduled tasks on the Today page", "pin it to my sidebar",
                "put NVDA in my ticker", "pin Tokyo time to the status bar"]:
        assert nudge.visual_nudge(ask, "local") == nudge.KEEP_REMINDER, ask
    # Today page: the today-page recipe. A dashboard kept as a sidebar page: board_page. No ticker to send anyone to.
    assert "today-page recipe" in nudge.KEEP_REMINDER and "board_page keep" in nudge.KEEP_REMINDER
    assert "live_board" not in nudge.KEEP_REMINDER and "no status-bar ticker" in nudge.KEEP_REMINDER


def test_one_off_dashboards_and_prices_still_get_the_block_reminder():
    for ask in ["an NVDA dashboard", "how's the market?"]:
        assert nudge.visual_nudge(ask, "local") == nudge.REMINDER, ask
    assert nudge.visual_nudge("live NVDA price", "local") != nudge.KEEP_REMINDER  # "live" alone isn't a place


def test_asks_to_keep_something_on_screen_get_nothing_off_desktop():
    assert nudge.visual_nudge("put NVDA on my Today page", "telegram") is None


def test_ordinary_uses_of_ticker_sidebar_and_pin_are_not_asks_to_keep_something():
    for ask in ["Compare AAPL and MSFT, ticker symbols included", "what's the ticker for Reliance",
                "add a sidebar to this layout", "my SIM pin isn't working"]:
        assert nudge.visual_nudge(ask, "local") != nudge.KEEP_REMINDER, ask
    assert nudge.visual_nudge("Compare AAPL and MSFT, ticker symbols included", "local") == nudge.REMINDER


def test_personal_dashboard_asks_get_the_assistant_reminder():
    for ask in ["create my personal dashboard", "be my assistant", "watch my mail and calendar",
                "set up a personal assistant"]:
        assert nudge.visual_nudge(ask, "local") == nudge.ASSISTANT_REMINDER, ask
    assert "personal-assistant" in nudge.ASSISTANT_REMINDER
    assert nudge.visual_nudge("create my personal dashboard", "telegram") is None
