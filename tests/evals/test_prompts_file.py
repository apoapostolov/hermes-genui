"""The prompt set's format (evals/prompts/blocks.toml) and the runner's scoring, checked without calling any model."""

import importlib.util
import json
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROMPTS = ROOT / "evals" / "prompts" / "blocks.toml"
KEYS = {"id", "text", "expect", "alternatives", "also", "kind", "from"}


def _runner():
    spec = importlib.util.spec_from_file_location("genui_eval_run", ROOT / "evals" / "run.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _block_kinds() -> set[str]:
    return {entry["kind"] for entry in json.loads((ROOT / "core" / "catalog.json").read_text())["blocks"]}


def _chart_kinds() -> tuple[str, ...]:
    text = (ROOT / "blocks" / "chart.py").read_text()
    return tuple(re.findall(r'"(\w+)"', re.search(r"CHART_KINDS = \(([^)]*)\)", text).group(1)))


def test_every_prompt_is_well_formed():
    prompts = tomllib.loads(PROMPTS.read_text(encoding="utf-8"))["prompt"]
    kinds = _block_kinds()
    ids = [p.get("id") for p in prompts]
    assert len(ids) == len(set(ids)), "ids must be unique"
    for p in prompts:
        where = p.get("id", p)
        assert not set(p) - KEYS, f"{where}: unknown keys {sorted(set(p) - KEYS)}"
        assert isinstance(p.get("id"), str) and re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", p["id"]), where
        assert isinstance(p.get("text"), str) and p["text"].strip(), f"{where}: text is required"
        assert p.get("expect") == "none" or p.get("expect") in kinds, f"{where}: expect {p.get('expect')!r}"
        for key in ("alternatives", "also"):
            assert all(t in kinds for t in p.get(key, [])), f"{where}: {key} names an unknown block"
        if "kind" in p:
            assert p["expect"] == "chart" and p["kind"] in _chart_kinds(), f"{where}: kind {p['kind']!r}"
        if p["expect"] == "none":
            assert not ({"alternatives", "also", "kind"} & set(p)), f"{where}: nothing else goes with none"


def test_the_set_covers_drawing_and_not_drawing():
    prompts = tomllib.loads(PROMPTS.read_text(encoding="utf-8"))["prompt"]
    assert sum(p["expect"] == "none" for p in prompts) >= 3
    assert sum(p["expect"] != "none" for p in prompts) >= 10


def test_block_types_walk_containers_and_tabs():
    run = _runner()
    board = [
        {"type": "section", "children": [{"type": "chart", "kind": "bar"}]},
        {"type": "tabs", "tabs": [{"label": "A", "children": [{"type": "table"}]}]},
        {"type": "source"},
    ]
    assert run.block_types(board) == ["section", "chart", "tabs", "table", "source"]
    assert run.chart_kinds(board) == ["bar"]
    assert run.chart_kinds([{"type": "chart"}]) == ["line"]


def test_score():
    run = _runner()
    assert run.score({"expect": "none"}, []) == (True, "")
    assert run.score({"expect": "none"}, [[{"type": "table"}]]) == (False, "drew table, expected nothing")
    assert run.score({"expect": "table"}, []) == (False, "nothing drawn")
    assert run.score({"expect": "table"}, [[{"type": "chart"}]]) == (False, "drew chart, expected table")
    assert run.score({"expect": "list", "alternatives": ["chart"]}, [[{"type": "chart"}]]) == (True, "")
    assert run.score({"expect": "chart", "also": ["kpis"]}, [[{"type": "chart"}]]) == (False, "missing kpis")
    combo = {"expect": "chart", "kind": "combo"}
    assert run.score(combo, [[{"type": "chart", "kind": "bar"}]]) == (False, "chart kind bar, expected combo")
    assert run.score(combo, [[{"type": "row"}], [{"type": "chart", "kind": "combo"}]]) == (True, "")


def test_involves_and_markdown():
    run = _runner()
    assert run.involves({"expect": "list", "alternatives": ["chart"]}, {"chart"})
    assert run.involves({"expect": "chart", "also": ["kpis"]}, {"kpis"})
    assert not run.involves({"expect": "none"}, {"chart"})
    row = {"id": "table-phones", "expect": "table", "drawn_types": ["table"], "passed": True, "why": "",
           "show_blocks_calls": 1, "first_try_valid": True, "made_up_tag": False}
    text = run.markdown([row], "gemma-4-12b", "table")
    assert text.startswith("**gemma-4-12b** (blocks: table): 1/1 passed, first call valid 1/1, made-up tags 0")
    assert "| table-phones | table | table | ✅ | 1 |  |" in text
