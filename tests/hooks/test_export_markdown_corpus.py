"""The export's parity contract (t_bff8178a round 2, F1): the board a FILE gets is the board the CHAT gets.

web/src/lib/markdown.ts is the host-side twin of hooks/text_fallback.py — it serializes a stored board to Markdown
without asking the store (or the network) anything, because the board is already in the page's memory. Two
serializers of the same words is only honest if a corpus pins them to the same bytes:

  CASES here are walked by the REAL Python serializer (blocks_as_text uncapped — the export's own limit=None),
  and the results are stored in web/src/lib/markdown.corpus.json. The web suite (markdown.test.ts) feeds the same
  blocks to the TS port and asserts the same expected strings. Change the serializer without regenerating the
  corpus, and one of the two suites reddens.

Regenerate deliberately (a serializer change is then reviewed as a corpus diff):
    GARZA_CORPUS_REGENERATE=1 uv run ... pytest tests/hooks/test_export_markdown_corpus.py
"""
import importlib
import json
import os
from pathlib import Path

import pytest

from conftest import load_plugin_package

tf = importlib.import_module("hermes_genui.hooks.text_fallback") if load_plugin_package() else None
CORPUS = Path(__file__).resolve().parents[2] / "web" / "src" / "lib" / "markdown.corpus.json"


def _deep_board(level: int) -> list:
    """A heading buried `level` grids deep — past the serializer's own depth cap."""
    block: dict = {"type": "heading", "text": "buried"}
    for _ in range(level):
        block = {"type": "grid", "children": [block]}
    return [block]


def _cases() -> list:
    """Boards worth pinning: every type at least once, the caps and escapes, the number formats, nesting, the
    flow/steps label walk, the helper-free formula rule, and quirks that pass check_blocks (or are simply read
    leniently). Shapes a stored board cannot hold (a null series data) are not here — the port mirrors what the
    CHECKER guarantees: x/series/data/piles arrive as real lists, values as real numbers."""
    long_text = "x" * 340
    return [
        ("heading", [{"type": "heading", "text": "Day 1"}]),
        ("text multi-line kept", [{"type": "text", "text": "one\ntwo\nthree"}]),
        ("text capped and inline-stripped", [{"type": "text", "text": long_text}]),
        ("text control and marks", [
            {"type": "text", "text": "a\x1b[31mb\t[c](javascript:x) <b>tag</b>"},
        ]),
        ("divider badge link", [
            {"type": "divider"},
            {"type": "badge", "label": "New"},
            {"type": "link", "text": "Book", "url": "https://x.org/a b"},
            {"type": "link", "text": "Bad", "url": "javascript:alert(1)"},
        ]),
        ("image fields", [
            {"type": "image", "url": "https://a.org/k.jpg", "caption": "Kyoto"},
            {"type": "image", "src": "http://a.org/m.jpg", "alt": "M", "title": "T"},
            {"type": "image", "caption": "no url", "url": "data:text/html,x"},
        ]),
        ("bar and progress", [
            {"type": "bar", "label": "Level 4", "value": 95, "max": 120, "unit": "XP"},
            {"type": "progress", "title": "Road", "value": 30, "goal": 90, "unit": "%"},
        ]),
        ("callout", [{"type": "callout", "title": "Note", "text": "one\ntwo"}]),
        ("source with url", [{"type": "source", "text": "Trip ledger", "url": "https://led.gr"}]),
        ("stat units and chips", [
            {"type": "stat", "label": "Saved", "value": 12500, "unit": "₹"},
            {"type": "stat", "label": "Close", "value": 80, "change": -0.9, "change_unit": "pt"},
            {"type": "stat", "label": "Fmt", "value": 0.004567},
            {"type": "stat", "label": "Rounded", "value": 1234.5678},
            {"type": "stat", "label": "Half", "value": 2.675},
            {"type": "stat", "label": "NegZero", "value": -0.001},
            {"type": "stat", "label": "IntFloat", "value": 7200.0},
        ]),
        ("kpis", [{"type": "kpis", "items": [
            {"label": "Revenue", "value": 72275, "unit": "₹Cr", "change": 2.2},
            {"value": 3}, {"label": "Empty"},
        ]}]),
        ("table escapes and notes", [{
            "type": "table", "caption": "Lodging, compared",
            "columns": ["Hotel", "Price, nightly", 'No"tes'],
            "rows": [["Hotel Kanra", "¥42,000", 'has a "cypress" bath'],
                     {"Hotel": "Object", "Price, nightly": "line\nbreak", "No\"tes": "piped|cell"},
                     ["Short"],
                     ["R4"], ["R5"], ["R6"], ["R7"], ["R8"], ["R9"], ["R10"], ["R11"], ["R12"], ["R13"]],
        }]),
        ("table no columns or rows", [{"type": "table", "columns": [], "rows": [["x"]]}]),
        ("list ranked and rows", [{
            "type": "list", "ranked": True, "title": "Stops", "items": [
                "Third Wave", {"name": "Dyu", "subtitle": "cafe", "value": "4.5★"},
                {"subtitle": "skipped"},
            ]}]),
        ("checklist", [{"type": "checklist", "title": "Pack", "items": [
            "Passport", {"text": "Jacket", "group": "Clothes"}, {"group": "no text"}]}]),
        ("tiles", [{"type": "tiles", "items": [
            {"title": "Kyoto", "subtitle": "Temples"}, {"title": "Nara"}, "dropped"]}]),
        ("streak", [
            {"type": "streak", "count": 12, "label": "Best", "unit": "d"},
            {"type": "streak", "count": "nope"},
        ]),
        ("chart trend", [{
            "type": "chart", "kind": "line", "title": "Revenue vs profit", "unit": "₹Cr",
            "x": ["Q1", "Q2", "Q3"], "series": [
                {"name": "Revenue", "data": [67087, None, 72275]},
                {"name": "Flat", "data": [0, 0]},
            ]}]),
        ("chart pie slices", [{
            "type": "chart", "kind": "donut", "x": ["A", "B", "C", "D", "E"],
            "series": [{"data": [50, 20, 15, 10, 5]}]}]),
        ("chart scatter and histogram", [
            {"type": "chart", "kind": "scatter", "x": [1, 2, 3],
             "series": [{"name": "Samples", "data": [10, 14, 12]}]},
            {"type": "chart", "kind": "histogram", "series": [{"data": [3, 40, 40, 70, 5]}]},
        ]),
        ("chart bar hbar words", [{
            "type": "chart", "kind": "hbar", "title": "Costs", "x": ["Stay", "Flights", "Local"],
            "series": [{"name": "Cost", "data": [42000, 31500, -28000]}]}]),
        ("images strip", [{"type": "images", "title": "Picks", "images": [
            {"url": "https://a.org/1.jpg", "caption": "One", "source": "Wikimedia"},
            {"url": "/Users/me/gen.png", "caption": "Made"},
            {"url": "/Users/me/gen2.png"},
        ]}]),
        ("include", [{"type": "include", "id": "7f3a09bc"}]),
        ("flip", [{"type": "flip", "title": "Quiz", "cards": [
            {"front": "Most golds?", "back": "China"}, {"question": "Q2", "answer": "A2"}, {"front": "x"}]}]),
        ("actions and button", [
            {"type": "actions", "items": [{"label": "Plan day 2", "run": "Plan day 2"},
                                           {"label": "", "run": "x"}, {"run": "no label"}]},
            {"type": "button", "label": "Open", "url": "https://x.org"},
            {"type": "button", "label": "Plain", "run": "hello"},
        ]),
        ("layers", [{"type": "layers", "title": "Stack", "caption": "bottom first", "layers": [
            {"label": "Embedding", "note": "Turns tokens into vectors"}, {"label": "Heads"}, {"note": "no label"}]}]),
        ("timeline", [{"type": "timeline", "title": "Day 1", "groups": [
            {"label": "Morning", "items": [{"time": "07:00", "title": "Fushimi Inari", "place": "Inari"},
                                            {"title": "no time"}, {"no_title": 1}]},
            {"label": "Empty", "items": []},
        ]}, {"type": "timeline", "items": [{"time": "20:00", "title": "Dinner"}]}]),
        ("heatmap", [{"type": "heatmap", "title": "Crowds", "unit": "%",
                      "rows": ["Mon", "Tue"], "cols": ["AM", "PM", "X"] + [f"X{i}" for i in range(2, 12)],
                      "values": [[1, 2], [3]]}]),
        ("flow", [{"type": "flow", "id": "tf", "title": "Pipeline", "nodes": [
            {"id": "tok", "label": "Tokens", "note": "Split", "holds": ["The", {"text": "it", "tone": "accent"}]},
            {"id": "emb", "label": "Embeddings"},
        ], "groups": [{"label": "Repeated", "nodes": ["tok", "emb"], "count": 6},
                      {"label": "Solo", "nodes": ["emb"]}]}]),
        ("steps with flow", [
            {"type": "flow", "id": "tf", "nodes": [{"id": "emb", "label": "Embeddings"},
                                                    {"id": "tok", "label": "Tokens"}]},
            {"type": "steps", "title": "Run it", "for": "tf", "items": [
                {"title": "Split", "text": "into pieces", "holds": {"emb": [".2 …"], "ghost": ["x"]}, "tick": 5},
                {"title": "Only title"},
            ]},
        ]),
        ("steps without flow", [{"type": "steps", "items": [
            {"title": "One", "holds": {"emb": ["v"]}}, {"title": "Two"}]}]),
        ("calculator", [{
            "type": "calculator",
            "inputs": [{"id": "price", "label": "Price", "value": 200, "unit": "₹"},
                       {"id": "qty", "min": 3, "max": 10},
                       {"value": 9}],
            "outputs": [{"label": "Total", "formula": "(price + 2) * qty"},
                        {"label": "EMI", "formula": "emi(price, 8.5, 20)"},
                        {"label": "Pow", "formula": "price ^ 2"},
                        {"label": "Div0", "formula": "price / 0"},
                        {"formula": "price"}]}]),
        ("calculator headerless", [{"type": "calculator", "outputs": [
            {"label": "Two", "formula": "1 + 1"}]}]),
        ("simulate", [{
            "type": "simulate", "title": "Savings", "unit": "₹",
            "t": {"name": "years", "to": 30, "step": 1},
            "inputs": [{"name": "rate", "label": "Rate", "value": 10, "unit": "%"}],
            "values": {"start": 100},
            "view": {"piles": [
                {"name": "Simple", "formula": "start * (1 + rate / 100 * years)"},
                {"name": "Compound", "formula": "start * (1 + rate / 100) ^ years"},
                {"name": "Helper", "formula": "balance(start, rate, years, years)"},
            ]}}]),
        ("form", [{
            "type": "form", "title": "Trip", "fields": [
                {"id": "style", "label": "Style", "group": "The basics", "type": "select",
                 "options": [{"value": "easy", "label": "Easy", "note": "Beach, long lunches"}, "Full"],
                 "value": "easy"},
                {"id": "where", "label": "Where", "type": "text", "value": "Hills", "unit": "s"},
                {"id": "days", "label": "Days", "type": "number", "value": 3},
                {"id": "none"},
            ]}]),
        ("nested containers", [{
            "type": "section", "title": "Picks", "children": [
                {"type": "grid", "children": [
                    {"type": "heading", "text": "Left"},
                    {"type": "table", "columns": ["A"], "rows": [["1"]]},
                ]},
            ]},
            {"type": "tabs", "tabs": [
                {"label": "First", "children": [{"type": "text", "text": "one"}]},
                {"label": "Second", "children": [{"type": "stat", "label": "S", "value": 2}]},
                {"label": "", "children": [{"type": "text", "text": "no label tab"}]},
            ]},
            {"type": "row", "children": [{"type": "badge", "text": "b"}, {"type": "divider"}]},
        ]),
        ("section with no text inside", [{"type": "section", "title": "Quiet",
                                          "children": [{"type": "include", "id": "7f3a09bc"}]}]),
        ("too deep", _deep_board(7)),
        ("unknown and bad", [{"type": "mystery"}, {"text": "no type"},
                             {"type": "heading", "text": "kept after the junk"}]),
        ("nothing readable", [{"type": "divider"}, {"type": "unknown"}]),
        # --- current-main drift (offer #6 rebase onto #55): every feature that landed since the stack base ---
        ("source list kinds dates notes", [
            {"type": "source", "title": "Where this came from", "items": [
                {"label": "BLS", "url": "https://bls.gov", "kind": "web", "accessed": "2026-11-17", "note": "seasonal"},
                {"label": "ledger.csv", "kind": "file"},
                {"url": "https://no-label.org"},
            ]},
            {"type": "source", "items": [{"label": "Headlines only", "kind": "news"}]},
            {"type": "source", "text": "Trip ledger", "url": "https://led.gr"},
        ]),
        ("table structured kinds sources aggregates", [{
            "type": "table", "caption": "Q4", "filterable": True, "page": 1,
            "columns": [
                {"id": "h", "label": "Hotel", "kind": "text"},
                {"id": "p", "label": "Price", "kind": "currency", "unit": "¥"},
                {"id": "r", "label": "Rating", "kind": "percent"},
                {"id": "s", "label": "Sources", "kind": "sources"},
            ],
            "rows": [
                {"cells": {"h": {"text": "Kanra"}, "p": {"text": "¥42,000", "value": 42000},
                            "r": {"value": 92.5}},
                 "sources": [{"label": "booking"}, {"label": "hotel.site", "url": "https://h.site"}]},
                {"cells": {"h": {"text": "Hoshiya, JR"}, "p": {"text": "¥18,000", "value": 18000},
                            "r": {"text": "n/a"}},
                 "sources": []},
            ],
            "aggregates": [{"column": "p", "op": "sum", "label": "Total"}, {"column": "missing", "op": "max"}],
        }]),
        ("table nulls are unknown not zero", [{
            "type": "table", "columns": ["A", "B"], "rows": [[None, 0], ["x", None]],
        }]),
        ("chart scatter against title", [{
            "type": "chart", "kind": "scatter", "title": "Price against mileage", "unit": "₹L",
            "series": [{"name": "Petrol", "points": [
                {"x": 9, "y": 1.2}, {"x": 62, "y": 24.6, "label": "Fortuner"}, {"x": 30, "y": 9.9}]}],
        }, {
            "type": "chart", "kind": "scatter", "x": [1, 2, 3],
            "series": [{"name": "Samples", "data": [10, 14, 12]}],
        }]),
        ("chart waterfall bridge", [
            {"type": "chart", "kind": "waterfall", "title": "Cash flow", "unit": "€", "series": [{"points": [
                {"label": "Opening", "value": 2140, "total": True},
                {"label": "Salary", "value": 3200},
                {"label": "Rent", "value": -1450},
                {"label": "card"},
                {"label": "closing", "total": True},
            ]}]},
        ]),
        ("chart caveat and sorted bars", [
            {"type": "chart", "kind": "bar", "title": "Ties", "sortDesc": True, "x": ["A", "B", "C"],
             "series": [{"name": "Score", "data": [10, None, 30]}], "caveat": "Q3 onward is a projection."},
        ]),
        ("kpis previous and no data", [{"type": "kpis", "items": [
            {"label": "Margin", "value": 18.6, "unit": "%", "previous": 19.5},
            {"label": "Revenue", "value": 72275, "unit": "₹Cr", "previous": 70223},
            {"label": "Chargebacks", "value": None},
            {"label": "Flat", "value": 3, "previous": 3},
            {"label": "FromZero", "value": 70, "previous": 0},
            {"label": "Written", "value": 80, "change": -0.9, "change_unit": "pt"},
        ]}]),
        ("checklist states owners sources", [{"type": "checklist", "title": "Move", "items": [
            {"text": "Copy", "state": "active", "owner": "P"},
            {"text": "Verify", "state": "blocked", "note": "Waiting on storage"},
            {"text": "Boxes", "done": True},
            {"text": "Lift", "state": "done"},
            {"text": "Deposit", "sourceIds": ["a1b2c3d4", "e5f6a7b8", "01234567", "89abcdef0", "overflow"]},
            "Plain",
        ]}]),
        ("list value fields and bar", [{"type": "list", "ranked": True, "items": [
            {"title": "Kanra", "bar": 120000},
            {"title": "Unknown", "price": None},
            {"title": "Words", "value": "", "badge": "Iconic"},
            {"title": "Quiet", "bar": "nope"},
        ]}]),
        ("progress percent tones marks segments", [
            {"type": "progress", "title": "Server load", "value": 88, "goal": 100, "unit": "%",
             "thresholds": [{"at": 60, "tone": "good", "label": "OK"}, {"at": 85, "tone": "warning", "label": "Hot"},
                            {"at": 100, "tone": "danger", "label": "Full"}]},
            {"type": "progress", "title": "Sprint", "value": 60, "goal": 100, "show_percent": True,
             "segments": [{"label": "Done", "value": 40}, {"label": "Review", "value": 20}]},
            {"type": "progress", "title": "Half", "value": 14, "goal": 21.1, "unit": "km",
             "thresholds": [{"at": 10, "label": "10K"}, {"at": 21.1, "label": "Finish"}]},
        ]),
        ("calendar day and events", [
            {"type": "calendar", "date": "2026-11-14", "events": [
                {"title": "Farmers market", "start": "09:00", "end": "10:00", "place": "Ballard Ave NW"},
                {"title": "Flight", "start": "2026-11-14T18:30:00"},
            ]},
            {"type": "calendar", "date": "2026-02-30", "events": []},
            {"type": "calendar", "date": "14 Nov", "events": [{"title": "ignored", "start": "09:00"}]},
        ]),
        ("upnext rows", [{"type": "upnext", "items": [
            {"date": "2026-11-17", "title": "Emma's birthday"},
            {"date": "2026-11-18", "title": "Electricity bill", "amount": "₹1,420",
             "state": "overdue", "stateText": "1 day late"},
            {"title": "No date"},
        ]}]),
        ("weather one place", [
            {"type": "weather", "temp": 17.6, "place": "Pimpri Chinchwad",
             "condition": "Cloudy", "high": 30, "low": 16},
            {"type": "weather", "temp": 20, "place": "  "},
        ]),
    ]


def _corpus_entries():
    entries = []
    for name, board in _cases():
        assert isinstance(board, list), name
        entries.append({"name": name, "blocks": board,
                        "expected": tf.blocks_as_text(board, limit=None)})
    return entries


@pytest.mark.skipif(tf is None, reason="plugin package not loadable")
def test_corpus_pins_the_python_serializer():
    """The golden file agrees with the REAL serializer, case for case."""
    entries = _corpus_entries()
    if os.environ.get("GARZA_CORPUS_REGENERATE") == "1":
        CORPUS.write_text(json.dumps(entries, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        return
    stored = json.loads(CORPUS.read_text(encoding="utf-8"))
    assert stored == entries, (
        "markdown.corpus.json is stale — the TS port and the chat fallback would now disagree. "
        "If the serializer changed on purpose, regenerate deliberately: "
        "GARZA_CORPUS_REGENERATE=1 pytest tests/hooks/test_export_markdown_corpus.py")
