"""One fetch per kind of live data on the Today page. Each takes an item naming what to fetch and returns plain
numbers and text; a failure raises, and cache.py keeps the last good value. No model is involved.

Loaded by path from the dashboard API (see the package docstring), so it imports nothing from the plugin package.
"""

import importlib.util
import json
import re
import socket
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote as url_quote

import httpx
import psutil

FORECAST = "https://api.open-meteo.com/v1/forecast"
CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"

# How often each kind of source may be fetched, in seconds. Clocks need no fetching: the page computes the time.
INTERVALS = {"system": 5, "tasks": 30, "stock": 60, "weather": 900}
TIMEOUT = 4
IOREG_TIMEOUT = 3
MAX_JOBS = 20

CURRENCY = {"USD": "$", "INR": "₹", "EUR": "€", "GBP": "£", "JPY": "¥", "CNY": "¥", "HKD": "HK$", "AUD": "A$",
            "CAD": "C$", "CHF": "CHF ", "SGD": "S$"}
GPU_MEMORY = re.compile(r'"In use system memory"=(\d+)')
JOB_FIELDS = ("name", "enabled", "last_status", "last_run_at", "next_run_at")


def _user_agent() -> str:
    """The plugin's User-Agent from core/manifest.py, loaded by path."""
    spec = importlib.util.spec_from_file_location("hermes_genui_live_manifest",
                                                  Path(__file__).resolve().parent.parent / "manifest.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.USER_AGENT


HEADERS = {"User-Agent": _user_agent()}


def weather(item: dict, client: httpx.Client) -> dict:
    """Now and today at one place.

    {"lat": 18.52, "lon": 73.86, …} → {"temp": 24.1, "code": 1, "high": 31.0, "low": 19.2, "rain": 10}
    """
    r = client.get(FORECAST, headers=HEADERS, params={
        "latitude": item["lat"], "longitude": item["lon"], "current": "temperature_2m,weather_code",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": "auto", "forecast_days": 1})
    r.raise_for_status()
    data = r.json()
    now, today = data["current"], data["daily"]
    return {"temp": float(now["temperature_2m"]), "code": int(now["weather_code"]),
            "high": float(today["temperature_2m_max"][0]), "low": float(today["temperature_2m_min"][0]),
            "rain": int(today["precipitation_probability_max"][0] or 0)}


SKIES = ((0, 0, "Clear"), (1, 2, "Partly cloudy"), (3, 3, "Cloudy"), (45, 48, "Fog"), (51, 57, "Drizzle"),
         (61, 67, "Rain"), (71, 77, "Snow"), (80, 82, "Showers"), (85, 86, "Snow"), (95, 99, "Thunderstorm"))


def condition(code: int) -> str:
    """The sky for a WMO weather code, as Open-Meteo reports it: 3 → "Cloudy"; an unknown code → ""."""
    return next((sky for low, high, sky in SKIES if low <= code <= high), "")


def quote(item: dict, client: httpx.Client) -> dict:
    """A stock's last price and its change since the previous close.

    {"symbol": "NVDA"} → {"price": 182.4, "change_pct": 1.33, "currency": "$"}
    """
    url = CHART.format(sym=url_quote(item["symbol"], safe="^="))
    r = client.get(url, params={"range": "1d", "interval": "1d"}, headers=HEADERS)
    r.raise_for_status()
    meta = r.json()["chart"]["result"][0]["meta"]
    price, before = float(meta["regularMarketPrice"]), float(meta["chartPreviousClose"])
    code = str(meta.get("currency") or "")
    return {"price": round(price, 2), "change_pct": round((price - before) / before * 100, 2),
            "currency": CURRENCY.get(code, f"{code} " if code else "")}


def _gpu_used() -> int | None:
    """GPU memory in use on a Mac, from ioreg; None elsewhere or when ioreg fails or is slow."""
    if sys.platform != "darwin":
        return None
    try:
        out = subprocess.run(["ioreg", "-r", "-d", "1", "-w", "0", "-c", "AGXAccelerator"], capture_output=True,
                             text=True, timeout=IOREG_TIMEOUT, check=False).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    found = GPU_MEMORY.search(out or "")
    return int(found.group(1)) if found else None


def system(item: dict) -> dict:
    """The machine running Hermes: only the parts the item shows (all four when it names none), and its name.

    {"show": ["cpu"]} → {"host": "mac-mini", "cpu": 12.5}
    """
    parts = item.get("show") or ["cpu", "ram", "disk", "gpu"]
    stats: dict = {"host": socket.gethostname().removesuffix(".local")}
    if "cpu" in parts:
        stats["cpu"] = float(psutil.cpu_percent(interval=None))
    if "ram" in parts:
        memory = psutil.virtual_memory()
        stats["ram_used"], stats["ram_total"] = int(memory.total - memory.available), int(memory.total)
    if "disk" in parts:
        disk = psutil.disk_usage(Path.home().anchor or "/")
        stats["disk_used"], stats["disk_total"] = int(disk.used), int(disk.total)
    if "gpu" in parts:
        stats["gpu_used"] = _gpu_used()
    return stats


def _job_name(job: dict, index: int) -> str:
    """A job's name, or "Task <n>" when it has none or Hermes named it after the start of its prompt (an unnamed job
    gets its prompt's first 50 characters as its name, and a prompt must never slide across the status bar)."""
    name = str(job.get("name") or "").strip()
    prompt = str(job.get("prompt") or "").strip()
    if not name or (prompt and prompt.startswith(name.rstrip(".… "))):
        return f"Task {index + 1}"
    return name


def tasks(item: dict, home: Path) -> dict:
    """The profile's scheduled Hermes tasks: name, on or off, how the last run went, when the next one is. Enabled ones
    first, then by next run; at most 20. Nothing else from the job list (prompts stay out).

    → {"jobs": [{"name": "Security Scan", "enabled": True, "last_status": "ok", "last_run_at": "…",
                 "next_run_at": "…"}]}
    """
    try:
        data = json.loads((home / "cron" / "jobs.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"jobs": []}
    jobs = data.get("jobs") if isinstance(data, dict) else data
    if not isinstance(jobs, list):
        return {"jobs": []}
    listed = [{**{field: job.get(field) for field in JOB_FIELDS}, "name": _job_name(job, i)}
              for i, job in enumerate(jobs) if isinstance(job, dict)]
    listed.sort(key=lambda job: (not job["enabled"], str(job["next_run_at"] or "~")))
    return {"jobs": listed[:MAX_JOBS]}


def history(item: dict, client: httpx.Client) -> dict:
    """A month of daily closes for a stock chart: {"x": ["Oct 15", …], "y": [182.4, …]}."""
    url = CHART.format(sym=url_quote(item["symbol"], safe="^="))
    r = client.get(url, params={"range": "1mo", "interval": "1d"}, headers=HEADERS)
    r.raise_for_status()
    result = r.json()["chart"]["result"][0]
    points = [(t, c) for t, c in zip(result.get("timestamp") or [], result["indicators"]["quote"][0]["close"] or [])
              if c is not None]
    from datetime import datetime
    return {"x": [f"{datetime.fromtimestamp(t):%b} {datetime.fromtimestamp(t).day}" for t, _ in points],
            "y": [round(float(c), 2) for _, c in points]}
