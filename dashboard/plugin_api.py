"""Serves stored blocks to the Desktop half: GET /api/plugins/hermes-genui/blocks/<id>, plus what the user did to
them (a checklist's ticks): GET and PUT /blocks/<id>/state; and the Today page and kept dashboards: /dashboard,
/pages, and the buttons on the assistant's items. Desktop asks the active profile for every board, so a board
missing from this profile's store is looked up in the other profiles' stores (store.find_root), and its ticks are
kept beside it there.

Hermes imports this file on its own (not as part of the plugin package), so core/store.py is loaded by path
(it imports nothing from the package).
"""

import importlib.util
import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse


def _load_store():
    path = Path(__file__).resolve().parent.parent / "core" / "store.py"
    spec = importlib.util.spec_from_file_location("hermes_genui_store", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_by_path(name: str, *parts: str):
    path = Path(__file__).resolve().parent.parent.joinpath(*parts)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


store = _load_store()
assistant_memory = _load_by_path("hermes_genui_assistant_memory", "core", "assistant", "memory.py")
dashboard_spec = _load_by_path("hermes_genui_dashboard_spec", "core", "dashboard", "spec.py")
dashboard_assemble = _load_by_path("hermes_genui_dashboard_assemble", "core", "dashboard", "assemble.py")
pages_store = _load_by_path("hermes_genui_pages_store", "core", "pages", "store.py")
pages_layout = _load_by_path("hermes_genui_pages_layout", "core", "pages", "layout.py")
pages_refresh = _load_by_path("hermes_genui_pages_refresh", "core", "pages", "refresh.py")
router = APIRouter()
BUTTON_STATUSES = ("done", "dismissed", "pending", "suggested")
_CHECKER: list = []


def _checker():
    """The block checker show_blocks uses (core/check.py), from the plugin package loaded under a private name: it
    imports the block modules, so it can't be loaded by path on its own. None if that fails (the web reader still
    drops malformed blocks)."""
    if not _CHECKER:
        try:
            import sys
            root = Path(__file__).resolve().parent.parent
            name = "hermes_genui_dashboard_pkg"
            if name not in sys.modules:
                spec = importlib.util.spec_from_file_location(name, root / "__init__.py",
                                                              submodule_search_locations=[str(root)])
                package = importlib.util.module_from_spec(spec)
                sys.modules[name] = package
                spec.loader.exec_module(package)
            _CHECKER.append(importlib.import_module(f"{name}.core.check").check_blocks)
        except Exception:  # noqa: BLE001 - validation is a safety net here, not a requirement
            _CHECKER.append(None)
    return _CHECKER[0]


@router.get("/dashboard")
def get_dashboard():
    """The Today dashboard, assembled from its spec: {"title", "blocks", "live"}; empty without a spec. No model."""
    root = store.default_root()
    spec = dashboard_spec.load_spec(root)
    if spec is None:
        return {"title": None, "blocks": [], "live": False}
    sources = dashboard_assemble._sources()
    ctx = sources.Context(now=datetime.now().astimezone(), home=root.parents[2] if len(root.parents) > 2 else root,
                          blocks_root=root)
    check = _checker()
    return dashboard_assemble.assemble(spec, ctx, (lambda blocks: check(blocks, page=True)) if check else None)


@router.get("/dashboard/head")
def get_dashboard_head():
    """Whether there is a dashboard, cheaply (the sidebar row asks every few seconds): {"title": "Today" | null}."""
    spec = dashboard_spec.load_spec(store.default_root())
    return {"title": (spec.get("title") or "Today") if spec else None}


@router.get("/dashboard/state")
def get_dashboard_state():
    return {}


@router.put("/dashboard/state")
async def put_dashboard_state(request: Request):
    """Ticks on a dashboard checklist: {"ticks": {"<item id>": true | false}} marks assistant items done or reopens
    them; unknown ids are ignored."""
    raw = await _body(request)
    if raw is None:
        return JSONResponse(TOO_BIG, status_code=413)
    try:
        ticks = json.loads(raw).get("ticks")
    except (ValueError, AttributeError):
        ticks = None
    if not isinstance(ticks, dict):
        return JSONResponse({"error": "body must be {\"ticks\": {...}}"}, status_code=400)
    now, root = datetime.now().astimezone(), store.default_root()
    for item_id, ticked in list(ticks.items())[:100]:
        if ticked:
            assistant_memory.set_status(str(item_id), "done", now, "page", root)
        else:  # only undo a tick made here: an item the check closed or the user dismissed stays as it is
            assistant_memory.reopen(str(item_id), now, "page", root)
    return {"ok": True}


def job_command(job_id: str, root: Path) -> list[str]:
    """The Hermes command that runs a job now, in the profile this store belongs to:
    <home>/profiles/genui-test/plugin-data/hermes-genui/blocks → hermes -p genui-test cron run <job>; the root
    profile has no -p."""
    import shutil
    home = root.parents[2] if len(root.parents) > 2 else root
    hermes = shutil.which("hermes") or str(Path.home() / ".local" / "bin" / "hermes")
    profile = ["-p", home.name] if home.parent.name == "profiles" else []
    return [hermes, *profile, "cron", "run", job_id]


QUICK_FAIL_SECONDS = 3


def run_job(job_id: str, root: Path, done=None) -> None:
    """Start a page's refresh job. `hermes cron run` runs the whole job before it returns (minutes for a dashboard),
    so a thread waits for it and calls `done(exit code, output)` when it ends (which also reaps the process). A
    failure within the first seconds (no such job, Hermes missing) is raised instead."""
    import subprocess
    import tempfile
    import threading
    out = tempfile.TemporaryFile()
    proc = subprocess.Popen(job_command(job_id, root), stdout=out, stderr=subprocess.STDOUT,
                            stdin=subprocess.DEVNULL, start_new_session=True)

    def output() -> bytes:
        out.seek(0)
        text = out.read()
        out.close()
        return text

    try:
        code = proc.wait(timeout=QUICK_FAIL_SECONDS)
    except subprocess.TimeoutExpired:
        def wait():
            code = proc.wait()
            text = output()
            if done:
                try:
                    done(code, text)
                except Exception:  # noqa: BLE001 - a page that can't be updated keeps its 15-minute timeout
                    pass
        threading.Thread(target=wait, name=f"hermes-genui-refresh-{job_id}", daemon=True).start()
        return
    text = output()
    if code != 0:
        raise subprocess.CalledProcessError(code, proc.args, output=text)
    if done:
        done(code, text)


def _finished(slug: str, root: Path, requested_at: str, code: int, output: bytes) -> None:
    """A page's refresh job ended: say why on the page if it didn't save a newer snapshot."""
    page = pages_store.load(slug, root)
    if page and pages_refresh.finish(page, requested_at, code, output):
        pages_store.save(page, root)


@router.get("/pages")
def get_pages():
    """The designed dashboards, for the sidebar: {"pages": [{"slug", "title", "kind"}]} (Today's work sections are
    drawn on Today, not listed)."""
    found = pages_store.list_pages(store.default_root())
    return {"pages": [p for p in found if p["kind"] == "dashboard"]}


@router.get("/pages/{slug}")
def get_page(slug: str):
    """A page's latest snapshot as blocks, with its refresh status: {"title", "blocks", "live", "at", "refreshing",
    "error"}. No model."""
    page = pages_store.load(slug, store.default_root())
    if page is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    now = datetime.now().astimezone()
    return {"title": page.get("title") or slug, "blocks": pages_layout.blocks_for(page), "live": False,
            "schedule": page.get("schedule"), **pages_refresh.status(page, now)}


@router.post("/pages/{slug}/refresh")
def post_page_refresh(slug: str):
    """Start the page's refresh job unless one is running; the status after."""
    root = store.default_root()
    page = pages_store.load(slug, root)
    if page is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    def run(job_id: str) -> None:
        asked = page["refresh"]["requested_at"]
        run_job(job_id, root, done=lambda code, output: _finished(slug, root, asked, code, output))

    return pages_refresh.start(page, datetime.now().astimezone(), run, save=lambda p: pages_store.save(p, root))


@router.post("/assistant/items/{item_id}")
async def post_assistant_item(item_id: str, request: Request):
    """A button on the Today page: {"status": "done" | "dismissed" | "pending" | "suggested"} → the item; 404 unknown;
    400 bad. "suggested" is Reopen: the item is open again and the next check can't close it on the same mail."""
    raw = await _body(request)
    try:
        status = json.loads(raw or b"{}").get("status")
    except (ValueError, AttributeError):
        status = None
    if status not in BUTTON_STATUSES:
        return JSONResponse({"error": f"status must be one of {', '.join(BUTTON_STATUSES)}"}, status_code=400)
    now = datetime.now().astimezone()
    item = (assistant_memory.user_reopen(item_id, now, store.default_root()) if status == "suggested"
            else assistant_memory.set_status(item_id, status, now, "page", store.default_root()))
    if item is None:
        return JSONResponse(NOT_FOUND, status_code=404)
    return item


@router.get("/blocks/{block_id}")
async def get_block(block_id: str, version: str | None = None):
    root = store.find_root(block_id)
    board = store.load(block_id, root)
    if board is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    # A board's address answers its CURRENT version by default; ?version=N reaches back into the archive
    # and answers that version in the very same shape (blocks, words, stored) — a prior board is fetched
    # by address, never redrawn. An unusable number is a 400; a number with no archive behind it is a 404.
    served_version = store.version_of(board)
    if version is not None:
        if not version.isdigit() or int(version) < 1:
            return JSONResponse({"error": "version must be a number 1 or up"}, status_code=400)
        want = int(version)
        if want != (served_version or 1):
            archived = next((e for e in store.load_versions(block_id, root)
                             if isinstance(e, dict) and e.get("version") == want), None)
            if archived is None or not isinstance(archived.get("board"), (list, dict)):
                return JSONResponse({"error": f"no version {want} of this board"}, status_code=404)
            board = archived["board"]
            served_version = want
    answer = {"blocks": store.blocks_of(board)}
    if served_version is not None:  # living boards: which version this answer is
        answer["version"] = served_version
    if (stamp := store.updated_at_of(board)) is not None:  # and when this version was written
        answer["updated_at"] = stamp
    if (links := store.links_of(board)) is not None:  # and the boards this one connects to, each by address
        answer["links"] = links
    return answer


@router.get("/blocks/{block_id}/versions")
async def get_versions(block_id: str):
    """What history this address has: {"versions": [...]} newest first, the live one marked current.
    A board that was never updated lists [] — the truth the reader takes as "no versions to reach for"."""
    root = store.find_root(block_id)
    board = store.load(block_id, root) if root is not None else None
    if board is None:
        return JSONResponse(NOT_FOUND, status_code=404)
    rows = [{"version": store.version_of(board) or 1, "updated_at": store.updated_at_of(board),
             "saved_at": None, "current": True}]
    for entry in reversed(store.load_versions(block_id, root)):
        if isinstance(entry, dict):
            rows.append({"version": entry.get("version"), "updated_at": None,
                         "saved_at": entry.get("saved_at"), "current": False})
    return {"versions": rows[1:]} if len(rows) == 1 else {"versions": rows}


NOT_FOUND = {"error": "not found"}


@router.get("/blocks/{block_id}/state")
async def get_state(block_id: str):
    """{"state": {...}} once something is saved, {} before; 404 when no board has this id."""
    root = store.find_root(block_id)
    if root is None or store.load(block_id, root) is None:
        return JSONResponse(NOT_FOUND, status_code=404)
    state = store.load_state(block_id, root)
    return {"state": state} if state else {}


# The most a PUT body may be. The state itself is capped at store.STATE_LIMIT (20 KB); this is the request around it.
BODY_LIMIT = 32 * 1024
TOO_BIG = {"error": "state too big"}


async def _body(request: Request) -> bytes | None:
    """The request body, or None when it is (or says it is) over BODY_LIMIT. A stated Content-Length is checked
    before anything is read; without one, reading stops as soon as the limit is passed.

    Content-Length 40000 → None (nothing read);  no Content-Length, 40 KB streamed → None after 32 KB;  b'{}' → b'{}'
    """
    stated = request.headers.get("content-length")
    if stated is not None and (not stated.isdigit() or int(stated) > BODY_LIMIT):
        return None
    body = b""
    async for chunk in request.stream():
        body += chunk
        if len(body) > BODY_LIMIT:
            return None
    return body


@router.put("/blocks/{block_id}/state")
async def put_state(block_id: str, request: Request):
    """Body {"state": {...}} replaces the saved state. The id is checked before the body is read, and a body over
    32 KB is refused unread.

    {"state": {"0": [1]}} → 200;  unknown id → 404;  state over 20 KB or body over 32 KB → 413;
    {"state": [1]} or not JSON → 400
    """
    root = store.find_root(block_id)
    if root is None or store.load(block_id, root) is None:
        return JSONResponse(NOT_FOUND, status_code=404)
    raw = await _body(request)
    if raw is None:
        return JSONResponse(TOO_BIG, status_code=413)
    try:
        body = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        body = None
    state = body.get("state") if isinstance(body, dict) else None
    if not isinstance(state, dict):
        return JSONResponse({"error": "body must be {\"state\": {...}}"}, status_code=400)
    try:
        store.save_state(block_id, state, root)
    except store.NoSuchBlock:
        return JSONResponse(NOT_FOUND, status_code=404)
    except store.StateTooBig:
        return JSONResponse(TOO_BIG, status_code=413)
    return {"ok": True}
