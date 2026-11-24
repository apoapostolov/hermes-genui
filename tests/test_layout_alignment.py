# Real-browser layout regression for block placement: the model's `align` per block and the board's `text_align`
# word, drawn through the DOM the renderer grows (core/Blocks.tsx Placed()) and measured by headless Chrome.
#
# jsdom never lays anything out, so this test feeds Chrome the repo's own stylesheets and asserts real rects:
# - a placed card keeps its exact unplaced width (cross-axis auto margins must not collapse a capped card or
#   stop a flex-column child from stretching), and a centered card's margins come out SYMMETRIC;
# - a chart centers too: `.hb-chart { margin: 0 }` resets the host figure margin, and at equal class
#   specificity that reset vetoed the placement ask purely on load order — a centered capped chart sat flush
#   left (measured: 0 on the left, 380 on the right, of an 1100px column) while a calculator centered fine.
#   The placement rule compounds its two classes (.hb-place.hb-place-center) so the ask outranks every block
#   root reset; the centered chart must measure equal left and right margins here;
# - grid and row twins: a placed block inside a cell fills exactly like its unplaced twin (no shrink);
# - a placed kpis row: the ask moves the CARDS, not the box — the grid's auto-fill tracks collapse (auto-fit)
#   and the used ones gather symmetrically (center) or end at the edge (right), while the row keeps filling
#   its column and an unplaced row parks its cards flush left exactly as shipped (maintainer note 2);
# - text voice: `text_align` moves the WORDS (Range rects, not computed style) inside heading, text, stat and
#   callout without moving or resizing any box; a plain placement never implies a voice, and a callout opens
#   its shrink-wrapped body only under a voice;
# - negative controls keep every fixed defect shape measurable forever: a centered chart with the placement
#   margin cleared by an inline style (the cascade loss above), a callout body restored to its hug by a
#   scoped rule that is NOT repo CSS, and an attribute without its class.
# Skips only when no Chrome/Chromium binary exists on this machine.
import html
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
SRC = REPO / "web" / "src"
CSS = [
    SRC / "styles" / "tokens.css",
    SRC / "styles" / "shared.css",
    SRC / "blocks" / "layout" / "layout.css",
    SRC / "blocks" / "calculator" / "calculator.css",
    SRC / "blocks" / "chart" / "chart.css",
    SRC / "blocks" / "table" / "table.css",
    SRC / "blocks" / "source" / "source.css",
    SRC / "blocks" / "callout" / "callout.css",
    SRC / "blocks" / "atoms" / "atoms.css",
    SRC / "blocks" / "kpis" / "kpis.css",
]

CHROME_CANDIDATES = [
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    Path("/usr/bin/google-chrome"),
    Path("/usr/bin/chromium"),
    Path("/usr/bin/chromium-browser"),
]


def find_chrome() -> Path | None:
    env = os.environ.get("HB_CHROME")
    if env and Path(env).exists():
        return Path(env)
    for name in ("chrome", "google-chrome", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            return Path(found)
    for cand in CHROME_CANDIDATES:
        if cand.exists():
            return cand
    return None


CHROME = find_chrome()


def place(word: str, inner: str, id_: str = "") -> str:
    tag = f' id="{id_}"' if id_ else ""
    return f'<div class="hb-place hb-place-{word}"{tag} data-align="{word}">{inner}</div>'


def ta(word: str, inner: str, id_: str = "") -> str:
    """A text voice alone: the wrapper the frozen renderer grows when only `text_align` asks (no position)."""
    tag = f' id="{id_}"' if id_ else ""
    return f'<div class="hb-place hb-ta-{word}"{tag} data-text-align="{word}">{inner}</div>'


def ta_both(pos: str, word: str, inner: str, id_: str = "") -> str:
    """Both voices on the one wrapper: the card sits at `pos`, its words read at `word`."""
    return (f'<div class="hb-place hb-place-{pos} hb-ta-{word}" id="{id_}" '
            f'data-align="{pos}" data-text-align="{word}">{inner}</div>')


def calc(id_: str) -> str:
    return f'<div class="hb-card hb-calc" id="{id_}">Example</div>'


def text(id_: str) -> str:
    return f'<div class="hb-text" id="{id_}">A prose block long enough to fill a wide column of the chat.</div>'


def table(id_: str) -> str:
    rows = "<tr><td>City</td><td>Deg</td></tr><tr><td>Rome</td><td>21</td></tr>"
    return f'<div class="hb-card hb-table-card" id="{id_}"><table>{rows}</table></div>'


def wide_chart(id_: str) -> str:
    return f'<figure class="hb-card hb-chart hb-chart-wide" id="{id_}">Long line</figure>'


def capped_chart(id_: str, extra: str = "") -> str:
    """A chart exactly as the frozen renderer draws the short-line case: a figure card capped at 720."""
    style = f' style="{extra}"' if extra else ""
    return f'<figure class="hb-card hb-chart" id="{id_}"{style}><div class="hb-chart-head">Sales</div></figure>'


def grid(id_: str, cells: list[str]) -> str:
    inner = "".join(f'<div class="hb-grid-cell">{c}</div>' for c in cells)
    return f'<div class="hb-grid" id="{id_}">{inner}</div>'


def stat_card(base: str) -> str:
    """A lone stat exactly as the frozen renderer draws it: a card whose column-flex lines stretch across it."""
    return (f'<div class="hb-card hb-kpi" id="{base}-box">'
            f'<div class="hb-kpi-label">Revenue</div>'
            f'<div class="hb-kpi-value" id="{base}-value" data-word>12.4M</div></div>')


def callout(base: str, words: str = "Short note") -> str:
    """A callout as the frozen renderer draws it: tinted box, fixed icon, flex body beside it. The body is the
    text-bearing line box; it hugs its words unless the voice opens it (round 5)."""
    icon = '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"></svg>'
    return (f'<div class="hb-callout hb-callout-info" id="{base}-box">'
            f'<span class="hb-callout-icon" id="{base}-icon">{icon}</span>'
            f'<div class="hb-callout-body" id="{base}-body">'
            f'<div id="{base}-words" data-word>{words}</div></div></div>')


def kpis_row(base: str, extra: str = "") -> str:
    """A kpis row as the frozen renderer draws it: a grid of identical cards (auto-fill tracks, min 130 max 200).
    The cards are the thing the ask must move — the grid box itself fills its column, placed or not."""
    style = f' style="{extra}"' if extra else ""
    cards = "".join(
        f'<div class="hb-kpi" id="{base}-c{i}">'
        f'<div class="hb-kpi-label">Revenue</div><div class="hb-kpi-value">12.4M</div></div>'
        for i in (1, 2, 3))
    return f'<div class="hb-kpis" id="{base}"{style}>{cards}</div>'


CO_LONG = ("A note long enough to wrap: it must break across at least two lines inside the opened body, "
           "so every line shows a line box and not a hug of one tight word.")


def measure_script() -> str:
    return """
    const roots = [...document.querySelectorAll("[data-root]")];
    const out = roots.map((root) => {
      const rb = root.getBoundingClientRect();
      const els = [root, ...root.querySelectorAll("[id]")];
      const rows = els.map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.id} ${r.width.toFixed(3)} ${(r.left - rb.left).toFixed(3)} ${r.height.toFixed(3)} ` +
          `${getComputedStyle(el).textAlign}`;
      });
      // : the words themselves. A Range over a text-bearing element answers with one rect per line
      // fragment; the first is where the words actually sit, in real layout, not in computed style.
      for (const el of root.querySelectorAll("[data-word]")) {
        const rng = document.createRange();
        rng.selectNodeContents(el);
        const r = rng.getClientRects()[0];
        const w = r ?? {width: 0, left: rb.left, height: 0};
        rows.push(`word-${el.id} ${w.width.toFixed(3)} ${(w.left - rb.left).toFixed(3)} ` +
          `${w.height.toFixed(3)} ${getComputedStyle(el).textAlign}`);
      }
      return rows;
    }).flat();
    document.getElementById("out").textContent = out.join("\\n");
    """


def fixture_html() -> str:
    css = "\n".join(p.read_text() for p in CSS)
    board = f"""
    <div class="hb-blocks" data-root id="wide">
      {calc("calc-left")}
      {place("center", calc("calc-center"))}
      {place("right", calc("calc-right"))}
      {text("prose-left")}
      {place("center", text("prose-center"))}
      {place("right", text("prose-right"))}
      {wide_chart("chart-left")}
      {place("center", wide_chart("chart-center"))}
      {capped_chart("chart-plain")}
      {place("center", capped_chart("chart-centered"))}
      {place("right", capped_chart("chart-right"))}
      {place("center", capped_chart("chart-neg", "margin-inline: 0"))}
      {table("table-left")}
      {place("center", table("table-center"))}
      {place("right", table("table-right"))}
      {ta("center", text("prose-ta-center"), "prose-ta-center-place")}
      {ta("right", text("prose-ta-right"), "prose-ta-right-place")}
      {ta_both("right", "center", text("prose-pos-right-ta-center"), "prose-both-place")}
      {place("center", text("prose-plain-inside"), "prose-plain-inside-place")}
      {kpis_row("kpis-plain")}
      {place("center", kpis_row("kpis-center"))}
      {place("right", kpis_row("kpis-right"))}
      {place("center", kpis_row("kpis-neg", "grid-template-columns: repeat(auto-fill, minmax(130px, 200px)); "
                                "justify-content: start"))}
    </div>
    """
    # Surviving containers: a grid places its children without touching its cells (paired grids compare placed
    # against unplaced at identical geometry), and a row's placed child stretches like its direct sibling.
    plain = '<div class="hb-card hb-calc" id="row-plain">Example<br>Another line<br>And one more</div>'
    nested = f"""
    {grid("grid-a", [calc("a1"), calc("a2")])}
    {grid("grid-b", [place("center", calc("b1")), place("center", calc("b2"))])}
    {grid("grid-c", [capped_chart("gc1"), capped_chart("gc2")])}
    {grid("grid-d", [place("center", capped_chart("gd1")), place("center", capped_chart("gd2"))])}
    <div class="hb-row" data-root id="row">
      <div class="hb-row-cell">{place("center", calc("row-placed"))}</div>
      <div class="hb-row-cell">{plain}</div>
    </div>
    """
    nested_board = f'<div class="hb-blocks" data-root id="nested">{nested}</div>'
    # A narrow container: the cap clamps below the board width; nothing shrinks and nothing shifts.
    narrow = f"""
    <div style="width: 360px">
      <div class="hb-blocks" data-root id="narrow">
        {calc("narrow-left")}
        {place("center", calc("narrow-center"))}
        {place("right", calc("narrow-right"))}
      </div>
    </div>
    """
    ctrl = """
    <div class="hb-blocks" data-root id="ctrl" style="width:800px">
      <div class="hb-place" data-text-align="center" id="ta-attr-only">
        <div class="hb-text" id="ta-attr-inside">Attribute without its class must read left.</div>
      </div>
    </div>
    """
    neg_css = ""
    # the voice measured on the words, every text-bearing kind the renderer applies it to, at the
    # Reviewer's 800px board with SHORT words — a hug is only visible when the words are short. Left asks sit
    # bare (the frozen renderer grows no wrapper for left), center/right through the one voice wrapper.
    voice = f"""
    <div class="hb-blocks" data-root id="voice" style="width:800px">
      <div class="hb-heading" id="v-head-l" data-word>Quarterly note</div>
      {ta("center", '<div class="hb-heading" id="v-head-c" data-word>Quarterly note</div>', "v-head-c-place")}
      {ta("right", '<div class="hb-heading" id="v-head-r" data-word>Quarterly note</div>', "v-head-r-place")}
      <div class="hb-text" id="v-text-l" data-word>Short note</div>
      {ta("center", '<div class="hb-text" id="v-text-c" data-word>Short note</div>', "v-text-c-place")}
      {ta("right", '<div class="hb-text" id="v-text-r" data-word>Short note</div>', "v-text-r-place")}
      {stat_card("v-stat-l")}
      {ta("center", stat_card("v-stat-c"), "v-stat-c-place")}
      {ta("right", stat_card("v-stat-r"), "v-stat-r-place")}
      {callout("v-co-l")}
      {ta("center", callout("v-co-c"), "v-co-c-place")}
      {ta("right", callout("v-co-r"), "v-co-r-place")}
      {ta("center", callout("v-co-long", CO_LONG), "v-co-long-c-place")}
    </div>
    """
    # The negative control keeps THIS round's defect measurable forever: the shipped callout markup under a
    # scoped rule that is NOT shipped CSS — the body's pre-fix hug restored. The class computes "center" and
    # the words stay parked beside the icon: exactly what a review measured (body == text width at 800px).
    neg_voice = f"""
    <div class="hb-blocks" data-root id="neg-voice" style="width:800px">
      {callout("neg-co-l")}
      {ta("center", callout("neg-co-c"), "neg-co-c-place")}
    </div>
    """
    neg_css += "\n#neg-voice .hb-callout-body { flex: 0 1 auto; }\n"
    body = board + nested_board + narrow + ctrl + voice + neg_voice
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{css}\n{neg_css}</style></head>"
        f"<body style='margin:0;width:1200px'>{body}"
        "<pre id='out' style='display:none'></pre>"
        f"<script>{measure_script()}</script></body></html>"
    )


@pytest.fixture(scope="module")
def report() -> dict[str, tuple[float, float, float, str]]:
    if CHROME is None:
        pytest.skip("no Chrome/Chromium binary on this machine")
    with tempfile.TemporaryDirectory() as work:
        page = Path(work) / "probe.html"
        page.write_text(fixture_html())
        profile = Path(work) / "profile"
        profile.mkdir()
        cmd = [
            str(CHROME), "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
            "--force-device-scale-factor=1", f"--user-data-dir={profile}",
            "--virtual-time-budget=2000", "--dump-dom", f"file://{page}",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        m = re.search(r"<pre id=\"out\"[^>]*>(.*?)</pre>", proc.stdout, re.S)
        assert m, f"probe never reported; chrome said: {proc.stderr[-400:]}"
        text = html.unescape(m.group(1)).strip()
    out: dict[str, tuple[float, float, float, str]] = {}
    for line in text.splitlines():
        bits = line.split()
        assert len(bits) == 5, line
        out[bits[0]] = (float(bits[1]), float(bits[2]), float(bits[3]), bits[4])
    return out


@pytest.fixture(scope="module")
def rects(report) -> dict[str, tuple[float, float, float]]:
    """id → (width, left edge, height), as Chrome measured them."""
    return {k: v[:3] for k, v in report.items()}


@pytest.fixture(scope="module")
def aligns(report) -> dict[str, str]:
    """id → getComputedStyle().textAlign, as Chrome resolved it."""
    return {k: v[3] for k, v in report.items()}


def near(a: float, b: float, eps: float = 1.0) -> bool:
    return abs(a - b) <= eps


class TestPlacementSizing:
    """The reviewer's repro: a placed card must keep the width it had unplaced, at every word and every width."""

    def test_capped_card_keeps_720_at_left_center_right(self, rects):
        w, x, _ = rects["calc-left"]
        assert near(w, 720.0), w
        assert near(x, 0.0), x
        w, x, _ = rects["calc-center"]
        assert near(w, 720.0), w          # NOT ~58.875: the content width never replaces the cap
        assert near(x, (1100.0 - 720.0) / 2), x
        w, x, _ = rects["calc-right"]
        assert near(w, 720.0), w
        assert near(x + w, 1100.0), x + w  # hugs the right edge

    def test_full_width_prose_and_wide_chart_unaffected(self, rects):
        for id_ in ("prose-left", "prose-center", "prose-right"):
            w, x, _ = rects[id_]
            assert near(w, 1100.0), (id_, w)      # NOT ~30px: stretched blocks stay the column width
            assert near(x, 0.0), (id_, x)
        w, x, _ = rects["chart-center"]
        assert near(w, 1100.0), w
        assert near(x, 0.0), x

    def test_fit_content_table_keeps_hugging_and_shifts(self, rects):
        w0, x0, _ = rects["table-left"]
        w, x, _ = rects["table-center"]
        assert near(w, w0), (w, w0)                # hugging is its width; placing must not fatten or shrink it
        assert x > x0, (x, x0)
        w, x, _ = rects["table-right"]
        assert near(w, w0), w
        assert near(x + w, 1100.0), x + w

    def test_nested_grid_places_children_at_cell_width(self, rects):
        # Two identical grids; in grid-b every cell's block is placed center. Cells must be where they were and the
        # placed card as wide as the unplaced one — a place inside a cell sizes exactly like the cell did before.
        for a, b in (("a1", "b1"), ("a2", "b2")):
            assert near(rects[b][0], rects[a][0]), (b, rects[b][0], rects[a][0])
        for cell_a, cell_b in (("grid-a", "grid-b"),):
            assert near(rects[cell_b][0], rects[cell_a][0]), cell_b

    def test_row_cell_stretch_survives_a_place(self, rects):
        wp, xp, hp = rects["row-placed"]
        wu, xu, hu = rects["row-plain"]
        assert near(wp, wu), (wp, wu)   # same cell width both cells share
        assert near(hp, hu), (hp, hu)   # flex:1 reached through the place: heights end together

    def test_kpis_row_moves_its_cards_when_placed(self, rects):
        # Sagar's note 2: align:center on a kpis row had no visible effect — the row is a grid that fills its
        # column, and auto-fill tracks park the cards left; no auto margin can move a box that wide. Placed,
        # the empty tracks collapse and the used ones gather symmetrically off the edge; unplaced, the row
        # sits exactly where it has always sat.
        col = rects["wide"][0]

        def span(base: str) -> tuple[float, float]:
            return rects[f"{base}-c1"][1], rects[f"{base}-c3"][1] + rects[f"{base}-c3"][0]

        # default: first card hugs the column's left (the shipped output, untouched by the fix)
        x0, r0 = span("kpis-plain")
        assert near(x0, 0.0), x0
        assert r0 < col - 20, (r0, col)  # the row left space on its right — cards genuinely park left
        # center: the same span width (the cards never resized), gathered symmetrically off the edges
        x1, r1 = span("kpis-center")
        assert near(r1 - x1, r0 - x0), (r1 - x1, r0 - x0)
        assert x1 > 20, x1
        assert near(x1, col - r1, 2.0), (x1, col - r1)
        # right: the cards end at the column's right edge
        x2, r2 = span("kpis-right")
        assert near(r2, col, 1.0), (r2, col)
        assert x2 > 20, x2
        # the grid box keeps filling the column placed or not — the wrapper fills width, the CARDS moved
        for base in ("kpis-plain", "kpis-center", "kpis-right"):
            assert near(rects[base][0], col), (base, rects[base][0])

    def test_negative_control_auto_fill_tracks_park_the_cards_despite_the_ask(self, rects):
        # The defect shape stays measurable forever: with the fix's whole mechanism cleared inline (auto-fill
        # tracks restored and the used ones pinned to the start — not shipped CSS), the centered ask does
        # nothing again — cards park flush left under the place class, exactly as the maintainer measured.
        x = rects["kpis-neg-c1"][1]
        r = rects["kpis-neg-c3"][1] + rects["kpis-neg-c3"][0]
        col = rects["wide"][0]
        assert near(x, 0.0), x
        assert r < col - 20, (r, col)

    def test_narrow_container_places_without_shrinking(self, rects):
        w0, x0, _ = rects["narrow-left"]
        assert near(w0, 360.0), w0      # cap above board width: the block fills 360
        for id_ in ("narrow-center", "narrow-right"):
            w, x, _ = rects[id_]
            assert near(w, 360.0), (id_, w)
            assert near(x, x0), (id_, x)  # no free space to share: nothing moves, nothing shrinks


class TestChartPlacement:
    """Round 6: a card's own margin reset must not silently veto placement. `.hb-chart` resets
    its root margin (the host's prose styles give a figure one), and at equal class specificity that reset
    won the cascade purely by load order — so a chart asked to sit centered rendered flush LEFT while a
    calculator centered fine. These assertions measure the ask in real Chrome rects, and the inline-style
    control keeps the exact defect shape (cap kept, margin gone) measurable forever."""

    def test_left_chart_sits_where_left_is_drawn(self, rects):
        w, x, _ = rects["chart-plain"]
        assert near(w, 720.0), w          # the cap stands at left, as it always did
        assert near(x, 0.0), x

    def test_capped_chart_centers_with_symmetric_margins(self, rects):
        w, x, _ = rects["chart-centered"]
        assert near(w, 720.0), w                      # centering must never shrink the card off its cap
        left = x - rects["chart-plain"][1]
        right = 1100.0 - (x + w)
        assert near(left, right, 1.0), (left, right)  # symmetric by the rects Chrome measured
        assert left > 100.0, left                     # the card really travelled, not merely computed

    def test_right_placed_chart_hugs_the_right_edge(self, rects):
        w, x, _ = rects["chart-right"]
        assert near(w, 720.0), w
        assert near(x + w, 1100.0), (w, x)

    def test_negative_control_a_cleared_margin_parks_the_chart_left(self, rects):
        # Same wrapper, same shipped markup, one inline style that is NOT repo CSS: the placement margin
        # removed. The card keeps its cap and sits flush left — exactly the pre-fix shape. If a centered
        # chart ever measures the same way again, the auto margin died in the cascade and this probe is
        # the witness.
        w, x, _ = rects["chart-neg"]
        assert near(w, 720.0) and near(x, 0.0), (w, x)
        assert rects["chart-centered"][:2] != pytest.approx((720.0, 0.0), abs=1.0)

    def test_charts_in_cells_fill_exactly_like_their_unplaced_twins(self, rects):
        # Grid cells are flex columns: a center ask inside a cell has no leftover space to share out, so
        # it must never collapse the card to its content (the reviewer's original shrink defect class).
        for bare, placed in (("gc1", "gd1"), ("gc2", "gd2")):
            wb, xb, _ = rects[bare]
            wp, xp, _ = rects[placed]
            assert near(wp, wb), (placed, wp, wb)
            assert near(xp, xb), (placed, xp, xb)


class TestTextVoice:
    """`text_align` moves the words inside a text block and nothing else: the voice is computed
    from the repo's own cascade, measured by Chrome — and the box around it keeps exactly the width and place
    placement gave it, so the two rules cannot trade damage."""

    def test_a_text_voice_reads_at_its_word_and_keeps_the_column(self, rects, aligns):
        for word in ("center", "right"):
            w, x, _ = rects[f"prose-ta-{word}-place"]
            assert near(w, 1100.0), (word, w)        # the wrapper fills the column exactly like an unplaced prose line
            assert near(x, 0.0), (word, x)           # the voice moves no box
            assert aligns[f"prose-ta-{word}-place"] == word
            assert aligns[f"prose-ta-{word}"] == word  # and the words inherit it

    def test_position_and_voice_share_one_box_without_disturbing_each_other(self, rects, aligns):
        w, x, _ = rects["prose-both-place"]
        assert near(w, 1100.0), w                    # a prose box fills its column at any position word
        assert near(x, 0.0), x
        assert aligns["prose-both-place"] == "center"
        assert aligns["prose-pos-right-ta-center"] == "center"

    def test_plain_placement_never_implies_a_voice(self, rects, aligns):
        # A card placed center still reads its words left: the two asks are separate rules.
        assert aligns["prose-plain-inside-place"] in ("start", "left")
        assert aligns["prose-plain-inside"] in ("start", "left")
        w, x, _ = rects["prose-plain-inside-place"]
        assert near(w, 1100.0) and near(x, 0.0), (w, x)

    def test_negative_control_an_attribute_without_its_class_reads_default(self, aligns):
        # The probe resolves real CSS: the data-text-align mark on its own moves nothing. If these ever
        # report "center", the test is reading markup, not the cascade — same trick as the shrink-wrap control.
        assert aligns["ta-attr-only"] in ("start", "left")
        assert aligns["ta-attr-inside"] in ("start", "left")


class TestVoiceWords:
    """: the voice is measured on the WORDS, not on computed style. A text-align over a shrink-wrapped
    flex body computes "center" while every word stands still beside the icon — the defect this round fixes.
    Every text-bearing kind (heading, text, stat, callout) gets short words at left/center/right on an 800px
    board, and each assertion reads the Range rect of the first line Chrome actually laid out."""

    # (left, center, right) ids of each kind's data-word element: the line box the words fill.
    LINE_BOXES = [
        ("v-head-l", "v-head-c", "v-head-r"),
        ("v-text-l", "v-text-c", "v-text-r"),
        ("v-stat-l-value", "v-stat-c-value", "v-stat-r-value"),
        ("v-co-l-words", "v-co-c-words", "v-co-r-words"),
    ]

    def test_words_land_where_the_voice_put_them(self, rects):
        for lid, cid, rid in self.LINE_BOXES:
            for ask, el in (("left", lid), ("center", cid), ("right", rid)):
                cw, cx, _ = rects[el]              # the element's own box: the line box to distribute across
                ww, wx, _ = rects[f"word-{el}"]    # the first line of the words inside it
                if ask == "left":
                    assert near(wx, cx, 2.5), (el, wx, cx)
                elif ask == "center":
                    assert ww < cw - 40.0, (el, ww, cw)   # short words in a line box wide enough to centre
                    assert near(wx + ww / 2, cx + cw / 2, 2.5), (el, wx, ww, cx, cw)
                else:
                    assert ww < cw - 40.0, (el, ww, cw)
                    assert near(wx + ww, cx + cw, 2.5), (el, wx, ww, cx, cw)

    def test_the_voice_moves_the_words_and_no_box(self, rects):
        for lid, cid, rid in self.LINE_BOXES:
            _, lx, _ = rects[f"word-{lid}"]
            _, cx, _ = rects[f"word-{cid}"]
            _, rx, _ = rects[f"word-{rid}"]
            assert cx > lx + 200.0, (lid, cx, lx)   # the words actually travelled, not merely computed
            assert rx > cx + 100.0, (rid, rx, cx)
        # and the voice never touched a box: every wrapper fills the board exactly like a bare block did.
        for wrapper in ("v-head-c", "v-head-r", "v-text-c", "v-text-r", "v-stat-c", "v-stat-r",
                        "v-co-c", "v-co-r", "v-co-long-c"):
            w, x, _ = rects[f"{wrapper}-place"]
            assert near(w, 800.0), (wrapper, w)
            assert near(x, 0.0), (wrapper, x)

    def test_the_callout_opens_its_body_for_the_voice_without_moving_icon_or_box(self, rects):
        bw0, bx0, _ = rects["v-co-l-body"]
        assert bw0 < 100.0, bw0                    # no ask: the body hugs its words exactly as it always did
        w, x, _ = rects["v-co-c-body"]
        assert w > 500.0, w                        # the voice opens the row: a line box, not a hug
        assert near(x, bx0, 0.5), (x, bx0)         # opened to the right, never pushing the body off the icon
        w, x, _ = rects["v-co-r-body"]
        assert w > 500.0, w
        for suffix in ("l", "c", "r"):
            assert rects[f"v-co-{suffix}-box"][:3] == pytest.approx(rects["v-co-l-box"][:3], abs=0.5)
        for suffix in ("c", "r"):                  # the icon: same rect at every word — it is the fixed mark
            assert rects[f"v-co-{suffix}-icon"][:3] == pytest.approx(rects["v-co-l-icon"][:3], abs=0.5)

    def test_a_default_callout_measures_exactly_like_the_pre_fix_shape(self, rects):
        # The fix is scoped to the voice classes; a callout nobody asked about keeps every rect it had. The
        # left asks inside the defect control are that pre-fix shape drawn with the very same shipped rule:
        # identical widths and edges, word for word, box and body alike.
        assert rects["v-co-l-body"][:3] == pytest.approx(rects["neg-co-l-body"][:3], abs=0.5)
        assert rects["v-co-l-box"][:3] == pytest.approx(rects["neg-co-l-box"][:3], abs=0.5)
        assert rects["word-v-co-l-words"][:3] == pytest.approx(rects["word-neg-co-l-words"][:3], abs=0.5)

    def test_long_words_center_line_by_line(self, rects):
        # A wrapped note centered: its first line is a line, not a tight hug, and it sits in the body's middle.
        ww, wx, _ = rects["word-v-co-long-words"]
        bw, bx, _ = rects["v-co-long-body"]
        assert ww > 300.0, ww                      # it wrapped: a long first line
        assert near(wx + ww / 2, bx + bw / 2, 2.5), (wx, ww, bx, bw)

    def test_negative_control_a_hugged_body_parks_the_words_despite_the_class(self, rects, aligns):
        # The defect of this round, kept measurable forever: the shipped callout under the scoped NOT-shipped
        # hug. The class computes "center" — and it means nothing: body == text width, words exactly where the
        # left ask put them, not one pixel moved. If these numbers ever match the fixed callout above, this
        # probe has stopped reading real geometry.
        assert aligns["neg-co-c-body"] == "center"
        bw, bx, _ = rects["neg-co-c-body"]
        ww, wx, _ = rects["word-neg-co-c-words"]
        assert bw < 100.0, bw                      # the hug: the body is only as wide as its words
        assert near(ww, bw, 1.5), (ww, bw)         # body width == word width: no line box exists
        assert near(wx, bx, 1.5), (wx, bx)         # words at the body's left edge, beside the icon
        assert near(wx, rects["word-neg-co-l-words"][1], 1.0)  # NOT one pixel from where left sits
        fw, fx, _ = rects["neg-co-c-place"]
        assert near(fw, 800.0) and near(fx, 0.0)   # the wrapper still fills: only the body refused to open
