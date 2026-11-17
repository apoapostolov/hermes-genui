import importlib

import httpx

from conftest import load_plugin_package

load_plugin_package()
resolve = importlib.import_module("hermes_genui.core.live.resolve")

PUNE = {"results": [{"name": "Pune", "latitude": 18.5196, "longitude": 73.8553, "timezone": "Asia/Kolkata"}]}


def client_for(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_a_city_becomes_a_place_with_coordinates_and_zone():
    seen = []

    def handler(request):
        seen.append(request.url)
        return httpx.Response(200, json=PUNE)

    assert resolve.place("Pune", client_for(handler)) == {"city": "Pune", "lat": 18.52, "lon": 73.86,
                                                          "tz": "Asia/Kolkata"}
    assert seen[0].host == "geocoding-api.open-meteo.com"
    assert seen[0].params["name"] == "Pune" and seen[0].params["count"] == "1"


def test_an_unknown_city_is_none_but_a_failed_lookup_says_so():
    assert resolve.place("Pnue", client_for(lambda r: httpx.Response(200, json={}))) is None

    def down(request):
        raise httpx.ConnectError("down")

    for failing in (lambda r: httpx.Response(500), down):
        try:
            resolve.place("Pune", client_for(failing))
        except resolve.Unavailable:
            continue
        raise AssertionError("a failed lookup must not look like an unknown city")


def test_a_zone_typed_directly_needs_no_lookup():
    def handler(request):
        raise AssertionError("no request expected")

    assert resolve.zone("Asia/Tokyo", client_for(handler)) == "Asia/Tokyo"
    assert resolve.zone("Pune", client_for(lambda r: httpx.Response(200, json=PUNE))) == "Asia/Kolkata"
    assert resolve.zone("Pnue", client_for(lambda r: httpx.Response(200, json={}))) is None


def chart(symbol: str, name: str) -> dict:
    return {"chart": {"result": [{
        "meta": {"symbol": symbol, "shortName": name, "currency": "USD", "exchangeTimezoneName": "America/New_York"},
        "timestamp": [1_762_000_000 + i * 86400 for i in range(3)],
        "indicators": {"quote": [{"close": [180.0, 181.0, 182.4]}]},
    }]}}


def test_a_company_name_becomes_its_symbol_and_listing_name():
    def handler(request):
        if request.url.path.endswith("/search"):
            return httpx.Response(200, json={"quotes": [{"symbol": "NVDA"}]})
        return httpx.Response(200, json=chart("NVDA", "NVIDIA Corporation"))

    assert resolve.stock("nvidia", client_for(handler)) == {"symbol": "NVDA", "name": "NVIDIA Corporation"}


def test_an_unknown_stock_is_none():
    def handler(request):
        return httpx.Response(200, json={"quotes": []})

    assert resolve.stock("XYZZ", client_for(handler)) is None
