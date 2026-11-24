# Real-browser layout regression for the interactive table (t_b2ea89cc, enhancement #3).
#
# The claim to test lives in real layout, not jsdom: adding the filter UI must not change what a table card
# measures. The card keeps hugging its columns (fit-content), the controls row costs it ZERO width (it fills
# the card via width:0 + min-width:100% instead of contributing its own), the tick column is the only added
# width, and a filtered table keeps the same hug. One negative control keeps the defect shape measurable
# forever: the same DOM with a naive tools row (plain auto width, NOT shipped CSS) inflates the card far past
# the table — if the shipped rule ever regresses to that shape, this probe reads geometry, not markup.
#
# The SECOND claim (review round 3): the send-outcome word is FULLY READABLE on the narrowest hugging card.
# The old clip shape (nowrap + ellipsis) cut "Blocked…" off mid-sentence exactly where the recovery
# instruction lives; the shipped span WRAPS instead. The probe measures real layout: scrollWidth vs
# clientWidth, and every word's own range rect sitting fully inside the span's box. Its negative control
# keeps that defect shape measurable too: the same DOM restyled to the old clip rule truncates — so if the
# readability assertions ever go soft, the control reddens with them.
#
# Fixture DOM mirrors exactly what Table.tsx draws for a plain vs interactive table (ids added to measure),
# over the repo's own shipped stylesheets, in a 2000x1400 window so the 1100px board cap is never the clamp.
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
SRC = REPO / "web" / "src"

# The repo's own shipped stylesheets, in load order — the same set every real-browser probe in this
# suite family feeds Chrome. Self-contained: no cross-test imports to lean on.
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


def cells(rows: list[tuple[str, str]]) -> str:
    out = []
    for r, (name, price) in enumerate(rows):
        out.append(
            f"<tr><td class=\"hb-first\">{name}</td><td class=\"hb-num\">{price}</td></tr>"
        )
    return "".join(out)


def static_table(p: str, rows: list[tuple[str, str]] | None = None) -> str:
    """A plain table exactly as the shipped component draws it with no interactive word."""
    rows = rows or [("Pixel 10a", "₹44,999"), ("Nothing 4", "₹39,999"), ("Galaxy A56", "₹42,999")]
    return (
        f'<div class="hb-card hb-table-card" id="{p}-card"><div class="hb-table-scroll">'
        f'<table class="hb-table" id="{p}-table"><thead><tr>'
        f'<th class="hb-first"><button type="button"><span>Phone</span>'
        f'<span class="hb-sort" aria-hidden="true">↕</span></button></th>'
        f'<th class="hb-num"><button type="button"><span>Price</span>'
        f'<span class="hb-sort" aria-hidden="true">↕</span></button></th>'
        f"</tr></thead><tbody>{cells(rows)}</tbody></table></div></div>"
    )


def interactive_table(p: str, rows: list[tuple[str, str]] | None = None, status: str = "") -> str:
    """The same table with the interactive chrome: tools row above the rows, a tick column beside them.

    The tools row carries the live-region span the component always renders; `status` fills it the way a
    send's feedback does ("Sent to chat." / "Blocked from sending — in the composer — press Send.")."""
    rows = rows or [("Pixel 10a", "₹44,999"), ("Nothing 4", "₹39,999"), ("Galaxy A56", "₹42,999")]
    row_html = "".join(
        f'<tr><td class="hb-pick"><input type="checkbox" aria-label="Select row {name}"/></td>'
        f'<td class="hb-first">{name}</td><td class="hb-num">{price}</td></tr>'
        for name, price in rows
    )
    return (
        f'<div class="hb-card hb-table-card hb-table-interactive" id="{p}-card">'
        f'<div class="hb-table-tools" id="{p}-tools">'
        f'<input type="search" class="hb-table-filter" id="{p}-filter" aria-label="Filter rows" '
        f'placeholder="Filter rows" value=""/>'
        f'<button type="button" class="hb-pill" id="{p}-pill" aria-label="Send selected rows as context" disabled>'
        f'<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"></svg>'
        f'<span class="hb-pill-label">Send selected as context</span></button>'
        f'<span class="hb-table-sent" role="status" aria-live="polite" id="{p}-sent">{status}</span></div>'
        f'<div class="hb-table-scroll"><table class="hb-table" id="{p}-table"><thead><tr>'
        f'<th class="hb-pick" id="{p}-pick" aria-label="Selected rows"></th>'
        f'<th class="hb-first"><button type="button"><span>Phone</span>'
        f'<span class="hb-sort" aria-hidden="true">↕</span></button></th>'
        f'<th class="hb-num"><button type="button"><span>Price</span>'
        f'<span class="hb-sort" aria-hidden="true">↕</span></button></th>'
        f"</tr></thead><tbody>{row_html}</tbody></table></div></div>"
    )


BLOCKED = "Blocked from sending — in the composer — press Send."
DRAFTED = "In the composer — press Send."
FAILED = "Send failed — nothing was sent or kept."
SENT_OK = "Sent to chat."
# The status spans the clip report measures, in the fixture's id form.
PROBED = ("s-sent", "d-sent", "f-sent", "k-sent", "x-sent")




# ---- Review round 2 (offer #3): structured tables must compute IDENTICALLY to base ----------------
# Both table families draw a tools row with class .hb-table-tools, so an unscoped interactive rule
# leaks into the already-shipped structured tables. The claim proven here is the reviewer's, made in
# real Chrome: the SAME structured filter/pagination DOM, once fed the repo's shipped sheet set and
# once fed the sheet set with web/src/blocks/table/table.css EXACTLY as merged at base 1617ba7e (blob
# b5d8fd9e0994b639eb8559c963fdc2c51a1c5c75; the constant below is its exact bytes, and a companion test
# hashes it back to sha256 35ac76279c6a36301be34c3a18d82c9a03f30c2a9fd428df3712edb91f287dcb), must agree
# element by element, property by property, in getComputedStyle — rendered layout included (used width of
# card, tools and pages rides along in `width`). Every other sheet is untouched by the offer, so the
# swap is exact. The CSS is packed into adjacent literals only to keep every physical line inside the
# project's 120-column gate; concatenation is byte-exact (that is what the digest test proves).
BASE_TABLE_CSS = (
    "/* Tables */\n/* A table keeps its natural width (columns close together); the card hugs it. It scro"
    "lls inside the card: sideways\n   when wider than the chat, down past 520px with the header kept in "
    "view. */\n.hb-table-card { width: fit-content; max-width: 100%; padding: 4px 0 0; overflow: hidden; "
    "}\n.hb-table-caption { padding: 10px 16px 2px; }\n.hb-table-scroll { max-height: 520px; overflow: au"
    "to; }\n.hb-table {\n  border-collapse: separate;\n  border-spacing: 0;\n  font-size: 13.5px;\n  line"
    "-height: 20px;\n  font-variant-numeric: tabular-nums;\n}\n/* With 3 or more columns, a narrow chat s"
    "crolls the table rather than squeezing every column. */\n.hb-table-wide { min-width: 420px; }\n.hb-t"
    "able th, .hb-table td {\n  height: 36px;\n  padding: 8px 12px;\n  border: 0;\n  border-bottom: 1px s"
    "olid var(--hb-line);\n  background: none;\n  text-align: left;\n  vertical-align: middle;\n  white-s"
    "pace: nowrap;\n}\n/* The header stays in view as the rows scroll; it is painted like the card so row"
    "s don't show through. */\n.hb-table th {\n  position: sticky;\n  top: 0;\n  z-index: 1;\n  height: 3"
    "4px;\n  padding: 0;\n  border-bottom-color: var(--hb-line-strong);\n  background: linear-gradient(va"
    "r(--hb-card), var(--hb-card)), var(--hb-surface);\n}\n.hb-table th button {\n  display: flex;\n  ali"
    "gn-items: center;\n  gap: 4px;\n  width: 100%;\n  height: 34px;\n  padding: 0 12px;\n  border: 0;\n "
    " background: none;\n  color: var(--hb-muted);\n  font: inherit;\n  font-size: 11.5px;\n  font-weight"
    ": 600;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  white-space: nowrap;\n  cursor: p"
    "ointer;\n}\n.hb-table th.hb-num button { justify-content: flex-end; }\n.hb-table .hb-first, .hb-tabl"
    "e th.hb-first button { padding-left: 16px; }\n.hb-table td:last-child, .hb-table th:last-child butto"
    "n { padding-right: 16px; }\n.hb-table tbody tr:last-child td { border-bottom: 0; }\n.hb-table td.hb-"
    "first { font-weight: 600; }\n.hb-table td.hb-num { text-align: right; }\n.hb-table td.hb-wrap { min-"
    "width: 180px; white-space: normal; }\n/* Sorting: a faint ↕ on the header under the pointer, ↑ or ↓ "
    "on the sorted one. */\n.hb-sort { opacity: 0; font-weight: 400; letter-spacing: 0; transition: opaci"
    "ty 0.12s var(--hb-ease-out); }\n.hb-table th:hover .hb-sort, .hb-table th button:focus-visible .hb-s"
    "ort { opacity: 0.6; }\n.hb-table th.hb-sorted .hb-sort { opacity: 1; color: var(--hb-ink-2); }\n/* T"
    "he best row: an accent edge on its first cell and a chip; the best column: an accent line under its "
    "header. */\n.hb-table tr.hb-best td.hb-first { box-shadow: inset 3px 0 0 var(--hb-accent); }\n.hb-ta"
    "ble th.hb-best-col { box-shadow: inset 0 -2px 0 var(--hb-accent); }\n.hb-table .hb-chip { margin-lef"
    "t: 8px; vertical-align: 1px; padding: 0 7px; font-size: 11px; line-height: 16px; letter-spacing: 0; "
    "text-transform: none; }\n.hb-table th .hb-chip { margin-left: 4px; }\n/* Changes: green for a rise, "
    "orange for a fall, with a small bar growing from the middle. */\n.hb-table td.hb-up { color: var(--h"
    "b-good); }\n.hb-table td.hb-down { color: var(--hb-warn); }\n.hb-mini { display: inline-block; posit"
    "ion: relative; width: 56px; height: 8px; margin-right: 8px; vertical-align: 0; }\n.hb-mini-zero { po"
    "sition: absolute; top: -3px; bottom: -3px; left: 50%; width: 1px; background: var(--hb-line-strong);"
    " }\n.hb-mini-bar { position: absolute; top: 0; bottom: 0; border-radius: 2px; background: currentCol"
    "or; }\n.hb-table td.hb-table-empty { color: var(--hb-muted); font-weight: 400; text-align: center; }"
    "\n@media (prefers-reduced-motion: reduce) { .hb-sort { transition: none; } }\n.hb-section .hb-table-"
    "card { background: none; border: 0; }\n/* Structured tables: typed columns, local filter, pages, agg"
    "regates and source chips. */\n.hb-table-structured .hb-table-grid { width: 100%; border-collapse: co"
    "llapse; font-size: 13px; }\n.hb-table-structured th, .hb-table-structured td { padding: 7px 10px; bo"
    "rder-bottom: 1px solid var(--hb-line); text-align: left; vertical-align: top; }\n.hb-table-structure"
    "d th { color: var(--hb-ink-2); font-size: 11.5px; font-weight: 700; }\n.hb-table-structured .hb-alig"
    "n-right { text-align: right; font-variant-numeric: tabular-nums; }\n.hb-table-structured .hb-align-c"
    "enter { text-align: center; }\n.hb-table-structured tfoot td { color: var(--hb-ink-2); font-weight: "
    "600; border-top: 1px solid var(--hb-line-strong); }\n.hb-table-aggregate-label { color: var(--hb-mut"
    "ed); font-size: 11px; font-weight: 400; }\n.hb-table-sources { display: flex; flex-wrap: wrap; gap: "
    "3px 8px; }\n.hb-table-sources a { color: var(--hb-accent-ink); text-decoration: underline; text-unde"
    "rline-offset: 2px; }\n.hb-table-source-hint { margin-left: 4px; color: var(--hb-muted); }\n.hb-table"
    "-bar { display: flex; align-items: center; gap: 6px; min-width: 90px; }\n.hb-table-bar-fill { displa"
    "y: block; flex: 1 1 auto; height: 6px; border-radius: 999px; background: var(--hb-accent); }\n.hb-ta"
    "ble-bar-value { flex: none; font-variant-numeric: tabular-nums; }\n.hb-table-tools { display: flex; "
    "flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding-top: 8px; }"
    "\n.hb-table-tools input { min-width: 140px; max-width: 240px; padding: 5px 9px; border: 1px solid va"
    "r(--hb-line-strong); border-radius: 8px; background: var(--hb-well); color: var(--hb-ink); font: inh"
    "erit; font-size: 12px; }\n.hb-table-tools input:focus-visible, .hb-table-pages button:focus-visible "
    "{ outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-table-pages { display: flex; alig"
    "n-items: center; gap: 8px; color: var(--hb-muted); font-size: 11.5px; }\n.hb-table-pages button { mi"
    "n-width: 26px; min-height: 26px; border: 1px solid var(--hb-line-strong); border-radius: 8px; backgr"
    "ound: var(--hb-well); color: var(--hb-ink); cursor: pointer; }\n.hb-table-pages button:disabled { op"
    "acity: 0.4; cursor: default; }\n"
)

# Elements of the structured DOM StructuredTable.tsx draws when a table is filterable and paginates.
CS_STRUCTURED_IDS = ("st-card", "st-tools", "st-input", "st-pages")
# The interactive tools row's own contract, also read as computed style, not only as geometry.
CS_INTERACTIVE_IDS = ("o-card", "o-tools")
CS_PROPS = [
    "display", "flex-direction", "flex-wrap", "align-items", "justify-content", "gap",
    "width", "min-width", "max-width", "box-sizing",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-radius", "border-top-width", "border-left-width", "border-bottom-width",
    "background-color", "color", "font-size",
]


def structured_table(p: str) -> str:
    """The structured tools DOM exactly as the shipped StructuredTable.tsx draws it: a filterable,
    multi-page table's card, grid, then the tools row carrying the search input and the pagination."""
    return (
        f'<div class="hb-card hb-table-card hb-table hb-table-structured" id="{p}-card">'
        f'<table class="hb-table-grid" id="{p}-grid"><thead><tr>'
        f'<th id="{p}-th">Shop</th><th class="hb-align-right" id="{p}-th2">Spend</th></tr></thead>'
        f'<tbody><tr><td id="{p}-td">Alpha</td><td class="hb-align-right">₹1,200</td></tr>'
        f'<tr><td>Beta</td><td class="hb-align-right">₹900</td></tr></tbody></table>'
        f'<div class="hb-table-tools" id="{p}-tools">'
        f'<input type="search" value="" placeholder="Filter rows" aria-label="Filter rows" id="{p}-input"/>'
        f'<div class="hb-table-pages" id="{p}-pages">'
        f'<button type="button" aria-label="Previous page" disabled>\u2039</button>'
        f'<span>Page 1 of 3</span>'
        f'<button type="button" aria-label="Next page">\u203a</button></div></div></div>'
    )


def cs_script(ids: tuple[str, ...]) -> str:
    id_list = ",".join(f'"{i}"' for i in ids)
    prop_list = ",".join(f'"{p}"' for p in CS_PROPS)
    return (
        "const CS={};const csIds=[" + id_list + "];const csProps=[" + prop_list + "];"
        "for (const id of csIds){const el=document.getElementById(id);if(!el)continue;"
        "const cs=getComputedStyle(el);const r={};for (const p of csProps) r[p]=cs[p];CS[id]=r;}"
        "document.getElementById('cs').textContent=JSON.stringify(CS);"
    )


def base_fixture_html() -> str:
    """The shipped page\'s structured fixture, styled by the sheet set with table.css as MERGED
    at base 1617ba7e and every other sheet unchanged (the offer touches only table.css).
    Ground truth for "structured tables must not move"."""
    css = "\n".join(p.read_text() for p in CSS if p.name != "table.css") + "\n" + BASE_TABLE_CSS
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{css}</style></head>"
        "<body style='margin:0'>"
        f'<div class="hb-blocks" data-root id="stb-root">{structured_table("st")}</div>'
        "<pre id='cs' style='display:none'></pre>"
        f"<script>{cs_script(CS_STRUCTURED_IDS)}</script></body></html>"
    )


def fixture_html() -> str:
    css = "\n".join(p.read_text() for p in CSS)
    # NOT shipped CSS: two defect shapes, each kept measurable as a negative control —
    #   neg-root:   a tools row sized to its own content instead of the card (width blow-up);
    #   clip-root:  the OLD status style (nowrap + ellipsis), which clips words on a narrow hug
    #               (review round 3). Restated in full so the control never leans on the shipped rule.
    neg_css = (
        "#neg-root .hb-table-tools { width: auto; min-width: 0; }\n"
        "#clip-root .hb-table-sent { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; "
        "min-width: 0; flex: 0 1 auto; }"
    )
    one_row = [("Pixel 10a", "₹44,999")]
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{css}\n{neg_css}</style></head>"
        "<body style='margin:0'>"
        f'<div class="hb-blocks" data-root id="plain-root">{static_table("p")}</div>'
        f'<div class="hb-blocks" data-root id="optin-root">{interactive_table("o")}</div>'
        f'<div class="hb-blocks" data-root id="narrow-root">{interactive_table("o1", one_row)}</div>'
        f'<div class="hb-blocks" data-root id="sent-root">{interactive_table("s", one_row, status=BLOCKED)}</div>'
        f'<div class="hb-blocks" data-root id="drafted-root">{interactive_table("d", one_row, status=DRAFTED)}</div>'
        f'<div class="hb-blocks" data-root id="failed-root">{interactive_table("f", one_row, status=FAILED)}</div>'
        f'<div class="hb-blocks" data-root id="sentok-root">{interactive_table("k", one_row, status=SENT_OK)}</div>'
        f'<div class="hb-blocks" data-root id="neg-root">{interactive_table("n")}</div>'
        f'<div class="hb-blocks" data-root id="clip-root">{interactive_table("x", one_row, status=BLOCKED)}</div>'
        f'<div class="hb-blocks" data-root id="st-root">{structured_table("st")}</div>'
        "<pre id='out' style='display:none'></pre>"
        "<pre id='clip' style='display:none'></pre>"
        "<pre id='cs' style='display:none'></pre>"
        f"<script>{measure_script()}\n{cs_script(CS_STRUCTURED_IDS + CS_INTERACTIVE_IDS)}</script></body></html>"
    )


def measure_script() -> str:
    probed = ",".join(f'"{p}"' for p in PROBED)
    js = """
    const roots = [...document.querySelectorAll("[data-root]")];
    const out = roots.map((root) => {
      const rb = root.getBoundingClientRect();
      const els = [root, ...root.querySelectorAll("[id]")];
      return els.map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.id} ${r.width.toFixed(3)} ${(r.left - rb.left).toFixed(3)} ` +
          `${(r.right - rb.left).toFixed(3)} ${r.height.toFixed(3)}`;
      });
    }).flat();
    document.getElementById("out").textContent = out.join("\\n");
    // Clip report per status span: box overflow (scrollWidth vs clientWidth) and, word by word,
    // whether the word's own laid-out range rect sits fully inside the span's box. A clipped word
    // still has a rect — it simply lies past the edge. That is layout truth, not markup.
    const clips = [];
    for (const id of [__PROBED__]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      let words = 0, inside = 0;
      for (const node of el.childNodes) {
        if (node.nodeType !== 3) continue;
        const re = /\\S+/g;
        let m;
        while ((m = re.exec(node.textContent))) {
          words++;
          const rg = document.createRange();
          rg.setStart(node, m.index);
          rg.setEnd(node, m.index + m[0].length);
          const rs = [...rg.getClientRects()].filter((q) => q.width > 0);
          if (rs.length && rs.every((q) => q.left >= r.left - 0.5 && q.right <= r.right + 0.5)) inside++;
        }
      }
      clips.push(`${id} cw ${el.clientWidth} sw ${el.scrollWidth} h ${r.height.toFixed(3)} ` +
        `words ${words} inside ${inside}`);
    }
    document.getElementById("clip").textContent = clips.join("\\n");
    """
    return js.replace("__PROBED__", probed)


def launch(page_text: str) -> str:
    """One headless-Chrome run over a disposable profile; returns the dumped DOM."""
    with tempfile.TemporaryDirectory() as work:
        page = Path(work) / "probe.html"
        page.write_text(page_text)
        profile = Path(work) / "profile"
        profile.mkdir()
        cmd = [
            str(CHROME), "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
            "--force-device-scale-factor=1", "--window-size=2000,1400", f"--user-data-dir={profile}",
            "--virtual-time-budget=2000", "--dump-dom", f"file://{page}",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        assert proc.stdout.strip(), f"chrome dumped nothing; stderr: {proc.stderr[-400:]}"
        return proc.stdout


def grab(stdout: str, name: str) -> str:
    m = re.search(rf"<pre id=\"{name}\"[^>]*>(.*?)</pre>", stdout, re.S)
    assert m, f"probe never reported {name}"
    return html.unescape(m.group(1)).strip()



def computed_report(stdout: str) -> dict:
    return json.loads(grab(stdout, "cs"))


@pytest.fixture(scope="module")
def probe() -> dict:
    """One real-Chrome run of the shipped fixture; all three reports parsed out of it."""
    if CHROME is None:
        pytest.skip("no Chrome/Chromium binary on this machine")
    stdout = launch(fixture_html())
    text_out = grab(stdout, "out")
    text_clip = grab(stdout, "clip")
    cs = computed_report(stdout)
    out: dict[str, tuple[float, float, float, float]] = {}
    for line in text_out.splitlines():
        bits = line.split()
        assert len(bits) == 5, line
        out[bits[0]] = (float(bits[1]), float(bits[2]), float(bits[3]), float(bits[4]))
    clip: dict[str, dict[str, float]] = {}
    for line in text_clip.splitlines():
        bits = line.split()
        assert len(bits) == 11, line
        vals = dict(zip(bits[1::2], bits[2::2]))
        assert list(vals) == ["cw", "sw", "h", "words", "inside"], line
        clip[bits[0]] = {k: float(v) for k, v in vals.items()}
    assert set(clip) == set(PROBED), f"clip report missing spans: {set(PROBED) - set(clip)}"
    return {"rects": out, "clip": clip, "cs": cs}


@pytest.fixture(scope="module")
def cs_base() -> dict:
    """The same structured DOM, styled at the base commit's table.css — the ground truth the shipped
    sheets must match property for property (review round 2, leak item 1)."""
    if CHROME is None:
        pytest.skip("no Chrome/Chromium binary on this machine")
    return computed_report(launch(base_fixture_html()))


@pytest.fixture(scope="module")
def rects(probe) -> dict[str, tuple[float, float, float, float]]:
    return probe["rects"]


@pytest.fixture(scope="module")
def clip(probe) -> dict[str, dict[str, float]]:
    return probe["clip"]


BOARD_W = 1100.0  # the board's reading cap; a hugging card sits far under it
BORDER = 2.0      # .hb-card's 1px border on each side: the box hugs the table plus exactly this


class TestStaticDefault:
    """The table without the word is untouched: the shipped card still hugs its columns."""

    def test_the_plain_card_hugs_its_table(self, rects):
        assert rects["p-card"][0] == pytest.approx(rects["p-table"][0] + BORDER, abs=0.01)

    def test_the_plain_card_is_not_the_board(self, rects):
        assert rects["p-card"][0] < BOARD_W - 100  # hugging, not filling


class TestInteractiveKeepsTheHug:
    """With the filter UI present the fit-content width is preserved: the card still measures its table,
    the controls row contributes ZERO width of its own, and the tick column is all that was added."""

    def test_the_opt_in_card_still_hugs_its_table(self, rects):
        assert rects["o-card"][0] == pytest.approx(rects["o-table"][0] + BORDER, abs=0.01)
        assert rects["o-card"][0] < BOARD_W - 100

    def test_the_tools_row_costs_the_card_nothing(self, rects):
        # Same data columns in both cards: the only added width is the tick column itself — the tools row
        # (input + pill, which alone measure ~350px) inflates the card by ZERO.
        added = rects["o-card"][0] - rects["p-card"][0]
        assert added == pytest.approx(rects["o-pick"][0], abs=0.5), (added, rects["o-pick"])
        assert rects["o-pick"][0] < 60.0  # a checkbox column, not a content-driven band

    def test_the_tools_row_fills_the_card_it_never_widens(self, rects):
        assert rects["o-tools"][0] == pytest.approx(rects["o-card"][0] - BORDER, abs=0.5)
        # Both controls sit inside the hug — nothing overflows the card edge.
        assert rects["o-filter"][3] <= rects["o-card"][3] + 0.5
        assert rects["o-pill"][3] <= rects["o-card"][3] + 0.5

    def test_a_narrowed_table_hugs_too(self, rects):
        # One row visible after a filter: the card still measures its table, never a fixed or full width.
        assert rects["o1-card"][0] == pytest.approx(rects["o1-table"][0] + BORDER, abs=0.01)
        assert rects["o1-card"][0] < BOARD_W - 100
        assert rects["o1-tools"][0] == pytest.approx(rects["o1-card"][0] - BORDER, abs=0.5)

    def test_spoken_feedback_costs_the_narrowest_card_nothing(self, rects):
        # The same one-row card after a tap, its live region filled with the longest word it can say:
        # the tools row still costs zero width — the card measures its table exactly as it did in silence,
        # and the feedback text never overflows the card edge (it WRAPS inside the hug — see
        # TestNarrowFeedbackReadability for the claim that every wrapped word is actually readable).
        assert rects["s-card"][0] == pytest.approx(rects["s-table"][0] + BORDER, abs=0.01)
        assert rects["s-card"][0] == pytest.approx(rects["o1-card"][0], abs=0.5)
        assert rects["s-tools"][0] == pytest.approx(rects["s-card"][0] - BORDER, abs=0.5)
        assert rects["s-sent"][3] <= rects["s-card"][3] + 0.5


class TestNarrowFeedbackReadability:
    """Review round 3, on the NARROWEST hugging card (one row, two columns — the exact fixture the
    reviewer measured): the send-outcome and recovery words must be FULLY readable. The probe reads
    layout: no horizontal overflow in the span, and every word's own laid-out range rect inside the
    span's box. Card WIDTH stays == the silent table's hug; only HEIGHT may grow."""

    @pytest.mark.parametrize("pid", ["s-sent", "d-sent", "f-sent", "k-sent"])
    def test_no_word_is_clipped_at_narrow_width(self, clip, pid):
        c = clip[pid]
        assert c["words"] > 0, pid
        assert c["sw"] <= c["cw"] + 1, f"{pid}: overflow {c['sw']}px past a {c['cw']}px box"
        assert c["inside"] == c["words"], f"{pid}: {c['words'] - c['inside']} word(s) laid out past the box"

    def test_the_long_words_really_wrap(self, clip):
        # The blocked/failed messages cannot fit the narrow hug on one line — proof they REFLOW onto
        # more lines (the span grows taller) instead of being handed room the card never had.
        one_line = clip["x-sent"]["h"]  # the clip control's single line, same text and box
        assert clip["s-sent"]["h"] > 1.8 * one_line
        assert clip["f-sent"]["h"] > 1.8 * one_line

    @pytest.mark.parametrize("p", ["d", "f", "k"])
    def test_wrapping_words_cost_the_card_no_width(self, rects, p):
        # Same one-row data behind every card: drafted/failed/sent cards measure exactly the SILENT
        # one. Wrapping is a height affair; the fit-content hug is untouched.
        assert rects[f"{p}-card"][0] == pytest.approx(rects[f"{p}-table"][0] + BORDER, abs=0.01)
        assert rects[f"{p}-card"][0] == pytest.approx(rects["o1-card"][0], abs=0.5)


class TestNarrowClipControl:
    """The defect the reviewer measured stays measurable: the same narrow DOM wearing the OLD clip
    style (NOT shipped any more) truncates mid-sentence — while hugging just as tightly. So the
    readability probes above read real layout; if they ever go soft, this control reddens with them."""

    def test_the_old_clip_shape_truncates_the_message(self, clip):
        c = clip["x-sent"]
        assert c["sw"] > c["cw"] + 50, f"the clip probe no longer detects the defect ({c['sw']} vs {c['cw']})"
        assert 0 < c["inside"] < c["words"], "no word was caught past the edge — the probe reads nothing"

    def test_the_clipping_card_still_hugs(self, rects):
        # The round-3 finding was never about width: the clipped card hugs as tightly as the fixed
        # one — which is exactly why the width tests alone could not see it, and this can.
        assert rects["x-card"][0] == pytest.approx(rects["x-table"][0] + BORDER, abs=0.01)
        assert rects["x-card"][0] == pytest.approx(rects["s-card"][0], abs=0.5)


class TestNegativeControl:
    """The defect shape stays measurable: a tools row sized to its own content (NOT the shipped rule)
    inflates the card past the table it is supposed to hug."""

    def test_a_content_sized_tools_row_would_widen_the_card(self, rects):
        # Same DOM, one unshipped override: the card outgrows the shipped one by far more than the tick
        # column could explain — the probe reads geometry, not markup.
        assert rects["n-card"][0] - rects["p-card"][0] > 100.0
        assert rects["n-card"][0] - rects["o-card"][0] > 100.0

    def test_the_defect_stretches_the_table_with_the_card(self, rects):
        # A table fills its available box, so the inflated card visibly stretches the table it never grew:
        # the second geometric signature of the same defect, keeping it unmissable.
        assert rects["n-table"][0] > rects["p-table"][0] + 100.0
        assert rects["o-table"][0] == pytest.approx(rects["p-table"][0] + rects["o-pick"][0], abs=0.5)


class TestStructuredTablesComputeAsBase:
    """Review round 2, finding 1: the offer's tools CSS must not touch the shipped structured tables.
    The identical structured filter/pagination DOM is measured twice in real Chrome — once wearing the
    repo's shipped sheets, once wearing base 1617ba7e's table.css — and every computed property of
    every probed element must agree, used widths (rendered layout) included."""

    def test_the_embedded_base_sheet_is_the_merged_file_verbatim(self):
        # The provenance claim of this whole comparison: the embedded constant is byte-exactly
        # web/src/blocks/table/table.css as merged at base 1617ba7e (sha256 of the file's bytes).
        assert hashlib.sha256(BASE_TABLE_CSS.encode()).hexdigest() == (
            "35ac76279c6a36301be34c3a18d82c9a03f30c2a9fd428df3712edb91f287dcb"
        )

    def test_every_probed_element_is_present_both_sides(self, probe, cs_base):
        cs_ship = probe["cs"]
        assert set(cs_ship) >= set(CS_STRUCTURED_IDS)
        assert set(cs_base) == set(CS_STRUCTURED_IDS)

    def test_no_computed_property_of_the_structured_dom_moved(self, probe, cs_base):
        diffs = []
        for el in CS_STRUCTURED_IDS:
            for prop in CS_PROPS:
                if probe["cs"][el][prop] != cs_base[el][prop]:
                    diffs.append(f"{el}.{prop}: base {cs_base[el][prop]!r} != ship {probe['cs'][el][prop]!r}")
        assert not diffs, "structured tables changed:\n" + "\n".join(diffs)

    def test_the_reviewer_leak_shape_is_dead(self, probe):
        # The exact leak the reviewer measured in Chrome: padding bleeding to 8px 16px, min-width 100%,
        # width:0 shrinking the structured tools row. The shipped structured DOM must show none of it.
        tools = probe["cs"]["st-tools"]
        assert tools["padding"] == "8px 0px 0px", tools["padding"]
        assert tools["min-width"] == "0px"
        assert tools["padding-left"] == "0px"
        assert tools["padding-right"] == "0px"
        assert tools["padding-bottom"] == "0px"


class TestInteractiveToolsContract:
    """The interactive tools row's own reviewed contract, as COMPUTED style next to the geometry the
    probe has always read: width:0 + min-width:100% + border-box + 4px 16px 8px — the rules that must
    NOT reach any structured card."""

    def test_the_shipped_interactive_tools_style_is_the_reviewed_one(self, probe):
        tools = probe["cs"]["o-tools"]
        assert tools["display"] == "flex"
        assert tools["flex-wrap"] == "wrap"
        assert tools["align-items"] == "center"
        assert tools["justify-content"] == "normal"  # never structured's space-between
        assert tools["gap"] == "8px"
        assert tools["box-sizing"] == "border-box"
        assert tools["min-width"] == "100%"
        assert tools["padding"] == "4px 16px 8px"
