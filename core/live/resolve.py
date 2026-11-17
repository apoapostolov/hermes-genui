"""Turn what the user typed into something a feed can fetch: a city into coordinates and a time zone, a company name
into a stock symbol. Run once, when a section is added (by the dashboard tool), so a misspelt city is caught then.
"""

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from ...tools import market_history

GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"


class Unavailable(Exception):
    """The lookup service couldn't be reached or answered with an error: not the same as "no such place"."""


def place(city: str, client: httpx.Client) -> dict | None:
    """Open-Meteo's best match for a city, or None when there is none. Raises Unavailable when the lookup fails.

    place("Pune", client) → {"city": "Pune", "lat": 18.52, "lon": 73.86, "tz": "Asia/Kolkata"}
    """
    try:
        r = client.get(GEOCODE, params={"name": city.strip(), "count": 1}, headers=market_history.HEADERS)
        r.raise_for_status()
        data = r.json()
    except (httpx.HTTPError, ValueError) as e:
        raise Unavailable(type(e).__name__) from e
    try:
        found = (data.get("results") or [None])[0]
        return {"city": market_history.clean_name(found["name"], city.strip()),
                "lat": round(float(found["latitude"]), 2), "lon": round(float(found["longitude"]), 2),
                "tz": str(found["timezone"])}
    except (ValueError, KeyError, TypeError, AttributeError):
        return None


def is_zone(text: str) -> bool:
    try:
        ZoneInfo(text)
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return "/" in text or text == "UTC"


def zone(city: str, client: httpx.Client) -> str | None:
    """The IANA time zone for a city, or the zone itself when one was typed.

    zone("Asia/Tokyo", client) → "Asia/Tokyo" (no lookup);  zone("Pune", client) → "Asia/Kolkata"
    """
    text = city.strip()
    if is_zone(text):
        return text
    found = place(text, client)
    return found["tz"] if found else None


def stock(name: str, client: httpx.Client) -> dict | None:
    """The listing a name or ticker refers to, checked by fetching its last few days, or None when there's no such
    listing. Raises Unavailable when Yahoo couldn't be reached.

    stock("nvidia", client) → {"symbol": "NVDA", "name": "NVIDIA Corporation"}
    """
    found = market_history._fetch(client, name.strip(), "5d")
    if isinstance(found, dict):
        return {"symbol": found["sym"], "name": found["name"]}
    if found.startswith("Couldn't get prices"):  # market_history's words for a failed request
        raise Unavailable(found)
    return None
