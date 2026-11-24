"""Helpers every block type shares: small checks on the model's fields, and the safe-text pieces the plain-text
versions are built from.

Everything the text side writes is shown in apps that render Markdown, and the blocks came from a model: control
characters are stripped, every string is capped, Markdown's link, image and HTML marks in the model's text are escaped
(so only links the renderer builds itself are links) and only http(s) URLs survive.
"""

import json
import re
from pathlib import Path

# --- checking ---------------------------------------------------------------------------------------------------


def has_text(value: object) -> bool:
    return isinstance(value, str) and value.strip() != ""


def is_number(v: object) -> bool:
    return isinstance(v, int | float) and not isinstance(v, bool)


def has_any_text(block: dict, *keys: str) -> bool:
    """Whether any of the fields the drawing side reads (the main name, then its aliases) holds text.

    has_any_text({"name": "Dyu"}, "title", "name") → True;  has_any_text({"title": " "}, "title") → False
    """
    return any(has_text(block.get(k)) for k in keys)


def first_list(block: dict, *keys: str) -> list:
    """The first of several fields that is a list, else []: first_list({"rows": [1]}, "items", "rows") → [1]"""
    return next((block[k] for k in keys if isinstance(block.get(k), list)), [])


def is_https(v: object) -> bool:
    return isinstance(v, str) and v.startswith("https://")


# The three placement words, on this side and the web's (core/fields.ts align): anything else a model wrote is
# ignored, and the block sits left (align) or reads left (text_align). Both words share the one reader.
ALIGN_WORDS = ("left", "center", "right")


def align_word(value: object) -> str | None:
    """One of the alignment words, trimmed and caseless the way models write; anything else gives None.

    " Center " → "center";  "middle" → None. Used for `align` (where the card sits) and `text_align` (how its
    words read), for a whole board and, leniently at draw time, for any block inside it.
    """
    if not isinstance(value, str):
        return None
    word = value.strip().lower()
    return word if word in ALIGN_WORDS else None



# A button's message is sent as the user's own, and Hermes acts on some messages before the model reads them: "/reset"
# runs a command, "!…" a shell line, and "@file:path", "@url:…" (any "@word:"), "@diff" or "@staged" pull a file, a
# page or the working tree into the message. A button may not send any of these.
AT_REFERENCE = re.compile(r"@\w[\w-]*:|@(?:diff|staged)\b")
NO_SEND = "a button's message can't start with / @ or ! or carry @-references"


def acts_before_the_model(message: object) -> bool:
    """Whether Hermes would act on a message itself (a command, a shell line or an @-reference) if a button sent it.

    "/reset" → True;  "  @file:notes.txt" → True;  "!ls" → True;  "Summarise @url:https://x.org" → True
    "Email name@example.com" → False;  "Meet @ 5pm" → False;  "Plan day 2" → False;  None → False
    """
    if not isinstance(message, str):
        return False
    text = message.strip()
    return text[:1] in ("/", "@", "!") or AT_REFERENCE.search(text) is not None


# A short lowercase name another block can point at: a flow's id, its nodes' ids, a steps block's `for`.
SLUG = re.compile(r"[a-z][a-z0-9_-]{0,23}")
SLUG_RULE = 'a short lowercase slug like "tf" (a-z, 0-9, - or _; up to 24)'


def is_slug(value: object) -> bool:
    """"tf" → True;  "next-word" → True;  "Big Flow" → False;  "__proto__" → False;  5 → False"""
    return isinstance(value, str) and SLUG.fullmatch(value) is not None


def short_text(value: object, limit: int) -> bool:
    """Whether an optional field is absent or text of at most `limit` characters: None → yes;  "Tok" → yes;  5 → no"""
    return value is None or (isinstance(value, str) and len(value) <= limit)


def catalog_icons() -> frozenset[str]:
    """The icon names blocks may use, as listed in core/catalog.json (the web side keeps the same list in icons.ts)."""
    catalog = Path(__file__).resolve().parent.parent / "core" / "catalog.json"
    return frozenset(json.loads(catalog.read_text(encoding="utf-8"))["icons"])


def needs_text(block: dict, path: str) -> list[tuple[str, str]]:
    if has_text(block.get("text")):
        return []
    return [(path, f"{block['type']} needs text")]


# --- plain text ---------------------------------------------------------------------------------------------------

MAX_STRING = 300
MAX_URL = 500
MAX_CELL = 80

# C0/C1 control characters (but newline and tab), zero-width marks and bidi overrides: none belong in a chat message.
# Written as escapes, so the file itself holds no invisible characters.
CONTROL = re.compile("[\x00-\x08\x0b-\x1f\x7f-\x9f\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069"
                     "\ufeff]")


def fmt_num(v: float) -> str:
    """A number as people read it.

    72275 → "72,275";  18.6 → "18.6";  7200.0 → "7,200";  1234.5678 → "1,234.57";  0.004567 → "0.00457"
    """
    if v != v or v in (float("inf"), float("-inf")):
        return ""
    if isinstance(v, float) and v.is_integer() and abs(v) < 1e15:
        v = int(v)
    if isinstance(v, int):
        return f"{v:,}"
    if abs(v) >= 1:
        return f"{v:,.2f}".rstrip("0").rstrip(".")
    return f"{v:.3g}"


# The characters that make a link, an image or HTML in Markdown (and the backslash, which would undo an escape).
MARKDOWN_MARKS = re.compile(r"([\\\[\]<>])")


def md_escape(text: str) -> str:
    """Text with Markdown's link, image and HTML marks escaped, so it shows as written and links nowhere.

    Escaping the brackets is enough: without "[…]" there is no link or image, so ( ) and ! stay readable.
    "[here](javascript:alert(1))" → "\\[here\\](javascript:alert(1))";  "![x](http://e/p.png)" → "!\\[x\\](http://e/p.png)"
    "<b>" → "\\<b\\>";  "Day 1 · **book**" → the same (bold and the rest are harmless)
    """
    return MARKDOWN_MARKS.sub(r"\\\1", text)


def safe_text(value: object, limit: int = MAX_STRING, inline: bool = True) -> str:
    """A field as safe, short text: numbers formatted, other non-strings dropped, control characters stripped, capped,
    and Markdown's link, image and HTML marks escaped (md_escape).

    "a\\x1b[31mb" → "a\\[31mb";  "one\\ntwo" → "one two" (inline);  72275 → "72,275";  None → "";
    "x" * 400 → 299 x + "…"
    "[here](javascript:x)" → "\\[here\\](javascript:x)";  "Revenue (Q3) rose!" → the same
    """
    if is_number(value):
        return fmt_num(value)
    if not isinstance(value, str):
        return ""
    text = CONTROL.sub("", value).replace("\t", " ")
    if inline:
        text = text.replace("\n", " ")
    text = text.strip()
    return md_escape(text if len(text) <= limit else text[: limit - 1] + "…")


def one_line(value: object, limit: int) -> str:
    """Third-party text (a web caption, a market's name) as one plain line: control and bidi characters stripped,
    every run of spaces or newlines made one space, cut to `limit` characters.

    ("Nice\u202e view\x07\nmore", 80) → "Nice view more";  ("x" * 100, 60) → 60 x;  (None, 60) → ""
    """
    if not isinstance(value, str):
        return ""
    return " ".join(CONTROL.sub("", value).split())[:limit].rstrip()


def first_of(block: dict, *keys: str, limit: int = MAX_STRING) -> str:
    """The first of several fields (a main name, then its aliases) that has text: first_of({"name": "Dyu"}, "title",
    "name") → "Dyu"."""
    return next((t for t in (safe_text(block.get(k), limit) for k in keys) if t), "")


def safe_url(value: object, https_only: bool = False) -> str:
    """A URL safe to put inside Markdown's (...), or "" when it isn't http(s).

    "https://a.org/a b)(c" → "https://a.org/a%20b%29%28c"
    "javascript:alert(1)" → "";  "http://x.org" with https_only → ""
    """
    if not isinstance(value, str):
        return ""
    url = CONTROL.sub("", value).strip()
    schemes = ("https://",) if https_only else ("https://", "http://")
    if not url.lower().startswith(schemes) or len(url) > MAX_URL:
        return ""
    for raw, safe in ((" ", "%20"), ("(", "%28"), (")", "%29"), ("<", "%3C"), (">", "%3E"), ("\n", "")):
        url = url.replace(raw, safe)
    return url


def md_link(text: str, url: str) -> str:
    """A link the renderer builds: `text` is already safe (from safe_text, or md_escape'd), `url` from safe_url.

    ("Book", "https://x.org") → "[Book](https://x.org)";  ("Book", "") → "Book"
    """
    return f"[{text}]({url})" if url else text


def with_unit(value: str, unit: str) -> str:
    """A value and its unit; a % sits tight: ("18.6", "%") → "18.6%";  ("72,275", "₹Cr") → "72,275 ₹Cr"."""
    if not unit:
        return value
    return f"{value}{unit}" if unit == "%" else f"{value} {unit}"


def change_chip(change: object, unit: object = "%") -> str:
    """A change chip: (2.2, "%") → "(▲ 2.2%)";  (-0.9, "pt") → "(▼ 0.9pt)";  None → ""."""
    if not is_number(change):
        return ""
    arrow = "▼" if change < 0 else "▲"
    return f"({arrow} {fmt_num(abs(change))}{safe_text(unit, 8) or '%'})"


def out_of(label: str, value: object, goal: object, unit: object) -> str:
    """The value against its goal. An unknown figure (None) keeps its place and reads "no data"; the other still shows,
    with the unit it would have got from the goal, since it is now the only number there.

    ("Level 4", 95, 120, "XP") → "Level 4: 95 / 120 XP";  ("Level 5", None, 120, "XP") → "Level 5: no data / 120 XP";
    ("Level 5", 95, None, "XP") → "Level 5: 95 XP / no data";  ("Level 5", 95, None, "₹") → "Level 5: 95 ₹ / no data"
    """
    if not label or not (is_number(value) or value is None) or not (is_number(goal) or goal is None):
        return ""
    unit_text = safe_text(unit, 20)
    shown = "no data" if value is None else fmt_num(value)
    if value is not None and goal is None:
        shown = with_unit(shown, unit_text)   # the goal wrote the unit; with no goal the value keeps it
    target = "no data" if goal is None else with_unit(fmt_num(goal), unit_text)
    return f"{label}: {shown} / {target}"


def table_cell(value: object) -> str:
    """A table cell: short, one line, its pipes escaped. "a|b" → "a\\|b"."""
    return safe_text(value, MAX_CELL).replace("|", "\\|")


def cell_value(value: object) -> str:
    """A table cell whose null means unknown: a written null shows a dash, so it isn't read as an empty cell or a 0.

    12 → "12";  None → "–";  "n/a" → "n/a"
    """
    return "–" if value is None else table_cell(value)


def md_table(header: list[str], rows: list[list[str]]) -> list[str]:
    """Markdown table lines, every row padded to the header's width."""
    width = len(header)
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * width) + " |"]
    lines += ["| " + " | ".join((row + [""] * width)[:width]) + " |" for row in rows]
    return lines


# --- what a board can point at next (living boards: addresses, targets and links) -----------------------------------

# A board's address is its stored id: eight lowercase hex characters, the same bytes that ride its tag. The
# model may write it as returned, in caps, or with a leading # (people quote handles that way) — all of them
# mean the same address. Anything else is not an address at all.
ADDRESS = re.compile(r"#?([0-9a-f]{8})")


def board_address(value: object) -> str | None:
    """The board address a model's words name, or None when they name nothing.
    "7f3a09bc" → "7f3a09bc";  "#7F3A09BC" → "7f3a09bc";  "sevenbeef" → None."""
    if not isinstance(value, str):
        return None
    match = ADDRESS.fullmatch(value.strip().lower())
    return match.group(1) if match else None


# The most boards one may link to: a comparison is a handful of boards, not a shelf.
LINK_MAX = 3


def link_problems(value: object) -> list[str]:
    """Problems with the shape of a board's links, as "<path>: <why>"; [] when it says nothing or says it
    well. Whether an address names a real board is the tool's business (it owns the store); this answers only
    the shape. A link is a bare address or {"id": address, "note": one line}; the note, when present, must
    be text — it is the AI-suggested connection the reader sees beside the link."""
    if value is None:
        return []
    if not isinstance(value, list):
        return ['links: needs a list of boards to connect — each one an address ("7f3a09bc") '
                'or {"id": "7f3a09bc", "note": "one line"}']
    if not 1 <= len(value) <= LINK_MAX:
        return [f"links: needs 1-{LINK_MAX} boards"]
    problems = []
    for i, item in enumerate(value):
        raw = item if isinstance(item, str) else (item.get("id") if isinstance(item, dict) else None)
        if board_address(raw) is None:
            problems.append(f'links.{i}: not a board address — the 8 characters of a tag id, as "7f3a09bc"')
        elif isinstance(item, dict) and "note" in item and not isinstance(item["note"], str):
            problems.append(f"links.{i}: the note must be one line of text")
    return problems


def link_words(value: object) -> list[dict] | None:
    """The links as they should be stored: each address normalized (lower-case, no #), notes kept whole with
    control characters stripped, and duplicate addresses collapsed (the same board linked twice is one link).
    Call after link_problems has said []. None when the board said nothing."""
    if not isinstance(value, list) or not value:
        return None
    words: list[dict] = []
    seen: set[str] = set()
    for item in value:
        raw = item if isinstance(item, str) else item.get("id")
        addr = board_address(raw)
        if addr is None or addr in seen:
            continue
        seen.add(addr)
        note = item.get("note") if isinstance(item, dict) else None
        entry = {"id": addr}
        if isinstance(note, str) and note.strip():
            entry["note"] = CONTROL.sub("", note).strip()
        words.append(entry)
    return words


# --- where the board's data came from and when (the envelope's provenance words) ---------------------------------

# The as_of line is shown as one quiet footer line, not parsed: any date or timestamp text is fine, cut short so
# it stays a line. Non-text and blanks are ignored, as every model word is.
AS_OF_MAX = 80


def as_of_line(value: object) -> str | None:
    """A date/timestamp line safe to show: trimmed text (control characters stripped) capped at AS_OF_MAX, or None
    when it isn't usable text. " 2026-11-18 " → "2026-11-18";  5 → None;  "  " → None."""
    if not isinstance(value, str):
        return None
    text = CONTROL.sub("", value).replace("\t", " ").strip()
    return text[:AS_OF_MAX] if text else None


def live_flag(value: object) -> bool | None:
    """The board's own word for whether its figures update: a real bool is kept (false means snapshot, and is a
    word of its own); anything else — "yes", 1, missing — gives None and is ignored."""
    return value if isinstance(value, bool) else None
# --- what the reader can tap next (the envelope's follow-up words) ----------------------------------------------

# A quiet strip of up to four prompts the AI offers under its board; the reader taps one to continue the
# conversation. The count belongs to the strip, not to the store, so the writer is told 1-4 (as it is for a
# row of action buttons) and the drawing side keeps the first four whatever a stored board carries.
FOLLOW_UP_MAX = 4


def follow_up_problems(value: object) -> list[str]:
    """Problems with the follow-ups a board's envelope declares, as "<path>: <why>"; [] when it says nothing or
    says it well. A follow-up tap sends its message as the reader's own, so a message Hermes would act on before
    the model is refused exactly as a button's is, and every button needs both halves.

    None → []                                     (the board said nothing)
    "keep going" → ['follow_ups: needs a list of buttons, each with a label and a run message']
    [] or five items → ['follow_ups: needs 1-4 buttons']
    {"label": "Go"} → ['follow_ups.0: button needs a label and a run message']
    {"label": "Go", "run": "/reset"} → ['follow_ups.0: ' + NO_SEND]
    """
    if value is None:
        return []
    if not isinstance(value, list):
        return ["follow_ups: needs a list of buttons, each with a label and a run message"]
    if not 1 <= len(value) <= FOLLOW_UP_MAX:
        return [f"follow_ups: needs 1-{FOLLOW_UP_MAX} buttons"]
    problems = []
    for i, item in enumerate(value):
        if not (isinstance(item, dict) and has_text(item.get("label")) and has_text(item.get("run"))):
            problems.append(f"follow_ups.{i}: button needs a label and a run message")
        elif acts_before_the_model(item["run"]):
            problems.append(f"follow_ups.{i}: {NO_SEND}")
    return problems


def follow_up_words(value: object) -> list[dict] | None:
    """The follow-ups as they should be stored: each label and message with control characters stripped and
    blanks trimmed, or None when the board said nothing. Call after follow_up_problems has said []: messages
    are kept whole — the reader's length convention alone decides what a tap does with a long one (as it does
    for every tap today), and how much room a label has is the drawing side's business, as it is for every
    block."""
    if not isinstance(value, list) or not value:
        return None
    return [{"label": CONTROL.sub("", item.get("label", "")).strip(),
             "run": CONTROL.sub("", item.get("run", "")).strip()} for item in value if isinstance(item, dict)]
