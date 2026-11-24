"""The block store: one JSON file per drawn block, named by a short random id.

A tool saves a list of blocks and gets back an id; the reply carries only `::blocks{id="..."}`,
and the Desktop half fetches the JSON by that id. Blocks are never deleted, so old chats still draw.
"""

import json
import re
import secrets
from datetime import UTC, datetime
from pathlib import Path

# 8 lowercase hex characters, e.g. "7f3a09bc". Anything else is refused before touching the disk.
ID_PATTERN = r"^[0-9a-f]{8}$"


# Where a profile keeps its blocks, under its Hermes home.
STORE_DIR = Path("plugin-data") / "hermes-genui" / "blocks"


def default_root() -> Path:
    """Where this profile keeps its blocks: <hermes home>/plugin-data/hermes-genui/blocks."""
    from hermes_constants import get_hermes_home  # only importable inside Hermes

    return get_hermes_home() / STORE_DIR


def profile_stores(hermes_root: Path | None = None) -> list[Path]:
    """Every profile's block store on this machine: the root profile's, then each named profile's, by name. Folders
    starting with "." (such as the profiles/.deleted tombstone) are not profiles. Outside Hermes, with no root given,
    there are none.

    profile_stores(~/.hermes) → [~/.hermes/plugin-data/hermes-genui/blocks,
                                 ~/.hermes/profiles/claude/plugin-data/hermes-genui/blocks, ...]
    """
    if hermes_root is None:
        try:
            from hermes_constants import get_default_hermes_root
        except ImportError:
            return []
        hermes_root = get_default_hermes_root()
    profiles = hermes_root / "profiles"
    found = profiles.iterdir() if profiles.is_dir() else []
    named = sorted(p for p in found if p.is_dir() and not p.name.startswith("."))
    return [home / STORE_DIR for home in [hermes_root, *named]]


def find_root(block_id: str, roots: list[Path] | None = None) -> Path | None:
    """The store that holds a board: the active profile's first, then every other profile's. Hermes Desktop lists
    sessions from all profiles but asks the active profile for a board, so a board drawn in profile A and viewed while
    profile B is active is only in A's store (issue #6). None when the id is malformed or no store has it.

    find_root("7f3a09bc") → ~/.hermes/profiles/claude/plugin-data/hermes-genui/blocks;  find_root("../x") → None
    """
    if not re.fullmatch(ID_PATTERN, block_id or ""):
        return None
    for folder in roots if roots is not None else [default_root(), *profile_stores()]:
        if (folder / f"{block_id}.json").is_file():
            return folder
    return None


# The most a stored board may take on disk. show_blocks refuses a bigger one with a note to the model first; this is
# the last guard for every other caller.
BOARD_LIMIT = 256 * 1024


class BoardTooBig(ValueError):
    """The board is over BOARD_LIMIT bytes as JSON."""


def board_size(blocks: list | dict) -> int:
    """How many bytes a board takes stored: board_size([{"type": "divider"}]) → 20"""
    return len(json.dumps(blocks, ensure_ascii=False).encode("utf-8"))


def save(blocks: list[dict] | dict, root: Path | None = None) -> str:
    """Store a board (a list of blocks, or the envelope a live board's links ride in) and return its new id.
    Refused (BoardTooBig, nothing written) over BOARD_LIMIT.

    The id is one no store on this machine uses yet (with root given, no board in root), so a new board never
    overwrites an old one and find_root never finds another profile's board under the same id.
    """
    text = json.dumps(blocks, ensure_ascii=False)
    if len(text.encode("utf-8")) > BOARD_LIMIT:
        raise BoardTooBig(f"{len(text.encode('utf-8'))} bytes")
    folder = root or default_root()
    folder.mkdir(parents=True, exist_ok=True)
    block_id = _unused_id([root] if root else [folder, *profile_stores()])
    _write_whole(folder / f"{block_id}.json", text)
    return block_id


def _unused_id(stores: list[Path]) -> str:
    """A random id with no board under it in any of these stores. With 4.3 billion ids and a few thousand boards, the
    first pick is almost always free; a taken one is simply drawn again.

    _unused_id([active, other]) where other holds a6600503.json → never "a6600503"
    """
    while True:
        block_id = secrets.token_hex(4)
        if not any((folder / f"{block_id}.json").exists() for folder in stores):
            return block_id


def _write_whole(path: Path, text: str) -> None:
    """Write a file so a reader sees the old one or the new one, never half of it: the text goes to <name>.tmp in
    the same folder, which then replaces the file in one step.

    _write_whole(.../7f3a09bc.json, "[...]") → writes 7f3a09bc.json.tmp, then renames it to 7f3a09bc.json
    """
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)  # os.replace: one step, on the same disk


def _read_json(path: Path) -> object | None:
    """A JSON file's contents, or None when it is missing or isn't readable JSON (a damaged file is treated as no
    file, so the API answers 404 rather than failing)."""
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def size(block_id: str, root: Path | None = None) -> int | None:
    """How many bytes a stored board takes, without reading it; None when the id is malformed or unknown.

    size("7f3a09bc") → 2048;  size("../etc/passwd") → None
    """
    if not re.fullmatch(ID_PATTERN, block_id or ""):
        return None
    path = (root or default_root()) / f"{block_id}.json"
    return path.stat().st_size if path.is_file() else None


def load(block_id: str, root: Path | None = None) -> list[dict] | None:
    """The stored blocks for an id, or None when the id is malformed or unknown.

    load("7f3a09bc") → [{"type": "chart", ...}]
    load("../etc/passwd") → None (never a path outside the store)
    load("0badc0de") where the file holds "[{not json" → None
    """
    if not re.fullmatch(ID_PATTERN, block_id or ""):
        return None
    return _read_json((root or default_root()) / f"{block_id}.json")


# --- living boards: a board's id is its address, and an update writes a new VERSION at that address ----------------
# A board drawn into a chat is not a dead snapshot: show_blocks can be told to update the board an address
# names. The new content replaces <id>.json AT THE SAME ADDRESS (the tag the chat already quotes keeps
# drawing, now the current version), and the version that was current is archived, whole, into a
# <id>.versions.json sidecar beside it. History is BOUNDED by design: the sidecar keeps the newest
# HISTORY_MAX archived versions within HISTORY_LIMIT bytes and drops the oldest when either cap is
# crossed; reach-back past the cap answers like an unknown version, and the CURRENT version is never
# dropped. A board that was never updated carries no version word at all and answers load() with
# exactly the bytes it always had.

HISTORY_SUFFIX = ".versions.json"
HISTORY_MAX = 8                 # the newest archived versions kept; the live one answers load()
HISTORY_LIMIT = 512 * 1024      # the sidecar's byte cap; oldest archived entries drop to stay under it


def blocks_of(board: object) -> list:
    """The blocks inside a stored board, either shape: the plain list it has always been, or the envelope
    {"version": ..., "blocks": [...]} that an update-in-place leaves at the address. Anything else gives no blocks.

    blocks_of([chart, source]) → [chart, source]
    blocks_of({"version": 2, "blocks": [chart]}) → [chart]
    blocks_of(None) → []
    """
    if isinstance(board, list):
        return board
    if isinstance(board, dict) and isinstance(board.get("blocks"), list):
        return board["blocks"]
    return []


def version_of(board: object) -> int | None:
    """The version number a stored envelope carries (an update stamps it), or None when the board never spoke
    one — which is every board that was only ever saved. Text is not a number here, and neither is a bool.

    version_of({"version": 2, "blocks": [x]}) → 2;  version_of([x]) → None;  version_of({"version": "2"}) → None
    """
    value = board.get("version") if isinstance(board, dict) else None
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value if value >= 1 else None


def updated_at_of(board: object) -> str | None:
    """The moment an update wrote this version, as an ISO line, or None. Here only "is it a non-empty
    string" is checked; who wrote the word decided it was worth storing."""
    line = board.get("updated_at") if isinstance(board, dict) else None
    return line if isinstance(line, str) and line else None


def links_of(board: object) -> list | None:
    """The links a stored envelope carries to other boards by address, or None. The shape was checked where
    it was written (show_blocks refuses a link to no board); here only "is it a list with anything in it".

    links_of({"links": [{"id": "7f3a09bc", "note": "vs Q3"}], "blocks": [x]}) → [that list]
    links_of([x]) → None;  links_of({"links": "yes", ...}) → None
    """
    links = board.get("links") if isinstance(board, dict) else None
    return links if isinstance(links, list) and links else None


def history_path(block_id: str, root: Path) -> Path:
    """Where a board's archived versions live: <id>.versions.json, beside the board file itself."""
    return root / f"{block_id}{HISTORY_SUFFIX}"


def load_versions(block_id: str, root: Path | None = None) -> list:
    """The archived versions of a board, oldest first, each {"version", "saved_at", "board"}; [] when the id
    is malformed, unknown, or was never updated. The archived board is kept exactly as it was saved (a
    plain list or an envelope), so every version's own words ride with it."""
    if not re.fullmatch(ID_PATTERN, block_id or ""):
        return []
    folder = root or find_root(block_id)
    if folder is None:
        return []
    history = _read_json(history_path(block_id, folder))
    versions = history.get("versions") if isinstance(history, dict) else None
    return versions if isinstance(versions, list) else []


def update(block_id: str, board: list[dict] | dict, root: Path | None = None) -> str:
    """Write a NEW version of the board an address names, at that same address, and answer the address back.

    The board that was current is archived whole (version + saved_at + its exact stored content) into the
    sidecar, capped at HISTORY_MAX versions and HISTORY_LIMIT bytes, oldest first; the new content is
    written to <id>.json with version bumped and updated_at stamped. The envelope's words belong to the
    version that said them — the new board carries only what this call gave it.

    Refused, with nothing written, before any disk is touched: a malformed or unknown address
    (NoSuchBlock — the same honesty rule as save_state), or a board over BOARD_LIMIT (BoardTooBig).

    A write stays in its own profile: with no root given, the address resolves ONLY in the active
    profile's store. Reaching across profiles is right for reading a board (find_root, issue #6) but
    an update never writes into another profile's bytes — a board owned elsewhere answers NoSuchBlock here.
    """
    if not re.fullmatch(ID_PATTERN, block_id or ""):
        raise NoSuchBlock(block_id)
    folder = root or default_root()
    current = _read_json(folder / f"{block_id}.json")
    if current is None:
        raise NoSuchBlock(block_id)
    envelope: dict = dict(board) if isinstance(board, dict) else {"blocks": board}
    envelope["version"] = (version_of(current) or 1) + 1
    envelope["updated_at"] = _now()
    text = json.dumps(envelope, ensure_ascii=False)
    if len(text.encode("utf-8")) > BOARD_LIMIT:
        raise BoardTooBig(f"{len(text.encode('utf-8'))} bytes")
    archived = load_versions(block_id, folder) + [
        {"version": version_of(current) or 1, "saved_at": updated_at_of(current), "board": current}
    ]
    archived = archived[-HISTORY_MAX:]
    while len(json.dumps({"versions": archived}, ensure_ascii=False).encode("utf-8")) > HISTORY_LIMIT:
        archived.pop(0)
    _write_whole(history_path(block_id, folder), json.dumps({"versions": archived}, ensure_ascii=False))
    _write_whole(folder / f"{block_id}.json", text)
    return block_id


def _now() -> str:
    """The moment, as an ISO line with seconds: what an update stamps its version with."""
    return datetime.now(UTC).isoformat(timespec="seconds")


def follow_ups_of(board: object) -> list | None:
    """The tappable follow-ups a stored envelope carries for the whole board, or None. The shape was checked
    where it was written (show_blocks refuses an unusable one); here only "is it a list with anything in it".

    follow_ups_of({"follow_ups": [{"label": "Go", "run": "More"}], "blocks": [x]}) → [that list]
    follow_ups_of([x]) → None;  follow_ups_of({"follow_ups": "yes", ...}) → None
    """
    ups = board.get("follow_ups") if isinstance(board, dict) else None
    return ups if isinstance(ups, list) and ups else None


PHOTO_LIST = "photo-urls.txt"
# Only the most recent photo URLs are kept: enough for the boards of a conversation, and the file stays small.
MAX_PHOTO_URLS = 500


def remember_photo_urls(urls: list[str], root: Path | None = None) -> None:
    """Note photo URLs a tool returned, so show_blocks can refuse any the model made up. Only the last 500 are kept.

    450 noted, then 100 more → the file holds the last 350 of the first lot and all 100 new ones
    """
    folder = root or default_root()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / PHOTO_LIST
    old = path.read_text(encoding="utf-8").splitlines() if path.is_file() else []
    kept = [line for line in old if line.strip()] + [url for url in urls if url]
    _write_whole(path, "".join(f"{url}\n" for url in kept[-MAX_PHOTO_URLS:]))


def known_photo_urls(root: Path | None = None) -> set[str]:
    path = (root or default_root()) / PHOTO_LIST
    if not path.is_file():
        return set()
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


# What the user did to a stored board (a checklist's ticks), kept beside it as <id>.state.json so it follows them to
# every device. Small by design: a list of ticks per checklist, nothing like a document.
STATE_LIMIT = 20 * 1024


class NoSuchBlock(LookupError):
    """The id is malformed, or no board is stored under it."""


class StateTooBig(ValueError):
    """The state is over STATE_LIMIT bytes as JSON."""


def load_state(block_id: str, root: Path | None = None) -> dict:
    """The saved state for a board, or {} when there is none (or the id is malformed).

    load_state("7f3a09bc") → {"0": [0, 2]}   (the first block, a checklist, has items 0 and 2 ticked)
    load_state("../etc/passwd") → {}
    load_state("7f3a09bc") where the file holds "{half" → {}
    """
    if not re.fullmatch(ID_PATTERN, block_id or ""):
        return {}
    state = _read_json((root or default_root()) / f"{block_id}.state.json")
    return state if isinstance(state, dict) else {}


def save_state(block_id: str, state: dict, root: Path | None = None) -> None:
    """Replace a board's saved state. Refused for an id with no stored board, and for a state over 20 KB.

    save_state("7f3a09bc", {"0": [0, 2]}) → written to 7f3a09bc.state.json
    save_state("0badc0de", {...}) where no such board → NoSuchBlock;  {"0": "x" * 30000} → StateTooBig
    """
    if load(block_id, root) is None:
        raise NoSuchBlock(block_id)
    text = json.dumps(state, ensure_ascii=False)
    if len(text.encode("utf-8")) > STATE_LIMIT:
        raise StateTooBig(block_id)
    _write_whole((root or default_root()) / f"{block_id}.state.json", text)
