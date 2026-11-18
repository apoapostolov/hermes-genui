"""Runs the prompt set against a model and scores what it draws, without Hermes.

The model gets what Hermes gives it in the Desktop app: the plugin's system-prompt section, the reminder its
pre_llm_call hook adds to a visual request, and the real show_blocks tool with today's guide. When the model calls
show_blocks, the plugin's own handler answers (a tag, or "Not drawn. Fix these..."), so the model can correct itself
the way it would in a chat. Boards are written to a temporary folder, never a Hermes profile.

Any OpenAI-compatible endpoint works (LM Studio, Ollama, OpenRouter, a cloud API). Standard library only:

    python3 evals/run.py --base-url http://localhost:1234/v1 --model gemma-4-12b
    python3 evals/run.py --model gemma-4-12b --only chart-line,none-capital
    python3 evals/run.py --model gemma-4-12b --block chart --markdown
    OPENAI_API_KEY=... python3 evals/run.py --base-url https://api.example.com/v1 --model some-model

Every prompt is written to evals/results/<model>-<time>.jsonl as it finishes; a summary is printed at the end.
"""

import argparse
import importlib.util
import json
import os
import sys
import tempfile
import time
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROMPTS = ROOT / "evals" / "prompts" / "blocks.toml"
RESULTS = ROOT / "evals" / "results"

# Stands in for Hermes's own system prompt, which is much longer. --system-file replaces it with a real one.
BASE_SYSTEM = "You are Hermes, a helpful assistant. Answer the user's request."
SESSION = "eval-session"


def load_plugin():
    """Import the plugin folder as the package `hermes_genui`, the way Hermes (and tests/conftest.py) load it."""
    if "hermes_genui" in sys.modules:
        return sys.modules["hermes_genui"]
    spec = importlib.util.spec_from_file_location(
        "hermes_genui", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)]
    )
    package = importlib.util.module_from_spec(spec)
    sys.modules["hermes_genui"] = package
    spec.loader.exec_module(package)
    return package


def load_prompts(path: Path = PROMPTS) -> list[dict]:
    return tomllib.loads(path.read_text(encoding="utf-8"))["prompt"]


def block_types(blocks: list) -> list[str]:
    """Every block's type, containers and what they hold included, in order.

    [{"type": "section", "children": [{"type": "chart"}]}, {"type": "source"}] → ["section", "chart", "source"]
    {"type": "tabs", "tabs": [{"children": [{"type": "table"}]}]} inside a list → ["tabs", "table"]
    """
    out: list[str] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        out.append(str(block.get("type")))
        if isinstance(block.get("children"), list):
            out += block_types(block["children"])
        for tab in block.get("tabs") or []:
            if isinstance(tab, dict) and isinstance(tab.get("children"), list):
                out += block_types(tab["children"])
    return out


def chart_kinds(blocks: list) -> list[str]:
    """The kind of every chart on a board, nested ones included. A chart without a kind is a line."""
    found: list[str] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "chart":
            found.append(str(block.get("kind") or "line").lower())
        found += chart_kinds(block.get("children") or [])
        for tab in block.get("tabs") or []:
            if isinstance(tab, dict):
                found += chart_kinds(tab.get("children") or [])
    return found


def score(case: dict, boards: list[list]) -> tuple[bool, str]:
    """Whether the boards drawn for a prompt are what it expects, and why not.

    expect "none": nothing drawn.  Otherwise a board holds `expect` (or one of `alternatives`), every type in `also`,
    and, for a chart with `kind`, a chart of that kind.
    ({"expect": "none"}, []) → (True, "")
    ({"expect": "table"}, [[{"type": "chart"}]]) → (False, "drew chart, expected table")
    """
    drawn = [t for board in boards for t in block_types(board)]
    if case["expect"] == "none":
        return (not boards, "" if not boards else f"drew {', '.join(drawn)}, expected nothing")
    if not boards:
        return False, "nothing drawn"
    wanted = [case["expect"], *case.get("alternatives", [])]
    if not any(t in drawn for t in wanted):
        return False, f"drew {', '.join(drawn)}, expected {' or '.join(wanted)}"
    missing = [t for t in case.get("also", []) if t not in drawn]
    if missing:
        return False, f"missing {', '.join(missing)}"
    kind = case.get("kind")
    if kind and case["expect"] == "chart" and "chart" in drawn:
        kinds = [k for board in boards for k in chart_kinds(board)]
        if kind not in kinds:
            return False, f"chart kind {', '.join(kinds)}, expected {kind}"
    return True, ""


def post(base_url: str, api_key: str, body: dict, timeout: float) -> dict:
    request = urllib.request.Request(
        base_url.rstrip("/") + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key or 'none'}"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


class Plugin:
    """The plugin pieces the runner needs, with boards stored in a temporary folder."""

    def __init__(self) -> None:
        load_plugin()
        from hermes_genui.core import store
        from hermes_genui.hooks import prompt_section, visual_nudge
        from hermes_genui.tools import show_blocks

        self._tmp = tempfile.TemporaryDirectory(prefix="genui-eval-")
        store.default_root = lambda: Path(self._tmp.name)
        self.section = prompt_section.drawing_rule({"platform": "local"})
        self.nudge = visual_nudge.visual_nudge
        self.handler = show_blocks.show_blocks
        schema = show_blocks.SHOW_BLOCKS_SCHEMA
        self.tool = {"type": "function", "function": {
            "name": schema["name"], "description": schema["description"], "parameters": schema["parameters"]}}

    def user_message(self, text: str) -> str:
        """The user's words, with the reminder Hermes adds beside a visual request in the Desktop app."""
        reminder = self.nudge(user_message=text, platform="local", session_id=SESSION)
        return f"{text}\n\n{reminder}" if reminder else text


def run_case(case: dict, plugin: Plugin, args: argparse.Namespace, system: str) -> dict:
    """One prompt, start to finish: model turns until it answers in text or runs out of turns."""
    messages = [
        {"role": "system", "content": f"{system}\n\n## Plugin Context: hermes-genui\n{plugin.section}"},
        {"role": "user", "content": plugin.user_message(case["text"])},
    ]
    calls: list[dict] = []
    boards: list[list] = []
    usage = {"prompt_tokens": 0, "completion_tokens": 0}
    reply, error = "", ""
    started = time.monotonic()
    for _ in range(args.max_turns):
        body = {"model": args.model, "messages": messages, "tools": [plugin.tool], "max_tokens": args.max_tokens}
        if args.temperature is not None:
            body["temperature"] = args.temperature
        try:
            response = post(args.base_url, args.api_key, body, args.timeout)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            error = f"request failed: {exc}"
            break
        for key in usage:
            usage[key] += int((response.get("usage") or {}).get(key) or 0)
        message = response["choices"][0]["message"]
        tool_calls = message.get("tool_calls") or []
        messages.append({k: v for k, v in message.items() if k in ("role", "content", "tool_calls")})
        if not tool_calls:
            reply = message.get("content") or ""
            break
        for call in tool_calls:
            name = call["function"]["name"]
            if name != "show_blocks":
                result = f"Unknown tool {name}. The only tool here is show_blocks."
                calls.append({"tool": name, "drawn": False, "result": result})
            else:
                try:
                    params = json.loads(call["function"].get("arguments") or "{}")
                except json.JSONDecodeError:
                    params = None
                result = (plugin.handler(params, session_id=SESSION) if isinstance(params, dict)
                          else "Not drawn. Fix these and call show_blocks again:\n- arguments: not valid JSON")
                drawn = "::blocks{" in result
                if drawn:
                    boards.append(params["blocks"] if isinstance(params["blocks"], list) else [params["blocks"]])
                calls.append({"tool": name, "drawn": drawn, "result": result[:600],
                              "types": block_types(params.get("blocks") or []) if isinstance(params, dict) else []})
            messages.append({"role": "tool", "tool_call_id": call.get("id", ""), "content": result})
    passed, why = score(case, boards) if not error else (False, error)
    if not boards and "::blocks{" in reply:
        why = (why + "; " if why else "") + "made up a tag without calling show_blocks"
    tries = [c for c in calls if c["tool"] == "show_blocks"]
    return {
        "id": case["id"], "expect": case["expect"], "passed": passed, "why": why,
        "drawn_types": [t for board in boards for t in block_types(board)],
        "show_blocks_calls": len(tries),
        "first_try_valid": bool(tries) and tries[0]["drawn"],
        "tag_in_reply": ("::blocks{" in reply) if boards else None,
        "made_up_tag": "::blocks{" in reply and not boards,
        "prompt_tokens": usage["prompt_tokens"], "completion_tokens": usage["completion_tokens"],
        "seconds": round(time.monotonic() - started, 1),
        "calls": calls, "reply": reply[:1500], "error": error,
    }


def involves(case: dict, blocks: set[str]) -> bool:
    """Whether a prompt is about one of these blocks: as its expect, an alternative or an also.

    ({"expect": "list", "alternatives": ["chart"]}, {"chart"}) → True;  ({"expect": "none"}, {"chart"}) → False
    """
    return bool(blocks & {case["expect"], *case.get("alternatives", []), *case.get("also", [])})


def markdown(rows: list[dict], model: str, blocks: str = "") -> str:
    """The summary as a Markdown table, to paste into a pull request.

    → "**gemma-4-12b**: 9/10 passed, first call valid 7/9 ..." then a row per prompt
    """
    tried = [r for r in rows if r["show_blocks_calls"]]
    head = (f"**{model}**{f' (blocks: {blocks})' if blocks else ''}: {sum(r['passed'] for r in rows)}/{len(rows)} "
            f"passed, first call valid {sum(r['first_try_valid'] for r in tried)}/{len(tried)}, "
            f"made-up tags {sum(r['made_up_tag'] for r in rows)}, {time.strftime('%Y-%m-%d')}")
    lines = [head, "", "| prompt | expect | drew | pass | calls | why |", "|---|---|---|---|---|---|"]
    for r in rows:
        drew = ", ".join(dict.fromkeys(r["drawn_types"])) or "–"
        lines.append(f"| {r['id']} | {r['expect']} | {drew} | {'✅' if r['passed'] else '❌'} | "
                     f"{r['show_blocks_calls']} | {r['why'] or ''} |")
    return "\n".join(lines)


def summary(rows: list[dict]) -> str:
    """The table printed at the end: one line per prompt, then the totals."""
    lines = [f"{'id':<26} {'pass':<5} {'calls':>5} {'1st ok':>6} {'tokens':>7} {'secs':>6}  why"]
    for r in rows:
        first = "-" if not r["show_blocks_calls"] else ("yes" if r["first_try_valid"] else "no")
        lines.append(f"{r['id']:<26} {'yes' if r['passed'] else 'NO':<5} {r['show_blocks_calls']:>5} {first:>6} "
                     f"{r['prompt_tokens']:>7} {r['seconds']:>6}  {r['why']}")
    n = len(rows)
    drawing = [r for r in rows if r["expect"] != "none"]
    quiet = [r for r in rows if r["expect"] == "none"]
    tried = [r for r in rows if r["show_blocks_calls"]]
    drew = [r for r in rows if r["drawn_types"]]

    def pct(part: int, whole: int) -> str:
        return f"{part}/{whole} ({100 * part // whole}%)" if whole else "-"

    lines += [
        "",
        f"passed:                 {pct(sum(r['passed'] for r in rows), n)}",
        f"  should draw, did right: {pct(sum(r['passed'] for r in drawing), len(drawing))}",
        f"  should not draw, didn't: {pct(sum(r['passed'] for r in quiet), len(quiet))}",
        f"first show_blocks call valid: {pct(sum(r['first_try_valid'] for r in tried), len(tried))}",
        f"tried but never drew:   {pct(sum(1 for r in tried if not r['drawn_types']), len(tried))}",
        f"tag pasted in reply:    {pct(sum(bool(r['tag_in_reply']) for r in drew), len(drew))}",
        f"made-up tag, no board:  {pct(sum(r['made_up_tag'] for r in rows), n)}",
        f"mean prompt tokens:     {sum(r['prompt_tokens'] for r in rows) // max(n, 1)}",
        f"mean seconds:           {sum(r['seconds'] for r in rows) / max(n, 1):.1f}",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base-url", default=os.environ.get("EVAL_BASE_URL", "http://localhost:1234/v1"))
    parser.add_argument("--model", required=True)
    parser.add_argument("--api-key", default=os.environ.get("EVAL_API_KEY") or os.environ.get("OPENAI_API_KEY", ""))
    parser.add_argument("--prompts", type=Path, default=PROMPTS)
    parser.add_argument("--only", default="", help="comma-separated prompt ids")
    parser.add_argument("--block", default="", help="comma-separated block types: only the prompts about them")
    parser.add_argument("--markdown", action="store_true", help="also print the summary as a Markdown table")
    parser.add_argument("--system-file", type=Path, help="a real Hermes system prompt to use instead of the stand-in")
    parser.add_argument("--max-turns", type=int, default=4, help="model calls per prompt (retries included)")
    parser.add_argument("--temperature", type=float, help="default: the server's setting for the model")
    parser.add_argument("--max-tokens", type=int, default=6000, help="per model call, thinking included")
    parser.add_argument("--timeout", type=float, default=600)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    cases = load_prompts(args.prompts)
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        cases = [c for c in cases if c["id"] in wanted]
    if args.block:
        chosen = {s.strip() for s in args.block.split(",") if s.strip()}
        cases = [c for c in cases if involves(c, chosen)]
    if not cases:
        sys.exit("no prompts match --only / --block")
    system = args.system_file.read_text(encoding="utf-8") if args.system_file else BASE_SYSTEM
    plugin = Plugin()
    out = args.out or RESULTS / f"{args.model.replace('/', '_')}-{time.strftime('%Y%m%d-%H%M%S')}.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    with out.open("w", encoding="utf-8") as sink:
        for i, case in enumerate(cases, 1):
            row = run_case(case, plugin, args, system)
            rows.append(row)
            sink.write(json.dumps(row, ensure_ascii=False) + "\n")
            sink.flush()
            print(f"[{i}/{len(cases)}] {row['id']}: {'pass' if row['passed'] else 'FAIL ' + row['why']}", flush=True)
    print()
    print(summary(rows))
    if args.markdown:
        print("\n" + markdown(rows, args.model, args.block))
    print(f"\ndetails: {out}")


if __name__ == "__main__":
    main()
