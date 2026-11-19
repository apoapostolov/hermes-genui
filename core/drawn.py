"""The boards show_blocks drew in each session since the user's last message, so a reply that lost its tag can get it
back (hooks/text_fallback.py). Kept in memory only: a restart forgets them, which costs nothing but that safety net.

note("s1", "7f3a09bc"); note("s1", "0badc0de"); take("s1") → ["7f3a09bc", "0badc0de"]; take("s1") → []
"""

import threading

MAX_SESSIONS = 200  # a long-running Hermes with many chats keeps only the most recent ones

_lock = threading.Lock()
_drawn: dict[str, list[str]] = {}


def note(session_id: str, block_id: str) -> None:
    """Remember a board drawn in this session."""
    if not session_id:
        return
    with _lock:
        _drawn.setdefault(session_id, []).append(block_id)
        while len(_drawn) > MAX_SESSIONS:
            _drawn.pop(next(iter(_drawn)))


def take(session_id: str) -> list[str]:
    """The boards drawn in this session since the last take or forget, oldest first; forgets them."""
    with _lock:
        return _drawn.pop(session_id, [])


def forget(session_id: str) -> None:
    """A new user message: what was drawn for the last one no longer matters."""
    with _lock:
        _drawn.pop(session_id, None)
