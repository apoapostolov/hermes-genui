import importlib
import json

from conftest import ROOT, load_plugin_package

load_plugin_package()
describe = importlib.import_module("hermes_genui.core.catalog_text").describe

CATALOG = json.loads((ROOT / "core" / "catalog.json").read_text(encoding="utf-8"))


def test_describe_names_every_type():
    text = describe()
    for entry in CATALOG["blocks"]:
        assert entry["kind"] in text


def test_atoms_take_one_line_each():
    lines = describe().splitlines()
    for entry in CATALOG["blocks"]:
        if entry.get("group") != "atom":
            continue
        mine = [line for line in lines if line.startswith(f"- {entry['kind']}: ")]
        assert len(mine) == 1, entry["kind"]
        example = json.dumps(entry["example"], ensure_ascii=False, separators=(",", ":"))
        assert mine[0].endswith(example)
        assert "Use for:" not in mine[0]


def test_form_guidance_says_ask_first_with_one_prefilled_form():
    form = next(entry for entry in CATALOG["blocks"] if entry["kind"] == "form")
    guidance = form["use_when"]
    for words in ("two or more key choices are unknown", "ONE form", "best guess", "answer message", "yes/no"):
        assert words in guidance, words
    for extra in ("group", "note", "ends", "placeholder", "multiline"):
        assert extra in form["fields"], extra


def test_chart_and_number_guidance():
    by_kind = {entry["kind"]: entry for entry in CATALOG["blocks"]}
    chart = by_kind["chart"]["use_when"] + by_kind["chart"]["fields"]
    for words in ("parts of a whole, 3-7 parts", "2-5 named items", "time stays upright", "a table, not a chart each",
                  'tone: "change"'):
        assert words in chart, words
    assert "trend: 2-60 numbers" in by_kind["kpis"]["fields"]


def test_flow_says_it_is_a_chain_and_where_branching_graphs_go():
    by_kind = {entry["kind"]: entry for entry in CATALOG["blocks"]}
    flow, steps = by_kind["flow"], by_kind["steps"]
    assert "mermaid code block in the reply" in flow["use_when"]
    for words in ("nodes 2-10", "groups ≤3", "right | down", "note ≤280"):
        assert words in flow["fields"], words
    for words in ("for: a flow id", "items 2-12", "text ≤600", "node", "image"):
        assert words in steps["fields"], words
