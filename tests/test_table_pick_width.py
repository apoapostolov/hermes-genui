# Real-browser layout regression for the interactive structured table: the search row, the tick column and the
# send word that tick-and-send adds on top of #41's structured card.
#
# jsdom never lays anything out, so this probe feeds headless Chrome the repo's OWN stylesheets (tokens, shared,
# table) and the DOM the shipped renderer draws (web/src/blocks/table/StructuredTable.tsx), and measures rects:
# - the TABLE is not squeezed by the feature: the grid and its first row measure the same in a card with no
#   controls, a plain filterable card, and an interactive one, to a hundredth of a pixel;
# - the interactive card is its table PLUS the tick column (bare card + tick column, to half a pixel). Opting in
#   may only cost the checkbox column: its tools row is pinned to the card (`width: 0; min-width: 100%`), so the
#   search field, the pill and the page buttons wrap inside the hug instead of widening it;
# - a plain filterable card keeps #41's geometry: its width is its tools row's, exactly as shipped, so this
#   feature restyles nothing a reader did not opt into;
# - the word a tap earns costs ZERO width: the card measured in silence measures the same with the longest
#   answer on it, that answer WRAPS (no nowrap, no ellipsis), and every word's own Range rect sits inside the
#   region's box. A card hugging a narrow table grows taller, never wider;
# - two negative controls keep both defect shapes measurable forever, each a scoped rule that is NOT shipped CSS:
#   an unpinned tools row widens the hug past the tick column, and a word kept on one line spills out of a narrow
#   card. If the shipped card ever matched one of those shapes, these numbers would say so.
# Skips only when no Chrome/Chromium binary exists on this machine. Window is 2000x1400: the board column is the
# 1100px reading cap, exactly where a table sits in a reply.
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "web" / "src"

CSS = [SRC / "styles" / "tokens.css", SRC / "styles" / "shared.css", SRC / "blocks" / "table" / "table.css"]

CHROME_CANDIDATES = [
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
    Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
    Path("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
    Path("/usr/bin/google-chrome"),
    Path("/usr/bin/chromium"),
    Path("/usr/bin/chromium-browser"),
]

BOARD_W = 1100.0  # the reply column's reading cap
LONGEST_WORD = "In the composer. Blocked from sending."  # the longest of the five answers: worst case for width
NARROW_CARD = 180.0  # a hug narrow enough that a one-line answer cannot fit

# Two shapes of the same table. The narrow one is the worst case: its table is narrower than a single control.
SHAPES = {
    "n2": (["Shop", "Spend"], [("A", "$1,200"), ("B", "$1,800")]),
    "n3": (["Phone", "Price", "Camera"],
           [("Pixel 10a", "$44,999", "Great camera"), ("Nothing 4", "$39,999", "OK")]),
}


def find_chrome() -> Path | None:
    env = os.environ.get("HB_CHROME")
    if env and Path(env).exists():
        return Path(env)
    for path in CHROME_CANDIDATES:
        if path.exists():
            return path
    for name in ("chrome", "google-chrome", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            return Path(found)
    return None


def near(a: float, b: float, tol: float = 0.5) -> bool:
    return abs(a - b) <= tol


def card(prefix: str, shape: str, interactive: bool = False, tools: bool = True, extra_class: str = "") -> str:
    """One structured card, drawn the way StructuredTable draws it. `tools=False` leaves the bare table: the
    reference width the feature is measured against."""
    heads, rows = SHAPES[shape]
    pick_head = '<th class="hb-pick" scope="col" aria-label="Select"></th>' if interactive else ""
    pick_cell = '<td class="hb-pick"><input type="checkbox" aria-label="Select row {first}"></td>'
    body = "\n".join(
        "<tr>{pick}".format(pick=pick_cell.format(first=row[0]) if interactive else "")
        + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>"
        for row in rows
    )
    pill = ('<button type="button" class="hb-pill hb-table-send" aria-label="Send 1 selected row to the chat">'
            '<span class="hb-pill-label">Send</span></button>') if interactive else ""
    tools_html = ""
    if tools:
        tools_html = f'''
  <div class="hb-table-tools" id="{prefix}-tools">
    <input type="search" id="{prefix}-filter" placeholder="Filter rows" aria-label="Filter rows">{pill}
    <div class="hb-table-pages" id="{prefix}-pages">
      <button type="button" aria-label="Previous page">&#8249;</button><span>Page 1 of 2</span>
      <button type="button" aria-label="Next page">&#8250;</button>
    </div>
  </div>'''
    status = (f'<div class="hb-table-status" role="status" aria-live="polite" id="{prefix}-status"></div>'
              if interactive else "")
    classes = "hb-card hb-table-card hb-table hb-table-structured"
    if interactive:
        classes += " hb-table-interactive"
    if extra_class:
        classes += f" {extra_class}"
    return f'''
<div class="{classes}" id="{prefix}-card">
  <table class="hb-table-grid" id="{prefix}-grid">
    <caption class="hb-table-caption">Spend</caption>
    <thead><tr>{pick_head}{''.join(f'<th>{h}</th>' for h in heads)}</tr></thead>
    <tbody>{body}</tbody>
  </table>{tools_html}
  {status}
</div>'''


def fixture_html() -> str:
    css = "\n".join(p.read_text(encoding="utf-8") for p in CSS)
    cards = []
    for shape in SHAPES:
        cards.append(card(f"{shape}-bare", shape, tools=False))
        cards.append(card(f"{shape}-plain", shape))
        cards.append(card(f"{shape}-picked", shape, interactive=True))
    # The defect shapes, each one scoped rule that is NOT shipped CSS.
    cards.append(card("neg-unpinned", "n2", interactive=True, extra_class="hb-neg-unpinned"))
    cards.append(card("neg-nowrap", "n2", interactive=True, extra_class="hb-neg-nowrap"))
    controls = f"""
/* NOT shipped CSS: the two defect shapes, kept measurable. */
.hb-neg-unpinned .hb-table-tools {{ width: auto; min-width: 0; }}    /* a tools row that widens the hug */
#neg-nowrap-card {{ width: {NARROW_CARD:.0f}px; }}                     /* a narrow hug */
#neg-nowrap-card .hb-table-status {{ white-space: nowrap; }}          /* a word that never wraps */
"""
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{css}\n{controls}</style></head>"
        f"<body style='margin:0'><div class='hb-blocks' data-root id='board'>{''.join(cards)}</div>"
        "<pre id='out' style='display:none'></pre>"
        f"<script>{measure_script()}</script></body></html>"
    )


def measure_script() -> str:
    return """
    const LONGEST = __LONGEST__;
    const px = (v) => Math.round(v * 100) / 100;
    const silent = {};
    const spoken = {};
    const cards = [...document.querySelectorAll(".hb-table-card")];
    for (const el of cards) {
      const grid = el.querySelector(".hb-table-grid");
      const tools = el.querySelector(".hb-table-tools");
      const pick = el.querySelector(".hb-pick");
      const first = el.querySelector("tbody tr");
      const r = el.getBoundingClientRect();
      silent[el.id] = {
        w: px(r.width), left: px(r.left), inner: el.clientWidth, border: el.clientLeft,
        content: px(r.width - el.clientLeft * 2),
        grid: px(grid.getBoundingClientRect().width), gridH: px(grid.getBoundingClientRect().height),
        rowH: px(first.getBoundingClientRect().height),
        tools: tools ? px(tools.getBoundingClientRect().width) : 0,
        toolsH: tools ? px(tools.getBoundingClientRect().height) : 0,
        pick: pick ? px(pick.getBoundingClientRect().width) : 0,
        filter: el.querySelector(".hb-table-tools input")
          ? px(el.querySelector(".hb-table-tools input").getBoundingClientRect().width) : 0,
      };
    }
    // The word, in the loudest state: the card is measured again with the longest answer on it.
    for (const el of cards) {
      const span = el.querySelector(".hb-table-status");
      if (!span) continue;
      span.textContent = LONGEST;
      const card = el.getBoundingClientRect();
      const box = span.getBoundingClientRect();
      const node = span.firstChild;
      const range = document.createRange();
      let outside = 0;
      let offset = 0;
      for (const word of LONGEST.split(" ")) {
        const start = LONGEST.indexOf(word, offset);
        offset = start + word.length;
        range.setStart(node, start);
        range.setEnd(node, start + word.length);
        for (const rect of range.getClientRects()) {
          if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5) outside += 1;
        }
      }
      spoken[el.id] = {
        card: px(card.width), cardLeft: px(card.left),
        spanLeft: px(box.left), spanRight: px(box.right), spanW: px(box.width), spanH: px(box.height),
        overflow: span.scrollWidth - span.clientWidth, outside,
      };
    }
    document.getElementById("out").textContent = JSON.stringify({ silent, spoken });
    """.replace("__LONGEST__", json.dumps(LONGEST_WORD))


@pytest.fixture(scope="module")
def m() -> dict:
    chrome = find_chrome()
    if chrome is None:
        pytest.skip("no Chrome/Chromium binary on this machine")
    with tempfile.TemporaryDirectory() as work:
        page = Path(work) / "probe.html"
        page.write_text(fixture_html(), encoding="utf-8")
        profile = Path(work) / "profile"
        profile.mkdir()
        cmd = [
            str(chrome), "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
            "--force-device-scale-factor=1", "--window-size=2000,1400", f"--user-data-dir={profile}",
            "--virtual-time-budget=2000", "--dump-dom", page.as_uri(),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        found = re.search(r'<pre id="out"[^>]*>(.*?)</pre>', proc.stdout, re.S)
        assert found, f"probe never reported; chrome said: {proc.stderr[-500:]}"
        import html as html_mod
        data = json.loads(html_mod.unescape(found.group(1)))
    assert data["silent"], "probe measured nothing"
    return data


class TestTheTableIsNotSqueezed:
    """Opting into tick-and-send may add a column and a row of controls. It may not redraw the table."""

    @pytest.mark.parametrize("shape", list(SHAPES))
    def test_the_grid_measures_the_same_in_all_three_cards(self, m, shape):
        bare = m["silent"][f"{shape}-bare-card"]
        for kind in ("plain", "picked"):
            card = m["silent"][f"{shape}-{kind}-card"]
            assert near(card["gridH"], bare["gridH"], 0.01), (kind, card, bare)
            assert near(card["rowH"], bare["rowH"], 0.01), (kind, card, bare)  # no cell wrapped

    @pytest.mark.parametrize("shape", list(SHAPES))
    def test_the_page_itself_is_untouched_by_the_feature(self, m, shape):
        assert m["silent"][f"{shape}-picked-card"]["w"] <= BOARD_W
        assert m["silent"][f"{shape}-picked-card"]["left"] == m["silent"][f"{shape}-bare-card"]["left"]


class TestTheTickColumnIsTheOnlyWidth:
    @pytest.mark.parametrize("shape", list(SHAPES))
    def test_the_interactive_card_is_the_bare_card_plus_the_tick_column(self, m, shape):
        bare = m["silent"][f"{shape}-bare-card"]["content"]
        picked = m["silent"][f"{shape}-picked-card"]["content"]
        column = m["silent"][f"{shape}-picked-card"]["pick"]
        assert near(picked - bare, column, 0.5), (shape, bare, picked, column)

    @pytest.mark.parametrize("shape", list(SHAPES))
    def test_the_tick_column_is_a_tick_column(self, m, shape):
        column = m["silent"][f"{shape}-picked-card"]["pick"]
        assert 10 <= column <= 45, column

    @pytest.mark.parametrize("shape", list(SHAPES))
    def test_the_controls_wrap_inside_the_hug_instead_of_widening_it(self, m, shape):
        card = m["silent"][f"{shape}-picked-card"]
        assert near(card["tools"], card["content"], 0.01), card
        # the search field keeps its own room by shrinking, never by pushing the card out
        assert card["filter"] <= card["content"] + 0.01, card

    def test_a_plain_filterable_card_keeps_the_geometry_it_ships(self, m):
        # #41's card is as wide as its tools row: this feature restyles nothing a reader did not opt into.
        plain = m["silent"]["n2-plain-card"]
        assert near(plain["tools"], plain["content"], 0.01), plain
        assert plain["content"] > m["silent"]["n2-bare-card"]["content"]  # the controls really are wider here

    def test_the_negative_control_measures_the_inflation_it_describes(self, m):
        # The "tools row keeps its own width" shape: same DOM, one scoped not-shipped rule. The card grows well
        # past the tick column, which is exactly what the shipped pin prevents.
        inflated = m["silent"]["neg-unpinned-card"]["content"]
        picked = m["silent"]["n2-picked-card"]["content"]
        assert inflated > picked + 20, (inflated, picked)


class TestTheWordCostsNoWidth:
    def test_the_card_measures_the_same_in_silence_and_with_its_longest_answer(self, m):
        assert near(m["spoken"]["n2-picked-card"]["card"], m["silent"]["n2-picked-card"]["w"], 0.01), m["spoken"]
        assert near(m["spoken"]["n3-picked-card"]["card"], m["silent"]["n3-picked-card"]["w"], 0.01), m["spoken"]

    def test_the_answer_wraps_inside_the_card_and_never_overflows(self, m):
        spoken = m["spoken"]["n2-picked-card"]
        assert spoken["overflow"] <= 0, spoken
        assert spoken["outside"] == 0, spoken
        assert spoken["spanH"] > 0, spoken  # laid out, so it can be read

    def test_the_answer_fills_the_card_it_was_given(self, m):
        spoken = m["spoken"]["n2-picked-card"]
        card = m["silent"]["n2-picked-card"]
        assert spoken["spanLeft"] >= card["left"] - 0.5, (spoken, card)
        assert spoken["spanRight"] <= card["left"] + card["w"] + 0.5, (spoken, card)

    def test_a_wider_card_answers_on_one_line_and_a_narrower_one_wraps(self, m):
        # The card is the table's width, whatever that is: the same sentence reflows, it is never clipped.
        narrow = m["spoken"]["n2-picked-card"]
        wide = m["spoken"]["n3-picked-card"]
        assert wide["spanW"] > narrow["spanW"], (narrow, wide)
        assert wide["outside"] == 0 and narrow["outside"] == 0, (narrow, wide)

    def test_the_negative_control_shows_the_clipped_word_this_check_catches(self, m):
        # The "kept on one line" shape: same DOM, one scoped not-shipped rule on a narrow hug. The measurement
        # that passes on the shipped card must fail here, so a regression cannot hide behind a green suite.
        clipped = m["spoken"]["neg-nowrap-card"]
        assert clipped["overflow"] > 0 or clipped["outside"] > 0, clipped
