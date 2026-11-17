import importlib
import json
import subprocess

import httpx

from conftest import load_plugin_package

load_plugin_package()
feeds = importlib.import_module("hermes_genui.core.live.feeds")

PUNE = {"feed": "weather", "city": "Pune", "lat": 18.52, "lon": 73.86, "tz": "Asia/Kolkata"}
FORECAST = {"current": {"temperature_2m": 24.1, "weather_code": 1},
            "daily": {"temperature_2m_max": [31.0], "temperature_2m_min": [19.2],
                      "precipitation_probability_max": [10]}}


def client_for(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_weather_reads_now_and_today_for_the_place():
    seen = []

    def handler(request):
        seen.append(request.url)
        return httpx.Response(200, json=FORECAST)

    assert feeds.weather(PUNE, client_for(handler)) == {"temp": 24.1, "code": 1, "high": 31.0, "low": 19.2,
                                                        "rain": 10}
    assert seen[0].host == "api.open-meteo.com"
    assert seen[0].params["latitude"] == "18.52" and seen[0].params["forecast_days"] == "1"


def test_a_quote_is_the_price_and_the_change_since_yesterdays_close():
    payload = {"chart": {"result": [{"meta": {"regularMarketPrice": 182.4, "chartPreviousClose": 180.0,
                                              "currency": "USD"}}]}}
    quote = feeds.quote({"feed": "stock", "symbol": "NVDA"}, client_for(lambda r: httpx.Response(200, json=payload)))
    assert quote == {"price": 182.4, "change_pct": 1.33, "currency": "$"}


def test_a_bad_quote_raises_so_the_cache_keeps_the_old_value():
    try:
        feeds.quote({"feed": "stock", "symbol": "NVDA"}, client_for(lambda r: httpx.Response(429)))
    except httpx.HTTPError:
        return
    raise AssertionError("expected an HTTP error")


def test_system_has_only_the_parts_asked_for_and_names_the_machine():
    stats = feeds.system({"feed": "system", "show": ["cpu"]})
    assert set(stats) == {"host", "cpu"}
    assert 0 <= stats["cpu"] <= 100
    every = feeds.system({"feed": "system"})
    assert {"host", "cpu", "ram_used", "ram_total", "disk_used", "disk_total"} <= set(every)


def test_gpu_memory_is_none_when_ioreg_hangs_or_is_missing(monkeypatch):
    def hang(*args, **kwargs):
        raise subprocess.TimeoutExpired("ioreg", 3)

    monkeypatch.setattr(feeds.subprocess, "run", hang)
    assert feeds.system({"feed": "system", "show": ["gpu"]})["gpu_used"] is None
    monkeypatch.setattr(feeds.subprocess, "run", lambda *a, **k: (_ for _ in ()).throw(FileNotFoundError()))
    assert feeds.system({"feed": "system", "show": ["gpu"]})["gpu_used"] is None


def test_gpu_memory_is_read_from_ioreg_on_a_mac(monkeypatch):
    out = subprocess.CompletedProcess([], 0, stdout='  "PerformanceStatistics" = {"In use system memory"=6442450944}')
    monkeypatch.setattr(feeds.sys, "platform", "darwin")
    monkeypatch.setattr(feeds.subprocess, "run", lambda *a, **k: out)
    assert feeds.system({"feed": "system", "show": ["gpu"]})["gpu_used"] == 6442450944


def test_tasks_lists_scheduled_jobs_enabled_first_then_by_next_run(tmp_path):
    (tmp_path / "cron").mkdir()
    jobs = [{"name": "Old", "enabled": False, "last_status": "ok", "last_run_at": "2026-11-01T12:00:00+05:30",
             "next_run_at": "2026-11-02T12:00:00+05:30", "prompt": "secret"},
            {"name": "Security Scan", "enabled": True, "last_status": "error",
             "last_run_at": "2026-11-14T10:30:00+05:30", "next_run_at": "2026-11-15T10:30:00+05:30"},
            {"name": "News", "enabled": True, "last_status": None, "last_run_at": None,
             "next_run_at": "2026-11-14T18:00:00+05:30"}]
    (tmp_path / "cron" / "jobs.json").write_text(json.dumps({"jobs": jobs}), encoding="utf-8")
    listed = feeds.tasks({"feed": "tasks"}, tmp_path)["jobs"]
    assert [job["name"] for job in listed] == ["News", "Security Scan", "Old"]
    assert set(listed[0]) == {"name", "enabled", "last_status", "last_run_at", "next_run_at"}


def test_tasks_is_empty_without_a_readable_job_list(tmp_path):
    assert feeds.tasks({"feed": "tasks"}, tmp_path) == {"jobs": []}
    (tmp_path / "cron").mkdir()
    (tmp_path / "cron" / "jobs.json").write_text("[{", encoding="utf-8")
    assert feeds.tasks({"feed": "tasks"}, tmp_path) == {"jobs": []}


def test_a_task_named_after_its_prompt_shows_a_neutral_name(tmp_path):
    (tmp_path / "cron").mkdir()
    prompt = "Check the client ledger for Acme Ltd and email me the overdue invoices every morning"
    jobs = [{"name": prompt[:50], "prompt": prompt, "enabled": True, "next_run_at": "2026-11-15T09:00:00+05:30"},
            {"name": "Security Scan", "prompt": "scan", "enabled": True, "next_run_at": "2026-11-15T10:00:00+05:30"},
            {"prompt": "x", "enabled": True, "next_run_at": "2026-11-15T11:00:00+05:30"}]
    (tmp_path / "cron" / "jobs.json").write_text(json.dumps({"jobs": jobs}), encoding="utf-8")
    names = [job["name"] for job in feeds.tasks({"feed": "tasks"}, tmp_path)["jobs"]]
    assert names == ["Task 1", "Security Scan", "Task 3"]
    assert all("Acme" not in str(job) for job in feeds.tasks({"feed": "tasks"}, tmp_path)["jobs"])


def test_a_weather_code_reads_as_a_sky():
    assert [feeds.condition(c) for c in (0, 2, 3, 45, 53, 63, 73, 81, 95)] == [
        "Clear", "Partly cloudy", "Cloudy", "Fog", "Drizzle", "Rain", "Snow", "Showers", "Thunderstorm"]
    assert feeds.condition(999) == ""
