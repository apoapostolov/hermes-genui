"""Recorded calls: the tool calls that produced a kept page, replayed on every refresh so the same numbers come from
the same place. Only read calls on the page's own MCP servers; dates are placeholders filled at each refresh."""

import re
from datetime import datetime, timedelta

MAX_CALLS = 20
FEEDS_MAX = 200
# A tool whose name has one of these words changes something; a page only reads.
WRITE_WORDS = ("send", "delete", "trash", "create", "update", "label", "cancel", "respond", "draft", "post", "write",
               "remove", "patch", "put", "insert", "move", "archive", "reply", "close", "isolate", "add", "acknowledge",
               "ack", "approve", "assign", "set", "enable", "disable", "block", "unblock", "quarantine", "kill",
               "restart", "stop", "start", "submit", "upload", "edit", "modify", "mark", "resolve", "merge",
               "transfer", "pay", "book", "invite", "share", "forward", "schedule", "execute", "exec", "drop")
READ_VERBS = ("get", "list", "search", "read", "find", "fetch", "count", "query", "describe", "show", "lookup",
              "view", "whoami")
SQL_KEYS = ("sql", "statement")
SQL_TOOL_WORDS = ("sql", "query")
SQL_WRITE = re.compile(r"\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|grant|"
                       r"truncate|merge|call|exec|execute)\b", re.I)
CALL_ID = re.compile(r"^[A-Za-z0-9_-]{1,30}$")
DATE = re.compile(r"\{today(?:-(\d{1,3}))?\}")


def tool_server(tool: str) -> str | None:
    """The MCP server a registered tool name belongs to: "mcp__mocksecops__cindral_list_findings" → "mocksecops"."""
    match = re.fullmatch(r"mcp__([^_](?:[^_]|_(?!_))*)__(.+)", str(tool))
    return match.group(1) if match else None


def _words(tool: str) -> list[str]:
    """The words of a tool's own name (everything after mcp__<server>__), camelCase split: "sendEmail" → send, email."""
    name = str(tool).split("__", 2)[-1]
    name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    return [w for w in re.split(r"[^a-z0-9]+", name.lower()) if w]


def _changes_things(tool: str) -> bool:
    """A write word anywhere in the name, unless the name opens with a read verb (after one vendor word): get_draft
    reads; gmail_create_label and close_incident write."""
    words = _words(tool)
    if any(w in READ_VERBS for w in words[:2]):
        return False
    return any(w in WRITE_WORDS for w in words)


def _bad_sql(text: str) -> bool:
    """Not one read-only statement: SELECT or WITH, nothing after a ;, no write keyword anywhere."""
    body = re.sub(r"--[^\n]*|/\*.*?\*/", " ", text, flags=re.S).strip().rstrip(";").strip()
    return (";" in body or not re.match(r"(select|with)\b", body, re.I) or bool(SQL_WRITE.search(body)))


def _sql_args(tool: str, args: dict) -> list[str]:
    sqlish = any(w in SQL_TOOL_WORDS for w in _words(tool))
    keys = SQL_KEYS + (("query",) if sqlish else ())
    return [k for k in keys if isinstance(args.get(k), str) and _bad_sql(args[k])]


def check_calls(calls: object, servers: list[str], read_only=None) -> list[str]:
    """What's wrong with a page's recorded calls, or []. `read_only(tool)` says when Hermes knows a tool only reads
    (its readOnlyHint); otherwise the name decides."""
    if not isinstance(calls, list):
        return ["calls: a list of {id, tool, args, feeds}"]
    if len(calls) > MAX_CALLS:
        return [f"calls: at most {MAX_CALLS}"]
    problems, seen = [], set()
    for i, call in enumerate(calls):
        at = f"calls.{i}"
        if not isinstance(call, dict):
            problems.append(f"{at}: must be an object")
            continue
        if not (isinstance(call.get("id"), str) and CALL_ID.match(call["id"])):
            problems.append(f"{at}: id is a short name (letters, digits, - or _)")
        elif call["id"] in seen:
            problems.append(f"{at}: ids must be unique")
        seen.add(call.get("id"))
        tool = call.get("tool")
        server = tool_server(tool) if isinstance(tool, str) else None
        if server is None:
            problems.append(f"{at}: tool must be an MCP tool, mcp__<server>__<tool>")
        elif server not in servers:
            problems.append(f"{at}: {server} isn't one of this page's servers ({', '.join(servers)})")
        elif not (read_only and read_only(tool)) and _changes_things(tool):
            problems.append(f"{at}: {tool} changes things; a page only reads")
        args = call.get("args", {})
        if not isinstance(args, dict):
            problems.append(f"{at}: args must be an object")
        else:
            problems += [f"{at}: {k} must be one SELECT (or WITH) statement" for k in _sql_args(str(tool), args)]
        feeds = call.get("feeds", "")
        if not (isinstance(feeds, str) and len(feeds) <= FEEDS_MAX):
            problems.append(f"{at}: feeds is up to {FEEDS_MAX} characters")
    return problems


def fill_dates(value, now: datetime):
    """Placeholders filled for this refresh: {today} and {today-N} as ISO dates, {now} as an ISO time; anywhere in
    strings, lists and objects."""
    if isinstance(value, dict):
        return {k: fill_dates(v, now) for k, v in value.items()}
    if isinstance(value, list):
        return [fill_dates(v, now) for v in value]
    if isinstance(value, str):
        text = DATE.sub(lambda m: (now.date() - timedelta(days=int(m.group(1) or 0))).isoformat(), value)
        return text.replace("{now}", now.isoformat())
    return value
