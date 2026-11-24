"""Real-browser regression for the follow-up suggestions strip (offer #5, rebased onto upstream main @ #55).

Three claims, all measured in real layout or with real input, none provable in jsdom:

(1) GEOMETRY (a dump-dom probe over the repo's OWN shipped stylesheets; fixture DOM mirroring exactly what
    core/FollowUps.tsx + core/Blocks.tsx render): the strip costs a fit-content hug ZERO width — the narrow
    board's bubble measures the same with the strip as without it; the row fills the wide column and never
    overflows; every word of every long label lies FULLY inside its own box with no element scrolling
    (scrollWidth <= clientWidth); whole long words (a 68-character label, no read cap) cost the same hug
    nothing and WRAP line for line rather than clip. Two unshipped restyles keep both defect shapes
    measurable forever: a row sized to its own content (width:auto) inflates the bubble, and the old clip
    rule (nowrap + ellipsis) truncates words outside their box — on the short and the whole-long fixtures
    alike — if the shipped probes ever go soft, these controls redden.

(2) BEHAVIOR (real headless Chrome over CDP with REAL pointer/key events against the REAL components —
    esbuild bundles web/src into a temp dir, nothing is written into the checkout, React mounts over the
    shipped stylesheets, and the board is wired to the real composerActions seam over a RECORDING fake host
    composer — no send() mock anywhere, and the fake answers like the real host can: submit yes/no, insert
    acknowledged/refused/held-open): a tap on a short prompt submits EXACTLY that prompt as the reader's own
    message and the strip then says "Sent to chat."; a run past MAX_SENT is POSTED WHOLE through the explicit
    force route this offer adds to the seam — one tap, no draft, the whole 449-character prompt arriving in
    submit byte-for-byte through the real read (the reviewer's correction #1: the accepted feature always
    posted long suggestions on one tap; silently drafting them was a deviation, not a design); a refused
    submit falls to an acknowledged draft and the word says "In the composer — press Send."; an insert the
    surface refuses answers "Send failed — nothing was sent or kept." and the pills stay for a retry; a run
    crafted past the reader ("/reset") is still never submitted — the command/file guard holds over the force
    route and says BLOCKED; and while a held-open host promise is still unanswered the strip says its pending
    mark, never the PREVIOUS tap's leftover success word (the reviewed stale-feedback fix, restored —
    correction #2), only the LAST tap's answer ever labeling the row. keyboard Tab reaches the first pill and
    a trusted Enter submits it.

(3) COMPOSITION (real host/BlockTag.tsx over the real REST-shaped answer): the word rides the envelope read
    into the tag's ONE <Blocks>, the strip is the last thing inside .hb-blocks, and a tap through the tag's
    own BlockActions provider submits exactly the prompt and says so. A board that says nothing draws exactly
    what it always drew: no strip, no word span, no wrapper, no second renderer.

Honest adaptations to THIS base (upstream main #55 era, not the local full stack): the seam growth the
feature needs — force route, SendResult promise, SENT_WORDS, the dashboard surface's ack — ships INSIDE this
PR as the reviewed minimal compatible shape (it matches the interactive-table offer #73 byte-for-byte in
behavior, so either PR lands alone and both converge; the two offers stay independent, per the review
routing note). Alignment placement still does not exist on this base: the row packs left, as everything
else does, and no placement classes are drawn.
"""
from __future__ import annotations

import base64
import html
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

import httpx
import pytest

REPO = Path(__file__).resolve().parents[1]
SRC = REPO / "web" / "src"
ESBUILD = REPO / "web" / "node_modules" / ".bin" / "esbuild"
WINDOW_W, WINDOW_H = 2000, 1400

# The repo's own shipped stylesheets in the shipped join order (web/src/styles/index.ts). Self-contained:
# no cross-test imports to lean on, so a reviewer can run this file alone.
CSS = [
    SRC / "styles" / "tokens.css",
    SRC / "styles" / "shared.css",
    SRC / "host" / "blockTag.css",
    SRC / "blocks" / "atoms" / "atoms.css",
    SRC / "blocks" / "source" / "source.css",
    SRC / "blocks" / "callout" / "callout.css",
    SRC / "blocks" / "kpis" / "kpis.css",
    SRC / "blocks" / "timeline" / "timeline.css",
    SRC / "blocks" / "layout" / "layout.css",
    SRC / "blocks" / "chart" / "chart.css",
    SRC / "blocks" / "images" / "images.css",
    SRC / "blocks" / "table" / "table.css",
    SRC / "blocks" / "list" / "list.css",
    SRC / "blocks" / "actions" / "actions.css",
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

# --------------------------------------------------------------------- the words the fixtures carry -------------

SHORT_UPS = [
    {"label": "Plan day 2", "run": "Plan the second day of my Kyoto itinerary"},
    {"label": "Find trains", "run": "Compare trains between Kyoto and Osaka"},
    {"label": "Costs", "run": "What will the whole trip cost?"},
]
LONG_LABEL = "Compare the three days and tell me which evening walk to cut or keep"
assert len(LONG_LABEL) > 40  # the old read cap: a label this long used to arrive cut
_SENTENCE = ("Expand every line of this Kyoto plan into a detailed day-by-day itinerary with train times, "
             "booking links and costs for every hop between the cities. ")
WHOLE_RUN = (_SENTENCE * 4).strip()  # >400 characters — past MAX_SENT, past the old 300-cap
assert len(WHOLE_RUN) > 300  # the reviewer's exact criterion: a >300-character prompt POSTED on one tap

# The words the strip says — SENT_WORDS (host/actions.ts), mirrored here so the fixtures carry the REAL
# worst case: the longest word is what a fit-content hug must still absorb without widening it.
SENT_WORD = "Sent to chat."
DRAFTED_WORD = "In the composer — press Send."
BLOCKED = "Blocked from sending — in the composer — press Send."
FAILED_WORD = "Send failed — nothing was sent or kept."
PENDING_WORD = "Pending…"  # the strip's non-success word while the host has not answered the last tap

NARROW_ROWS = "<tr><td>City</td><td>Deg</td></tr><tr><td>Rome</td><td>21</td></tr>"


def strip_html(p: str, said: str = "", items=None) -> str:
    """Exactly the markup core/FollowUps.tsx renders inside .hb-blocks (pills with the spark-sized svg, and
    the live status span the component ends the row with). `said` carries the word the host would answer —
    the fixtures pass the REAL worst case so the zero-width hug is pinned against it too."""
    pills = "".join(
        f'<button type="button" class="hb-pill" id="{p}-pill{i}" title="{html.escape(f["run"], quote=True)}">'
        f'<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"></svg>'
        f'<span class="hb-followup-label" id="{p}-l{i}">{html.escape(f["label"])}</span></button>'
        for i, f in enumerate(items or SHORT_UPS))
    return (f'<div class="hb-followups" id="{p}-row">{pills}'
            f'<span class="hb-followups-said" role="status" aria-live="polite" id="{p}-said">{said}</span></div>')


def narrow_board(p: str, *, strip: str) -> str:
    """A fit-content BUBBLE around one .hb-blocks whose only block is a tiny table — the narrowest hug the
    table offers measured. The bubble is what a strip could widen; it must not."""
    return (f'<div style="width:fit-content" data-root id="{p}-bubble">'
            f'<div class="hb-blocks" id="{p}-blocks">'
            f'<div class="hb-card hb-table-card" id="{p}-card"><table>{NARROW_ROWS}</table></div>'
            f"{strip}</div></div>")


def wide_board(p: str, *, strip: str = "") -> str:
    """A 1100px board (the reading cap at this window) with a full-width line and the strip under it."""
    return (f'<div style="width:1100px" data-root id="{p}-root">'
            f'<div class="hb-blocks" id="{p}-blocks">'
            f'<div class="hb-text" id="{p}-text">A prose block long enough to fill the whole column.'
            f"</div>{strip}</div></div>")


def fixture_html() -> str:
    css = "\n".join(p.read_text() for p in CSS)
    # NOT shipped CSS — the old defect shapes, restated IN FULL so each control stands on its own even if
    # the shipped rule is ever renamed: a row sized to its own content (width blow-up), and the round-3 clip
    # rule (nowrap + ellipsis + hidden) on the label spans AND the word span.
    neg_css = (
        "#nb-naive-bubble .hb-followups { width: auto; min-width: 0; }\n"
        "#nb-clip-bubble .hb-followup-label, #nb-clip-bubble .hb-followups-said { "
        "white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }"
    )
    whole_two = [{"label": LONG_LABEL, "run": WHOLE_RUN},
                 {"label": "Find trains and book the fastest one before Friday", "run": "Compare trains"}]
    page = (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{css}\n{neg_css}</style></head><body style='margin:0'>"
        + narrow_board("nb-plain", strip="")
        + narrow_board("nb-strip", strip=strip_html("nb-strip", said=BLOCKED))
        + narrow_board("nb-long", strip=strip_html("nb-long", said=BLOCKED, items=whole_two))
        + narrow_board("nb-naive", strip=strip_html("nb-naive"))
        + narrow_board("nb-clip", strip=strip_html("nb-clip", said=BLOCKED, items=whole_two))
        + wide_board("wb-fill", strip=strip_html("wb-fill"))
        + wide_board("wb-plain")
        + "<pre id='out' style='display:none'></pre><pre id='clip' style='display:none'></pre>"
        + f"<script>{measure_script()}</script></body></html>"
    )
    return page


PROBED = ("nb-strip-l0", "nb-strip-l1", "nb-strip-l2", "nb-strip-said",
          "nb-long-l0", "nb-long-l1", "nb-long-said",
          "nb-clip-l0", "nb-clip-l1", "nb-clip-said")


def measure_script() -> str:
    probed = ",".join(f'"{p}"' for p in PROBED)
    return f"""
    const roots = [...document.querySelectorAll("[data-root]")];
    const out = roots.map((root) => {{
      const rb = root.getBoundingClientRect();
      const els = [root, ...root.querySelectorAll("[id]")];
      return els.map((el) => {{
        const r = el.getBoundingClientRect();
        return `${{el.id}} ${{r.width.toFixed(3)}} ${{(r.left - rb.left).toFixed(3)}} ` +
          `${{(r.right - rb.left).toFixed(3)}} ${{r.height.toFixed(3)}} ` +
          `${{(r.top - rb.top).toFixed(3)}} ${{(r.bottom - rb.top).toFixed(3)}}`;
      }});
    }}).flat();
    document.getElementById("out").textContent = out.join("\\n");
    const clips = [];
    for (const id of [{probed}]) {{
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      let words = 0, inside = 0;
      for (const node of el.childNodes) {{
        if (node.nodeType !== 3) continue;
        const re = /\\S+/g;
        let m;
        while ((m = re.exec(node.textContent))) {{
          words++;
          const rg = document.createRange();
          rg.setStart(node, m.index);
          rg.setEnd(node, m.index + m[0].length);
          const rs = [...rg.getClientRects()].filter((q) => q.width > 0);
          if (rs.length && rs.every((q) => q.left >= r.left - 0.5 && q.right <= r.right + 0.5)) inside++;
        }}
      }}
      clips.push(`${{id}} cw ${{el.clientWidth}} sw ${{el.scrollWidth}} h ${{r.height.toFixed(3)}} ` +
        `words ${{words}} inside ${{inside}}`);
    }}
    document.getElementById("clip").textContent = clips.join("\\n");
    """


def launch(page_text: str) -> str:
    """One headless-Chrome run over a disposable profile; returns the dumped DOM. Static markup plus
    --force-prefers-reduced-motion: the shipped rules settle the drawing (no injected CSS needed)."""
    with tempfile.TemporaryDirectory() as work:
        page = Path(work) / "probe.html"
        page.write_text(page_text)
        profile = Path(work) / "profile"
        profile.mkdir()
        cmd = [
            str(CHROME), "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
            "--force-device-scale-factor=1", f"--window-size={WINDOW_W},{WINDOW_H}",
            f"--user-data-dir={profile}",
            "--virtual-time-budget=2000", "--force-prefers-reduced-motion", "--dump-dom", f"file://{page}",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        assert proc.stdout.strip(), f"chrome dumped nothing; stderr: {proc.stderr[-400:]}"
        return proc.stdout


def grab(stdout: str, name: str) -> str:
    m = re.search(rf"<pre id=\"{name}\"[^>]*>(.*?)</pre>", stdout, re.S)
    assert m, f"probe never reported {name}"
    return html.unescape(m.group(1)).strip()


@pytest.fixture(scope="module")
def probe() -> dict:
    """One real-Chrome run of the shipped fixture; both reports parsed out of it."""
    if CHROME is None:
        pytest.skip("no Chrome/Chromium binary on this machine")
    stdout = launch(fixture_html())
    out: dict[str, tuple[float, float, float, float, float, float]] = {}
    for line in grab(stdout, "out").splitlines():
        bits = line.split()
        assert len(bits) == 7, line
        out[bits[0]] = tuple(float(x) for x in bits[1:])
    clip: dict[str, dict[str, float]] = {}
    for line in grab(stdout, "clip").splitlines():
        bits = line.split()
        assert len(bits) == 11, line
        vals = dict(zip(bits[1::2], bits[2::2]))
        assert list(vals) == ["cw", "sw", "h", "words", "inside"], line
        clip[bits[0]] = {k: float(v) for k, v in vals.items()}
    assert set(clip) == set(PROBED), f"clip report missing spans: {set(PROBED) - set(clip)}"
    return {"rects": out, "clip": clip}


@pytest.fixture(scope="module")
def rects(probe) -> dict:
    return probe["rects"]


@pytest.fixture(scope="module")
def clip(probe) -> dict:
    return probe["clip"]


class TestHugAndFill:
    """GEOMETRY — what jsdom cannot see: real laid-out widths."""

    def test_the_strip_costs_the_bubble_nothing(self, rects):
        assert rects["nb-strip-bubble"][0] == pytest.approx(rects["nb-plain-bubble"][0], abs=0.51)

    def test_whole_long_labels_cost_the_bubble_nothing_too(self, rects):
        # round 2's whole words (the 68-char label the old reader used to cut at 40) hug just the same.
        assert rects["nb-long-bubble"][0] == pytest.approx(rects["nb-plain-bubble"][0], abs=0.51)

    def test_the_row_fills_the_board_it_never_widens(self, rects):
        row = rects["wb-fill-row"]
        assert row[1] == pytest.approx(0.0, abs=0.51)          # starts at the column's left edge…
        assert row[2] == pytest.approx(rects["wb-fill-root"][2], abs=0.51)  # …and ends at its right edge

    def test_the_row_wraps_rather_than_escaping_the_column(self, rects):
        row = rects["wb-fill-row"]
        for i in range(3):
            pill = rects[f"wb-fill-pill{i}"]
            assert pill[2] <= row[2] + 0.5, f"pill {i} crosses the row"

    def test_a_content_sized_row_would_widen_the_bubble(self, rects):
        # negative control: the very strip sized to its own content — if this ever hugs, the shipped
        # width:0 trick is gone and the real tests above read markup, not layout.
        assert rects["nb-naive-bubble"][0] - rects["nb-plain-bubble"][0] > 100.0

    def test_the_whole_long_words_really_wrap(self, rects):
        # the 68-char label takes more than one laid-out line at the narrow hug (height grows, width never).
        assert rects["nb-long-row"][3] > rects["nb-strip-row"][3] + 10.0

    def test_the_strip_sits_beneath_the_blocks(self, rects):
        assert rects["nb-strip-row"][4] >= rects["nb-strip-card"][5] - 0.5  # row top below card bottom

    def test_the_word_parks_under_the_pills_and_never_widens_the_hug(self, rects):
        # The worst-case host answer word (BLOCKED) at the narrowest fit-content hug: it must WRAP onto its
        # own line beneath the pills (vertical truth — a horizontal-only probe certifies inline overflow as
        # fine) and never cross the bubble the word could have widened. The width claim rides the test above:
        # nb-long now carries the word, and the bubble hugs exactly as much as it did without it.
        pills_bottom = max(rects[f"nb-long-pill{i}"][5] for i in range(2))  # nb-long carries two pills
        assert rects["nb-long-said"][4] >= pills_bottom - 0.5               # the word sits BELOW the pills
        assert rects["nb-long-said"][2] <= rects["nb-long-bubble"][0] + 0.5  # and ends inside the hug


class TestWholeWordsAreReadable:
    """GEOMETRY — layout truth for the words: every laid-out word rect inside its own box."""

    def test_no_word_of_the_short_labels_is_clipped(self, clip):
        for pid in ("nb-strip-l0", "nb-strip-l1", "nb-strip-l2", "nb-strip-said"):
            c = clip[pid]
            assert c["sw"] <= c["cw"], f"{pid}: the label scrolls — something clips"
            assert c["inside"] == c["words"] > 0, f"{pid}: not every word lies inside the box"

    def test_the_whole_long_words_arrive_and_stay_inside(self, clip):
        for pid, words in (("nb-long-l0", 14), ("nb-long-l1", 9), ("nb-long-said", 10)):
            c = clip[pid]
            assert c["words"] == words, f"{pid}: the whole word never arrived ({c['words']} words)"
            assert c["sw"] <= c["cw"], f"{pid}: the label scrolls — something clips"
            assert c["inside"] == c["words"], f"{pid}: a laid-out word sits past the box"

    def test_the_old_clip_rule_truncates_the_very_whole_words(self, clip):
        # standing negative control: the SAME words the shipped reader keeps whole, restyled with the
        # round-3 defect rule in full — labels AND the word span. If this ever stops reddening, the clip
        # probe reads decoration.
        for pid, words in (("nb-clip-l0", 14), ("nb-clip-l1", 9), ("nb-clip-said", 10)):
            c = clip[pid]
            assert c["words"] == words, f"{pid}: the whole words never arrived"
            assert c["sw"] > 1.5 * c["cw"], f"{pid}: the clip probe no longer detects the defect"
            assert c["inside"] < c["words"], f"{pid}: no word was caught past the edge"

    def test_the_clipping_bubble_still_hugs(self, rects):
        # the defect never announced itself in width — which is why only a word-level clip probe sees it.
        assert rects["nb-clip-bubble"][0] == pytest.approx(rects["nb-plain-bubble"][0], abs=0.51)


# --------------------------------------------------------------------- the live drivers -----------------------

DRIVER_BLOCKS = """
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { readBlocksNoted } from "./src/core/readBlocks";
import { Blocks } from "./src/core/Blocks";
import { BlockActions, composerActions } from "./src/host/actions";

declare const window: any;
const calls: Array<[string, string]> = [];
window.__calls = calls;
const composer = {
  submit: (_s: null, t: string) => { calls.push(["submit", t]); return window.__SUBMIT_OK__ !== false; },
  insertText: async (_s: null, t: string) => {
    calls.push(["insert", t]);
    if (window.__SLOW__ === true) {
      // a host that has not answered yet: the promise stays open until the test lets it resolve,
      // so the strip's behavior WHILE a tap waits on the host is observable from the outside
      await new Promise<void>((res) => {
        const iv = setInterval(() => { if (window.__GO__ === true) { clearInterval(iv); res(); } }, 10);
      });
    }
    if (window.__INSERT_FAIL__ === true) return false;      // nothing mounted took it
    return true;
  },
  focus: () => { calls.push(["focus", ""]); },
};
const actions = composerActions(composer);
const spec = JSON.parse(document.getElementById("spec")!.textContent!);
const app = createRoot(document.getElementById("app")!);
if (spec.direct) {
  // crafted past the reader: the guard's last defense is the seam itself
  app.render(createElement(BlockActions.Provider, { value: actions },
    createElement(Blocks, { blocks: [], boardFollowUps: spec.follow_ups })));
} else {
  const r = readBlocksNoted(spec);
  app.render(createElement(BlockActions.Provider, { value: actions },
    createElement(Blocks, { blocks: r.blocks, boardFollowUps: r.followUps })));
}
window.__ready = true;
"""

DRIVER_TAG = """
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { BlockTag } from "./src/host/BlockTag";
import { BlockActions, composerActions } from "./src/host/actions";

declare const window: any;
const calls: Array<[string, string]> = [];
window.__calls = calls;
const composer = {
  submit: (_s: null, t: string) => { calls.push(["submit", t]); return true; },
  insertText: async (_s: null, t: string) => { calls.push(["insert", t]); return true; },
  focus: () => { calls.push(["focus", ""]); },
};
const actions = composerActions(composer);
const data = JSON.parse(document.getElementById("spec")!.textContent!);
createRoot(document.getElementById("app")!).render(
  createElement(BlockActions.Provider, { value: actions },
    createElement(BlockTag, { id: "7f3a09bc", streaming: false, load: async () => data })));
window.__ready = true;
"""


class CDP:
    """The smallest DevTools Protocol client that is enough here (same stdlib shape the suite family uses)."""

    def __init__(self, host: str, port: int, path: str):
        self.sock = socket.create_connection((host, port), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(
            (f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
             f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        assert b" 101 " in buf.split(b"\r\n", 1)[0], buf[:120]
        self.buf = buf.split(b"\r\n\r\n", 1)[1]
        self.mid = 0

    def _read(self, n: int) -> bytes:
        while len(self.buf) < n:
            more = self.sock.recv(65536)
            if not more:
                raise OSError("websocket closed")
            self.buf += more
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def _send(self, payload: str) -> None:
        data = payload.encode()
        mask = os.urandom(4)
        body = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        head = bytearray([0x81])
        if len(data) < 126:
            head.append(0x80 | len(data))
        elif len(data) < 65536:
            head.append(0x80 | 126)
            head += struct.pack(">H", len(data))
        else:
            head.append(0x80 | 127)
            head += struct.pack(">Q", len(data))
        self.sock.sendall(bytes(head) + mask + body)

    def _recv(self):
        while True:
            b0, b1 = self._read(2)
            ln = b1 & 0x7F
            if ln == 126:
                ln = struct.unpack(">H", self._read(2))[0]
            elif ln == 127:
                ln = struct.unpack(">Q", self._read(8))[0]
            payload, op = self._read(ln), b0 & 0x0F
            if op == 0x8:
                raise OSError("websocket closed by peer")
            if op in (0x1, 0x2):
                return json.loads(payload)

    def call(self, method: str, **params):
        self.mid += 1
        self._send(json.dumps({"id": self.mid, "method": method, "params": params}))
        while True:
            msg = self._recv()
            if msg.get("id") == self.mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result")

    def js(self, expr: str):
        r = self.call("Runtime.evaluate", expression=expr, returnByValue=True)
        if r.get("exceptionDetails"):
            raise RuntimeError(f"probe threw: {r['exceptionDetails']}")
        return r["result"].get("value")

    def mouse(self, x: float, y: float) -> None:
        for m, extra in (("mouseMoved", {}), ("mousePressed", {"button": "left", "clickCount": 1}),
                         ("mouseReleased", {"button": "left", "clickCount": 1})):
            self.call("Input.dispatchMouseEvent", type=m, x=x, y=y, **extra)

    def key(self, name: str, code: str, vk: int, text: str | None = None) -> None:
        for t in ("keyDown", "keyUp"):
            extra = {"text": text} if text and t == "keyDown" else {}
            self.call("Input.dispatchKeyEvent", type=t, key=name, code=code,
                      windowsVirtualKeyCode=vk, nativeVirtualKeyCode=vk, **extra)

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


def wait_js(cdp: CDP, expr: str, timeout: float = 12.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        got = cdp.js(expr)
        if got:
            return got
        time.sleep(0.05)
    raise AssertionError(f"never became true: {expr}")


def bundle(driver_src: str) -> str:
    proc = subprocess.run(
        [str(ESBUILD), "--bundle", "--format=iife", "--jsx=automatic", "--loader=tsx", "--log-level=warning"],
        input=driver_src, capture_output=True, text=True, timeout=180, cwd=str(REPO / "web"))
    assert proc.returncode == 0, proc.stderr
    return proc.stdout


@contextmanager
def chrome_page(board: object, driver_js: str):
    # ignore_cleanup_errors: Chrome's crashpad helper may still hold the profile dir open when the context
    # exits, a moment after terminate(); the page itself has already answered every assertion by then.
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as work:
        (Path(work) / "driver.js").write_text(driver_js)
        page = Path(work) / "probe.html"
        css = "\n".join(p.read_text() for p in CSS)
        page.write_text(
            "<!doctype html><html><head><meta charset='utf-8'>"
            f"<style>{css}</style></head><body style='margin:0'>"
            "<div id='app'></div>"
            f"<script id='spec' type='application/json'>{json.dumps(board)}</script>"
            "<script src='driver.js'></script></body></html>")
        profile = Path(work) / "profile"
        profile.mkdir()
        proc = subprocess.Popen(
            [str(CHROME), "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
             "--force-device-scale-factor=1", "--force-prefers-reduced-motion",
             f"--window-size={WINDOW_W},{WINDOW_H}", f"--user-data-dir={profile}",
             "--remote-debugging-port=0", f"file://{page}"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            port = _devtools_port(profile)
            cdp = CDP(*_page_socket(port))
            wait_js(cdp, "window.__ready")
            yield cdp
            cdp.close()
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()


def _devtools_port(profile: Path) -> int:
    marker = profile / "DevToolsActivePort"
    end = time.monotonic() + 30
    while time.monotonic() < end:
        if marker.exists():
            try:
                return int(marker.read_text().splitlines()[0])
            except (ValueError, IndexError):
                pass
        time.sleep(0.1)
    raise AssertionError("chrome never opened a devtools port")


def _page_socket(port: int):
    end = time.monotonic() + 30
    while time.monotonic() < end:
        try:
            targets = httpx.get(f"http://127.0.0.1:{port}/json/list", timeout=2).json()
        except httpx.HTTPError:
            targets = []
        for t in targets:
            if t.get("type") == "page" and t.get("url", "").endswith("probe.html"):
                _, rest = t["webSocketDebuggerUrl"].split("://", 1)
                hostport, path = rest.split("/", 1)
                return hostport.split(":")[0], int(hostport.split(":")[1]), "/" + path
        time.sleep(0.1)
    raise AssertionError("the probe page never appeared in the devtools target list")


PILL_RECT = "JSON.stringify(document.querySelectorAll('.hb-followups .hb-pill')[{}].getBoundingClientRect())"
CALLS = "JSON.stringify(window.__calls)"
SAID = "document.querySelector('.hb-followups-said').textContent"


def tap(cdp: CDP, n: int) -> None:
    """A real pointer event on pill n, converged on the page's own call counter — never on a paint."""
    rect = json.loads(cdp.js(PILL_RECT.replace("{}", str(n))))
    x, y = rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2
    before = len(json.loads(cdp.js(CALLS)))
    for _ in range(20):
        cdp.mouse(x, y)
        if len(json.loads(cdp.js(CALLS))) > before:
            return
        time.sleep(0.1)
    raise AssertionError(f"the tap on pill {n} never reached the host")


BOARD_REAL = {
    "blocks": [{"type": "heading", "text": "Kyoto, three days"},
               {"type": "text", "text": "Temples, trains and one very long evening walk."}],
    "follow_ups": SHORT_UPS,
}
BOARD_WHOLE = {  # round 2's pair, arriving through the REAL read
    "blocks": [{"type": "heading", "text": "Kyoto, three days"}],
    "follow_ups": [{"label": LONG_LABEL, "run": WHOLE_RUN}],
}
BOARD_GUARDED = {
    "blocks": [{"type": "heading", "text": "Kyoto, three days"}],
    "follow_ups": [{"label": "Reset", "run": "/reset"}, {"label": "Good", "run": "Tell me more"}],
}


def requires_chrome():
    if CHROME is None:
        pytest.skip("no Chrome/Chromium binary on this machine")
    if not ESBUILD.exists():
        pytest.skip("web/node_modules not installed — cannot bundle the real components")


@pytest.fixture(scope="module")
def driver_blocks() -> str:
    requires_chrome()
    return bundle(DRIVER_BLOCKS)


@pytest.fixture(scope="module")
def driver_tag() -> str:
    requires_chrome()
    return bundle(DRIVER_TAG)


class TestRealTapsOnTheShippedSeam:
    """BEHAVIOR — the real components, the real reader, the real seam, real pointer events."""

    def test_the_strip_really_draws_over_the_shipped_sheets(self, driver_blocks):
        requires_chrome()
        with chrome_page(BOARD_REAL, driver_blocks) as cdp:
            assert cdp.js("document.querySelectorAll('.hb-followups .hb-pill').length") == 3
            titles = json.loads(cdp.js("JSON.stringify([...document.querySelectorAll('.hb-followups"
                                      " .hb-pill')].map((b) => b.title))"))
            assert titles == [f["run"] for f in SHORT_UPS]  # the WHOLE prompt, in every title
            assert cdp.js("document.querySelectorAll('.hb-followups-said[role=status][aria-live=polite]').length") == 1
            assert cdp.js(SAID) in (None, "")  # no tap yet: the strip has said nothing, and claims nothing

    def test_a_real_click_submits_exactly_that_prompt(self, driver_blocks):
        requires_chrome()
        with chrome_page(BOARD_REAL, driver_blocks) as cdp:
            tap(cdp, 1)
            wait_js(cdp, SAID)
            assert json.loads(cdp.js(CALLS)) == [["submit", "Compare trains between Kyoto and Osaka"]]
            assert cdp.js(SAID) == SENT_WORD  # the host's own yes, not a promise of one

    def test_a_whole_long_prompt_is_posted_whole_in_one_tap(self, driver_blocks):
        # The reviewer's correction #1, pinned exactly: a 449-character follow-up must POST on ONE tap —
        # submit carrying the whole prompt exactly as the board stored it, arriving through the REAL read,
        # with insert never called. The reviewed deviation (long prompts drafted on this base's void seam)
        # has nowhere to hide here; the same guarantee holds for the >300-character criterion directly.
        requires_chrome()
        with chrome_page(BOARD_WHOLE, driver_blocks) as cdp:
            assert cdp.js("document.querySelectorAll('.hb-followups .hb-pill').length") == 1
            label = json.loads(cdp.js("JSON.stringify(document.querySelector('.hb-followup-label').textContent)"))
            assert label == LONG_LABEL  # whole in the DOM, wrapping (never cut to 40)
            title = cdp.js("document.querySelector('.hb-pill').getAttribute('title')")
            assert title == WHOLE_RUN  # whole in the hover truth (past the old 300-cap)
            assert len(WHOLE_RUN) > 300
            tap(cdp, 0)
            wait_js(cdp, SAID)
            calls = json.loads(cdp.js(CALLS))
            assert calls == [["submit", WHOLE_RUN]]  # EXACTLY the prompt: not cut, not drafted, not two messages
            assert cdp.js(SAID) == SENT_WORD

    def test_a_guarded_stored_run_never_becomes_a_pill(self, driver_blocks):
        requires_chrome()
        with chrome_page(BOARD_GUARDED, driver_blocks) as cdp:
            assert cdp.js("document.querySelectorAll('.hb-followups .hb-pill').length") == 1
            assert cdp.js("document.querySelector('.hb-followup-label').textContent") == "Good"
            tap(cdp, 0)
            wait_js(cdp, SAID)
            assert json.loads(cdp.js(CALLS)) == [["submit", "Tell me more"]]
            assert cdp.js(SAID) == SENT_WORD

    def test_a_command_run_crafted_past_the_reader_is_still_never_submitted(self, driver_blocks):
        requires_chrome()
        with chrome_page({"direct": True, "follow_ups": [{"label": "Reset", "run": "/reset"}]},
                         driver_blocks) as cdp:
            tap(cdp, 0)
            wait_js(cdp, SAID)
            calls = json.loads(cdp.js(CALLS))
            assert not any(c[0] == "submit" for c in calls)  # the guard holds even over the force route
            assert ["insert", "/reset"] in calls             # drafted, so the reader can see and decide
            assert cdp.js(SAID) == BLOCKED                   # and the strip says the REAL reason

    def test_a_refused_submit_falls_to_an_acknowledged_draft_and_says_so(self, driver_blocks):
        requires_chrome()
        with chrome_page(BOARD_REAL, driver_blocks) as cdp:
            cdp.js("window.__SUBMIT_OK__ = false, true")
            tap(cdp, 0)
            wait_js(cdp, SAID)
            calls = json.loads(cdp.js(CALLS))
            assert [k for k, _ in calls] == ["submit", "insert", "focus"], calls
            assert cdp.js(SAID) == DRAFTED_WORD  # only the host's ack of the insert earns even this word

    def test_an_insert_that_answers_nothing_admits_the_text_is_nowhere(self, driver_blocks):
        requires_chrome()
        with chrome_page(BOARD_REAL, driver_blocks) as cdp:
            cdp.js("window.__SUBMIT_OK__ = false; window.__INSERT_FAIL__ = true, true")
            tap(cdp, 0)
            wait_js(cdp, SAID)
            assert cdp.js(SAID) == FAILED_WORD  # nothing sent, nothing kept — the strip admits it
            assert cdp.js("document.querySelectorAll('.hb-followups .hb-pill').length") == 3  # taps stay, retryable

    def test_a_second_tap_while_the_host_is_silent_clears_the_stale_word(self, driver_blocks):
        # The reviewer's correction #2, observable in a real browser: tap A got "Sent to chat.", tap B goes
        # out while the host keeps its insert promise OPEN — the row must show the pending mark, never A's
        # leftover success, and when the host finally answers THIS tap the real word replaces it.
        requires_chrome()
        with chrome_page(BOARD_REAL, driver_blocks) as cdp:
            tap(cdp, 0)
            wait_js(cdp, SAID)
            assert cdp.js(SAID) == SENT_WORD
            cdp.js("window.__SUBMIT_OK__ = false; window.__SLOW__ = true; window.__GO__ = false, true")
            cdp.js("window.__calls.length = 0, true")
            tap(cdp, 1)
            got = wait_js(cdp, f"(() => document.querySelector('.hb-followups-said').textContent"
                               f" === '{PENDING_WORD}')()")
            assert got is True, "a new tap left the PREVIOUS tap's success word standing"
            cdp.js("window.__GO__ = true, true")  # the host finally answers THIS tap
            wait_js(cdp, f"(() => document.querySelector('.hb-followups-said').textContent"
                         f" === '{DRAFTED_WORD}')()")
            assert cdp.js(SAID) == DRAFTED_WORD

    def test_tab_then_enter_submits_the_prompt(self, driver_blocks):
        requires_chrome()
        with chrome_page(BOARD_REAL, driver_blocks) as cdp:
            cdp.key("Tab", "Tab", 9)
            wait_js(cdp, "document.activeElement.classList.contains('hb-pill')")
            assert cdp.js("document.querySelector('.hb-followup-label').textContent") == "Plan day 2"
            cdp.key("Enter", "Enter", 13, text="\r")  # trusted activation: the key event carries text
            wait_js(cdp, SAID)
            assert json.loads(cdp.js(CALLS)) == [["submit", "Plan the second day of my Kyoto itinerary"]]
            assert cdp.js(SAID) == SENT_WORD

    def test_a_board_that_says_nothing_draws_no_strip(self, driver_blocks):
        requires_chrome()
        plain = {"blocks": [{"type": "heading", "text": "Kyoto, three days"}]}
        with chrome_page(plain, driver_blocks) as cdp:
            assert cdp.js("document.querySelectorAll('.hb-followups').length") == 0
            assert cdp.js("document.querySelectorAll('.hb-followups-said').length") == 0
            assert cdp.js("document.querySelectorAll('.hb-blocks').length") == 1


class TestTheTagCarriesTheStrip:
    """COMPOSITION — the real BlockTag over the REST-shaped answer."""

    def test_the_strip_rides_the_ones_blocks_element_of_the_tag(self, driver_tag):
        requires_chrome()
        with chrome_page(BOARD_REAL, driver_tag) as cdp:
            wait_js(cdp, "document.querySelectorAll('.hb-followups .hb-pill').length === 3")
            shape = cdp.js("""(() => {
                const block = document.querySelector('.hb-blocks');
                const strip = block.querySelector('.hb-followups');
                return JSON.stringify({one: document.querySelectorAll('.hb-blocks').length,
                                       last: block.lastElementChild === strip,
                                       parent: strip.parentElement.className});
            })()""")
            report = json.loads(shape)
            assert report["one"] == 1            # never a second renderer
            assert report["last"] is True        # beneath everything the board draws
            assert report["parent"] == "hb-blocks"

    def test_a_tap_through_the_tag_submits_exactly_the_prompt(self, driver_tag):
        requires_chrome()
        with chrome_page(BOARD_REAL, driver_tag) as cdp:
            wait_js(cdp, "document.querySelectorAll('.hb-followups .hb-pill').length === 3")
            tap(cdp, 2)
            wait_js(cdp, SAID)
            assert json.loads(cdp.js(CALLS)) == [["submit", "What will the whole trip cost?"]]
            assert cdp.js(SAID) == SENT_WORD  # the word rides the tag's OWN provider, over the real seam

    def test_a_tag_on_a_plain_board_draws_what_it_always_drew(self, driver_tag):
        requires_chrome()
        plain = {"blocks": [{"type": "heading", "text": "Kyoto, three days"}]}
        with chrome_page(plain, driver_tag) as cdp:
            wait_js(cdp, "document.querySelectorAll('.hb-blocks').length === 1")
            assert cdp.js("document.querySelectorAll('.hb-followups').length") == 0
            assert cdp.js("document.querySelectorAll('.hb-followups-said').length") == 0
