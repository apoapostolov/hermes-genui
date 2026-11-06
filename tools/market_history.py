"""market_history: prices for an index, stock, currency or gold from Yahoo Finance's public chart API (no key),
stored as a board (headline numbers, a line chart, a source line) with a tag to paste. Only the symbol leaves the
machine, and the model never writes the numbers itself."""

import re
from datetime import datetime
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx

from ..blocks.common import acts_before_the_model, one_line
from ..core import store, surface
from ..core.manifest import USER_AGENT
from .show_blocks import paste_instruction

CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
SEARCH = "https://query1.finance.yahoo.com/v1/finance/search"
# Yahoo answers 429 to a library's default User-Agent (python-httpx, curl), so the plugin names itself:
# "hermes-genui/0.2.0 (+https://…)".
HEADERS = {"User-Agent": USER_AGENT}
# Yahoo's ranges (the periods it accepts) and the bar size for each, shortest first.
RANGES = {"1d": "5m", "5d": "1d", "1mo": "1d", "3mo": "1d", "6mo": "1d", "1y": "1wk", "2y": "1wk", "5y": "1mo",
          "10y": "1mo"}
DAYS = {"1d": 1, "5d": 5, "1mo": 31, "3mo": 92, "6mo": 183, "1y": 366, "2y": 731, "5y": 1827, "10y": 3653}
PHRASES = {"today": "1d", "this week": "5d", "last week": "5d", "past week": "5d", "this month": "1mo",
           "last month": "1mo", "this year": "1y", "last year": "1y"}
_PERIOD = re.compile(r"^\s*(\d+)\s*(d|days?|w|wk|weeks?|m|mo|months?|y|yr|years?)\s*$", re.IGNORECASE)
_UNIT_DAYS = {"d": 1, "w": 7, "m": 30, "y": 365}
ALIASES = {
    "nifty": "^NSEI", "nifty 50": "^NSEI", "nifty50": "^NSEI", "sensex": "^BSESN",
    "bank nifty": "^NSEBANK", "banknifty": "^NSEBANK", "nifty bank": "^NSEBANK", "nifty it": "^CNXIT",
    "s&p 500": "^GSPC", "sp500": "^GSPC", "nasdaq": "^IXIC", "dow": "^DJI",
    "gold": "GC=F", "usdinr": "INR=X", "usd inr": "INR=X", "bitcoin": "BTC-USD",
}


# What a symbol may look like: it becomes part of the chart URL's path, so nothing else (no /, no ..alone, no ? or #).
SYMBOL = re.compile(r"[\^A-Za-z0-9.=\-]{1,20}")


def is_symbol(sym: object) -> bool:
    """Whether a symbol (the model's or Yahoo's) is safe to put in the chart URL.

    "^NSEI" → True;  "GC=F" → True;  "TCS.NS" → True;  "../../v1/finance/search#." → False;  "A/B" → False;
    ".." → False (dots alone are a path step);  a 21-character one → False
    """
    return isinstance(sym, str) and SYMBOL.fullmatch(sym) is not None and sym.strip(".") != ""


def resolve_alias(name: str) -> str | None:
    """A known name or a ticker that already looks like one, else None (then Yahoo search is asked).

    "Nifty 50" → "^NSEI";  "TCS.NS" → "TCS.NS";  "Reliance" → None;  "../../etc" → None (not a symbol's shape)
    """
    n = " ".join((name or "").lower().split())
    if n in ALIASES:
        return ALIASES[n]
    s = (name or "").strip()
    looks_like_one = s.startswith("^") or "." in s or "=" in s or "-" in s
    return s if looks_like_one and is_symbol(s) else None


def _search(client: httpx.Client, name: str) -> str | None:
    """Yahoo's best match for a name, preferring an Indian listing (.NS, .BO) when there is one. A result that isn't
    shaped like a symbol (is_symbol) is skipped."""
    r = client.get(SEARCH, params={"q": name, "quotesCount": 6, "newsCount": 0}, headers=HEADERS)
    r.raise_for_status()
    quotes = [q for q in r.json().get("quotes") or [] if isinstance(q, dict) and is_symbol(q.get("symbol"))]
    indian = [q for q in quotes if q["symbol"].endswith((".NS", ".BO"))]
    best = (indian or quotes)[:1]
    return best[0]["symbol"] if best else None


# Yahoo's names for a listing come back to the model in the summary and in the buttons' messages: no control or bidi
# characters, and short.
MAX_NAME = 60


def clean_name(name: object, fallback: str) -> str:
    """A listing's name safe to repeat: control and bidi characters gone, spaces squeezed, at most 60 characters.

    "Tata Consultancy Services" → the same;  "Evil\u202e Corp\x1b[31m" → "Evil Corp[31m";  "" → the fallback
    """
    return one_line(name, MAX_NAME) or fallback


def period_for(asked: str) -> str:
    """The Yahoo range to fetch: the asked one when Yahoo has it, a common phrase's range, else the shortest range
    that covers it, so a longer ask never comes back shorter. Anything unreadable gets 1mo.

    "1y" → "1y";  "3y" → "5y" (Yahoo has no 3y);  "2 years" → "2y";  "4mo" → "6mo";  "20y" → "10y" (the longest);
    "last week" → "5d";  "whenever" → "1mo"
    """
    if asked in RANGES:
        return asked
    phrase = " ".join((asked or "").lower().split())
    if phrase in PHRASES:
        return PHRASES[phrase]
    match = _PERIOD.match(asked or "")
    if not match:
        return "1mo"
    days = int(match.group(1)) * _UNIT_DAYS[match.group(2)[0].lower()]
    for period, covers in DAYS.items():
        if covers >= days:
            return period
    return "10y"


MAX_COMPARED = 3  # the comparison chart draws one line each, and a line chart takes at most 3


def symbols_in(asked: str) -> list[str]:
    """The names to fetch: one, or up to 3 separated by commas or "vs" to compare.

    "GOOGL, MSFT" → ["GOOGL", "MSFT"];  "GOOGL vs MSFT" → ["GOOGL", "MSFT"];  "NIFTY" → ["NIFTY"]
    """
    parts = re.split(r"\s*,\s*|\s+vs\.?\s+", asked or "", flags=re.IGNORECASE)
    return [p.strip() for p in parts if p.strip()][:MAX_COMPARED]


# Yahoo's currency codes for the signs the blocks write in front of an amount ("₹2,502", "$4.21B").
SIGNS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥"}


def currency_sign(code: object) -> str:
    """The unit for a price in Yahoo's currency: its sign when the blocks know one, else the code as one short line.

    "INR" → "₹";  "USD" → "$";  "CHF" → "CHF";  "GBp" → "GBp" (pence, not pounds);  None → ""
    """
    if isinstance(code, str) and code in SIGNS:
        return SIGNS[code]
    return one_line(code, 12)


def _fetch(client: httpx.Client, symbol: str, period: str) -> dict | str:
    """One symbol's closes as {name, sym, unit, x, y}, or a sentence saying why there are none."""
    try:
        sym = resolve_alias(symbol) or _search(client, symbol)
        if not sym:
            return f"Couldn't find a market symbol for '{symbol}'."
        url = CHART.format(sym=quote(sym, safe="^="))
        r = client.get(url, params={"range": period, "interval": RANGES[period]}, headers=HEADERS)
        r.raise_for_status()
        res = r.json()["chart"]["result"][0]
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as e:
        return f"Couldn't get prices for '{symbol}' just now ({type(e).__name__}). Try again in a minute."
    meta = res.get("meta", {})
    tz = ZoneInfo(meta.get("exchangeTimezoneName") or "UTC")
    closes = (res.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
    points = [(t, v) for t, v in zip(res.get("timestamp") or [], closes) if v is not None]
    if len(points) < 2:
        return f"Not enough price data for {sym} over {period}."
    return {
        "name": clean_name(meta.get("shortName") or meta.get("longName"), sym),
        "sym": sym,
        "unit": "pts" if sym.startswith("^") else currency_sign(meta.get("currency")),  # an index is points
        "kind": meta.get("instrumentType"),
        "x": [_label(t, tz, period) for t, _ in points],
        "y": [round(v, 2) for _, v in points],
    }


def _label(ts: float, tz, period: str) -> str:
    """One x-axis label. The day is written from ``.day`` instead of ``%-d``: that directive (no zero padding) is a
    glibc extension, and MSVC's ``strftime`` rejects it with ``ValueError: Invalid format string``, which took the whole
    tool down on Windows for 5d, 1mo and 3mo.

    _label(1761955200, ZoneInfo("Asia/Kolkata"), "1mo") → "1 Nov"; "1d" → "05:30"; "1y" → "Nov 2025".
    """
    moment = datetime.fromtimestamp(ts, tz)
    if period == "1d":
        return moment.strftime("%H:%M")
    if period in ("5d", "1mo", "3mo"):
        return f"{moment.day} {moment.strftime('%b')}"
    return moment.strftime("%b %Y")


def _change(y: list[float]) -> float:
    return (y[-1] - y[0]) / y[0] * 100


def _summary(p: dict, period: str) -> str:
    y, x, unit = p["y"], p["x"], p["unit"]
    return (f"{p['name']} ({p['sym']}) over {period}: {y[0]:,.2f} on {x[0]} to {y[-1]:,.2f} on {x[-1]} "
            f"({_change(y):+.2f}%). High {max(y):,.2f}, low {min(y):,.2f} ({'points' if unit == 'pts' else unit}).")


def is_company(sym: str, kind: str | None) -> bool:
    """A single company has results to analyse; an index, currency, commodity, crypto or fund doesn't.

    ("TCS.NS", "EQUITY") → True;  ("^NSEI", None) → False;  ("GC=F", None) → False;  ("AAPL", None) → True
    """
    if kind:
        return kind.upper() == "EQUITY"
    return bool(sym) and not (sym.startswith("^") or sym.endswith(("=X", "=F", "-USD")))


def _next_steps(p: dict, period: str) -> list[dict]:
    """Follow-up buttons under a one-symbol board: Analyze for a company, and a year's view unless already shown.

    TCS over 1mo → [Analyze, 1 year];  NIFTY over 1mo → [1 year];  NIFTY over 1y → []
    A name Hermes would act on in a sent message ("Acme @file:x") → [] (see acts_before_the_model)
    """
    steps = []
    if is_company(p["sym"], p.get("kind")):
        steps.append({"label": "Analyze", "run": f"Give me a visual dashboard of {p['name']} ({p['sym']})"})
    if DAYS[period] < DAYS["1y"]:
        steps.append({"label": "1 year", "run": f"How has {p['name']} done over the last year?"})
    return [step for step in steps if not acts_before_the_model(step["run"])]


def _one_board(p: dict, period: str) -> list[dict]:
    """Headline numbers, the price line and the source, for one symbol."""
    y, unit = p["y"], p["unit"]
    board = [
        {"type": "kpis", "items": [
            {"label": "Last", "value": y[-1], "unit": unit, "change": round(_change(y), 2), "change_unit": "%"},
            {"label": "High", "value": max(y), "unit": unit},
            {"label": "Low", "value": min(y), "unit": unit},
        ]},
        {"type": "chart", "kind": "line", "title": f"{p['name']} · {period}", "x": p["x"],
         "series": [{"name": "Close", "data": y}], "unit": unit, "tone": "change"},  # green above the start
        {"type": "source", "text": "Yahoo Finance · may be delayed"},
    ]
    steps = _next_steps(p, period)
    return board + ([{"type": "actions", "items": steps}] if steps else [])


# A card's trend line is small: at most this many points.
TREND_MOST = 60


def trend_points(y: list[float], most: int = TREND_MOST) -> list[float]:
    """At most `most` closes for a card's trend line, evenly spread, the first and last always kept.

    [1, 2, 3] → the same;  119 closes, most=60 → every other one (0, 2, …, 118)
    """
    if len(y) <= most:
        return list(y)
    step = (len(y) - 1) / (most - 1)
    return [y[round(i * step)] for i in range(most)]


def _compare_card(p: dict) -> dict:
    """One symbol's card: its last price, the change over the period and a small trend line of its closes."""
    y = p["y"]
    return {"label": p["name"], "value": y[-1], "unit": p["unit"], "change": round(_change(y), 2),
            "change_unit": "%", "trend": trend_points(y)}


def _rebased(found: list[dict]) -> tuple[list[str], list[dict]]:
    """Each symbol's % change from its own first close, on the first symbol's dates; a date another market didn't
    trade is a gap. GOOGL 100 → 80 and MSFT 200 → 210 → GOOGL [0, …, -20], MSFT [0, …, 5]."""
    x = found[0]["x"]
    series = []
    for p in found:
        start = p["y"][0]
        by_date = dict(zip(p["x"], p["y"]))
        data = [round((by_date[d] / start - 1) * 100, 2) if d in by_date else None for d in x]
        series.append({"name": p["name"], "data": data})
    return x, series


def _compare_board(found: list[dict], period: str) -> list[dict]:
    """A card per symbol (price, change, trend) and one chart of each one's % change from the same start, so prices
    of very different sizes share a scale."""
    x, series = _rebased(found)
    names = " vs ".join(p["name"] for p in found)
    run = f"Give me a visual dashboard of {names}"
    return [
        {"type": "kpis", "items": [_compare_card(p) for p in found]},
        {"type": "chart", "kind": "line", "title": f"{names} · {period} (% change)", "x": x, "series": series,
         "unit": "%", "figure": False},  # % change from the start: a change chip would be a change of a change
        {"type": "source", "text": "Yahoo Finance · may be delayed"},
    ] + ([] if acts_before_the_model(run) else [{"type": "actions", "items": [{"label": "Dashboard", "run": run}]}])


def history(symbol: str, period: str = "1mo", client: httpx.Client | None = None, session_id: str = "") -> str:
    """A summary plus the tag of a stored board, or plain sentences (no tag) when there is nothing to draw.
    Several symbols ("GOOGL, MSFT") are compared on one board; any that fail are named in the summary."""
    period = period_for(period)
    own_client = client is None
    client = client or httpx.Client(timeout=15)
    try:
        results = [_fetch(client, s, period) for s in symbols_in(symbol)]
    finally:
        if own_client:
            client.close()
    found = [r for r in results if isinstance(r, dict)]
    lines = [r if isinstance(r, str) else _summary(r, period) for r in results]
    if not found:
        return " ".join(lines) or f"Couldn't find a market symbol for '{symbol}'."
    summary = "\n".join(lines) + "\nSource: Yahoo Finance (may be delayed)."
    if not surface.can_draw(session_id=session_id):  # a text-only surface: the numbers, without a board to paste
        return summary
    board = _one_board(found[0], period) if len(found) == 1 else _compare_board(found, period)
    return f"{summary}\n{paste_instruction(store.save(board), includable=True)}"


def market_history(params: dict, **kwargs) -> str:
    return history(str(params.get("symbol", "")), str(params.get("period") or "1mo"),
                   session_id=str(kwargs.get("session_id") or ""))


MARKET_HISTORY_SCHEMA = {
    "name": "market_history",
    "description": (
        "Price history for a stock, index, currency or commodity, drawn as a board (headline numbers and a line "
        "chart). Use it for \"how's the market\", \"how is X doing\", a price or a trend. \"The market\" with no "
        "name means NIFTY 50 for an Indian user and the S&P 500 otherwise. Period: 1mo by default, 5d for \"this "
        "week\", 1d for \"today\". Then write one or two sentences on the move (the change, and the high or low if "
        "it matters) and paste the returned tag on its own line exactly as returned; the board shows the numbers, so "
        "don't list them again. Use only the numbers in the tool's summary; if it couldn't find the symbol or get "
        "prices, say so and suggest a ticker (there is no tag then). No buy, sell or price-target advice."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "symbol": {"type": "string", "description": "A name or ticker, e.g. NIFTY, SENSEX, BANK NIFTY, RELIANCE, "
                                                        "TCS.NS, AAPL, gold, USDINR. To compare, up to 3 separated by "
                                                        "commas (\"GOOGL, MSFT\"): one board with a card each and "
                                                        "a % change chart."},
            "period": {"type": "string", "description": "1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y or 10y. 'last week' = 5d; "
                                                        "any other, like 3y, gets the next longer one. Default 1mo."},
        },
        "required": ["symbol"],
    },
}
