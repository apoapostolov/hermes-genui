"""weather: a wide strip with the temperature, the sky and the place, and today's high and low."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
weather = importlib.import_module("hermes_genui.blocks.weather")


def test_a_weather_strip_needs_a_temperature_and_a_place():
    assert weather.check_weather({"type": "weather", "temp": 17, "place": "Pimpri Chinchwad"}, "0") == []
    assert weather.check_weather({"type": "weather", "place": "Pune"}, "0") == [
        ("0", "weather needs a temp (number) and a place")]
    assert weather.check_weather({"type": "weather", "temp": "hot", "place": "Pune"}, "0") != []


def test_the_checker_knows_the_weather_block():
    assert check_blocks([{"type": "weather", "temp": 17, "place": "Pune"}]) == []


def test_weather_as_text():
    block = {"type": "weather", "temp": 17, "place": "Pimpri Chinchwad", "condition": "Cloudy", "high": 30, "low": 16}
    assert weather.text_weather(block) == "**17°** Cloudy in Pimpri Chinchwad · High 30° · 16° tonight"
    assert weather.text_weather({"type": "weather", "temp": 17.4, "place": "Pune"}) == "**17°** Pune"
