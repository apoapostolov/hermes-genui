import importlib

import httpx

from conftest import load_plugin_package

load_plugin_package()
dashboard = importlib.import_module("hermes_genui.tools.dashboard")
spec = importlib.import_module("hermes_genui.core.dashboard.spec")
tools = importlib.import_module("hermes_genui.tools")

SEATTLE = {"results": [{"name": "Seattle", "latitude": 47.6062, "longitude": -122.3321,
                         "timezone": "America/Los_Angeles"}]}


def client(handler=None):
    def default(request):
        if request.url.host == "geocoding-api.open-meteo.com":
            return httpx.Response(200, json=SEATTLE if request.url.params["name"] == "Seattle" else {})
        if request.url.path.endswith("/search"):
            return httpx.Response(200, json={"quotes": [{"symbol": "NVDA"}]})
        return httpx.Response(200, json={"chart": {"result": [{
            "meta": {"symbol": "NVDA", "shortName": "NVIDIA Corporation", "currency": "USD",
                     "exchangeTimezoneName": "America/New_York"},
            "timestamp": [1_762_000_000 + i * 86400 for i in range(3)],
            "indicators": {"quote": [{"close": [180.0, 181.0, 182.4]}]}}]}})
    return httpx.Client(transport=httpx.MockTransport(handler or default))


def apply(params, tmp_path, c=None):
    return dashboard.apply(params, root=tmp_path / "blocks", client=c or client())


def test_set_saves_a_spec_and_resolves_cities_and_stocks(tmp_path):
    reply = apply({"action": "set", "spec": {"title": "Today", "sections": [
        {"from": "calendar.today"}, {"from": "weather.Seattle"}, {"from": "stock.nvidia", "as": "chart"}]}}, tmp_path)
    assert reply.startswith("Saved the Today dashboard: 3 sections.")
    saved = spec.load_spec(tmp_path / "blocks")
    assert saved["sections"][1]["place"] == {"city": "Seattle", "lat": 47.61, "lon": -122.33,
                                             "tz": "America/Los_Angeles"}
    assert saved["sections"][2]["from"] == "stock.NVDA"
    assert saved["sections"][2]["stock"]["name"] == "NVIDIA Corporation"


def test_a_bad_spec_or_an_unknown_city_saves_nothing(tmp_path):
    reply = apply({"action": "set", "spec": {"sections": [{"from": "mail.inbox"}]}}, tmp_path)
    assert reply.startswith("Not saved. Fix these and call dashboard again:") and "unknown source" in reply
    assert apply({"action": "set", "spec": {"sections": [{"from": "weather.Atlantis"}]}}, tmp_path) == \
        "Not saved: couldn't find a place called 'Atlantis'."
    assert spec.load_spec(tmp_path / "blocks") is None


def test_show_lists_sources_and_the_current_spec(tmp_path):
    shown = apply({"action": "show"}, tmp_path)
    assert "No dashboard yet." in shown and "assistant.bills (table, list, checklist)" in shown
    apply({"action": "set", "spec": {"sections": [{"from": "tasks"}]}}, tmp_path)
    assert '"from": "tasks"' in apply({"action": "show"}, tmp_path)


def test_clear(tmp_path):
    apply({"action": "set", "spec": {"sections": [{"from": "tasks"}]}}, tmp_path)
    assert apply({"action": "clear"}, tmp_path) == "Cleared the Today dashboard."
    assert spec.load_spec(tmp_path / "blocks") is None


def test_the_tool_is_registered():
    assert "dashboard" in [t.name for t in tools.TOOLS]


def test_saving_today_restores_a_missing_mail_check(tmp_path):
    memory = importlib.import_module("hermes_genui.core.assistant.memory")
    home = tmp_path / "home"
    blocks = home / "plugin-data" / "hermes-genui" / "blocks"
    blocks.mkdir(parents=True)
    (home / "config.yaml").write_text("mcp_servers:\n  gmail:\n    command: x\n", encoding="utf-8")
    memory.save_config({"source": "gmail", "setup_at": "2026-11-15T09:00:00+05:30", "last_check": None}, blocks)
    spec_ = {"title": "Today", "sections": [{"from": "calendar.today"}]}
    reply = dashboard.apply({"action": "set", "spec": spec_}, root=blocks, client=client())
    assert "check isn't scheduled" in reply and '"enabled_toolsets": ["hermes_genui_assistant", "gmail"]' in reply
    (home / "cron").mkdir()
    (home / "cron" / "jobs.json").write_text('{"jobs": [{"name": "Personal assistant check"}]}', encoding="utf-8")
    assert "isn't scheduled" not in dashboard.apply({"action": "set", "spec": spec_}, root=blocks, client=client())
