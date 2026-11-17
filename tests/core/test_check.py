import importlib
import json
import re

import pytest

from conftest import ROOT, load_plugin_package

load_plugin_package()
check = importlib.import_module("hermes_genui.core.check")
FORMULA_HELPERS, check_blocks = check.FORMULA_HELPERS, check.check_blocks

CATALOG = json.loads((ROOT / "core" / "catalog.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("entry", CATALOG["blocks"], ids=lambda e: e["kind"])
def test_every_catalog_example_is_valid(entry):
    assert check_blocks([entry["example"]]) == []


def test_unknown_type():
    assert check_blocks([{"type": "sundial"}]) == ['0: unknown type "sundial"']


def test_not_an_object():
    assert check_blocks(["hello"]) == ["0: not a block object"]


def test_chart_series_length_must_match_x():
    chart = {"type": "chart", "kind": "line", "x": ["a", "b", "c"], "series": [{"name": "s", "data": [1, 2]}]}
    problems = check_blocks([chart])
    assert len(problems) == 1
    assert problems[0].startswith("0.series.0:")


def test_timeline_needs_a_titled_item():
    timeline = {"type": "timeline", "groups": [{"label": "Day 1", "items": [{"time": "09:00"}]}]}
    problems = check_blocks([timeline])
    assert len(problems) == 1
    assert problems[0].startswith("0:")


def test_images_need_an_https_url():
    images = {"type": "images", "images": [{"url": "http://example.com/a.jpg"}]}
    problems = check_blocks([images])
    assert len(problems) == 1
    assert problems[0].startswith("0:")


def test_section_inside_section():
    inner = {"type": "section", "title": "b", "children": [{"type": "text", "text": "x"}]}
    outer = {"type": "section", "title": "a", "children": [inner]}
    problems = check_blocks([outer])
    assert len(problems) == 1
    assert problems[0].startswith("0.children.0:")


def test_problems_inside_containers_carry_their_path():
    row = {"type": "row", "children": [{"type": "stat", "label": "x", "value": 1}, {"type": "text"}]}
    assert check_blocks([row]) == ["0.children.1: text needs text"]


def chart_with(series: list[dict], kind: str = "line", x: list | None = None) -> dict:
    return {"type": "chart", "kind": kind, "x": x or ["Q1", "Q2"], "series": series}


def test_chart_values_must_be_numbers():
    problems = check_blocks([chart_with([{"name": "Rev", "data": ["1,200", "1,350"]}])])
    assert problems == ["0.series.0: data must be numbers (null for a gap)"]


def test_chart_needs_at_least_one_number():
    assert check_blocks([chart_with([{"data": [None, None]}])]) == ["0: chart needs at least one number"]


def test_chart_series_limit_depends_on_kind():
    four = [{"name": f"s{i}", "data": [1, 2]} for i in range(4)]
    assert check_blocks([chart_with(four)]) == ["0: a line chart takes 1-3 series"]
    assert check_blocks([chart_with(four, kind="stacked")]) == []


def test_pie_needs_a_positive_value():
    assert check_blocks([chart_with([{"data": [0, -3]}], kind="pie")]) == ["0: a pie needs at least one positive value"]


def test_chart_tone_is_change_on_a_line_chart_only():
    rising = [{"name": "Close", "data": [1, 2]}]
    assert check_blocks([{**chart_with(rising), "tone": "change"}]) == []
    assert check_blocks([{**chart_with(rising), "tone": "green"}]) == ['0: tone can only be "change"']
    assert check_blocks([{**chart_with(rising), "tone": ["change"]}]) == ['0: tone can only be "change"']
    assert check_blocks([{**chart_with(rising, kind="bar"), "tone": "change"}]) == [
        '0: tone "change" is for a one-series line chart']
    two = [{"name": "A", "data": [1, 2]}, {"name": "B", "data": [2, 1]}]
    assert check_blocks([{**chart_with(two), "tone": "change"}]) == ['0: tone "change" is for a one-series line chart']


def scatter(*series: dict) -> dict:
    return {"type": "chart", "kind": "scatter", "series": list(series)}


def test_scatter_points_need_a_number_on_both_scales():
    ok = scatter({"name": "Cars", "points": [{"x": 9, "y": 24.6}, {"x": 62, "y": None}]})
    assert check_blocks([ok]) == []
    assert check_blocks([{**ok, "tone": "change"}]) == ['0: tone "change" is for a one-series line chart']


def test_scatter_reports_the_point_that_cannot_be_placed():
    assert check_blocks([scatter({"points": [{"x": "9", "y": 1}]})]) == [
        "0.series.0.points.0: point needs a numeric x"]
    assert check_blocks([scatter({"points": [{"x": 9, "y": "1.2"}]})]) == [
        "0.series.0.points.0: point's y is a number, or null for unknown"]
    assert check_blocks([scatter({"points": [{"x": 9, "y": None}]})]) == [
        "0: scatter needs at least one point with a y"]
    assert check_blocks([scatter({"points": [{"x": 9}, "nope"]})]) == ["0.series.0.points.1: point is not an object"]


def test_scatter_takes_two_series_of_at_most_200_points():
    one = {"points": [{"x": 9, "y": 1}]}
    assert check_blocks([scatter(one, {"points": [{"x": 2, "y": 2}]})]) == []
    assert check_blocks([scatter(one, one, one)]) == ["0: a scatter chart takes 1-2 series"]
    assert check_blocks([scatter({"points": [{"x": i, "y": 1} for i in range(201)]})]) == [
        "0.series.0: a scatter series takes at most 200 points"]
    assert check_blocks([scatter({"points": "nope"})]) == ["0.series.0: series needs a points list"]
    assert check_blocks([{"type": "chart", "kind": "scatter"}]) == ["0: scatter needs 1-2 series with points"]


def waterfall(*series: dict) -> dict:
    return {"type": "chart", "kind": "waterfall", "series": list(series)}


def test_waterfall_points_are_steps_or_totals():
    bridge = waterfall({"points": [
        {"label": "Gross revenue", "value": 120, "total": True}, {"label": "Returns", "value": -8},
        {"label": "Card", "value": None}, {"label": "Net profit", "total": True}]})
    assert check_blocks([bridge]) == []
    assert check_blocks([{**bridge, "tone": "change"}]) == ['0: tone "change" is for a one-series line chart']


def test_waterfall_reports_a_point_it_cannot_read():
    assert check_blocks([waterfall({"points": [{"label": "Returns", "value": "8"}]})]) == [
        "0.series.0.points.0: point's value is a number, or null for unknown"]
    assert check_blocks([waterfall({"points": [{"label": "Card"}]})]) == [
        "0: waterfall needs at least one point with a value or a total"]
    assert check_blocks([waterfall({"points": [{"label": "x" * 41, "value": 1}]})]) == [
        "0.series.0.points.0: label is text of at most 40 characters"]
    assert check_blocks([waterfall({"points": ["nope"]})]) == [
        "0.series.0.points.0: point is not an object"]


def test_waterfall_is_one_series_of_points():
    one = {"points": [{"value": 1}]}
    assert check_blocks([waterfall(one)]) == []
    assert check_blocks([waterfall(one, one)]) == ["0: a waterfall chart takes 1 series"]
    assert check_blocks([waterfall({"points": 5})]) == ["0: series needs a points list"]
    assert check_blocks([{"type": "chart", "kind": "waterfall"}]) == ["0: waterfall needs 1 series with points"]


def test_kpi_trend_is_2_to_60_numbers():
    def kpis(trend: object) -> dict:
        return {"type": "kpis", "items": [{"label": "Close", "value": 3100},
                                          {"label": "NIFTY", "value": 1, "trend": trend}]}
    assert check_blocks([kpis([1, 2.5, 3])]) == []
    assert check_blocks([kpis(list(range(60)))]) == []
    bad = "0.items.1: trend must be a list of 2-60 numbers"
    for trend in ([1], list(range(61)), [1, "2"], [1, True], [1, None], [1, float("nan")], [1, float("inf")],
                  [1, 10**400], "1,2,3", {"a": 1}):
        assert check_blocks([kpis(trend)]) == [bad], trend


def test_stat_trend_is_checked_too():
    assert check_blocks([{"type": "stat", "label": "Saved", "value": 1, "trend": [1, 2]}]) == []
    assert check_blocks([{"type": "stat", "label": "Saved", "value": 1, "trend": [1]}]) == [
        "0: trend must be a list of 2-60 numbers"]


def test_row_and_grid_child_limits():
    stats = [{"type": "stat", "label": f"s{i}", "value": i} for i in range(7)]
    assert check_blocks([{"type": "row", "children": stats[:4]}]) == ["0: a row holds at most 3 children"]
    assert check_blocks([{"type": "grid", "children": stats}]) == ["0: a grid holds at most 6 children"]
    assert check_blocks([{"type": "row", "children": stats[:3]}, {"type": "grid", "children": stats[:6]}]) == []


def test_table_needs_columns_and_rows():
    assert check_blocks([{"type": "table", "rows": [["a"]]}]) == ["0: table needs columns"]
    assert check_blocks([{"type": "table", "columns": ["A"], "rows": []}]) == ["0: table needs rows"]


def test_table_row_wider_than_columns():
    table = {"type": "table", "columns": ["A", "B"], "rows": [["1", "2"], ["1", "2", "3"]]}
    assert check_blocks([table]) == ["0.rows.1: row has 3 cells, table has 2 columns"]


def test_table_limits():
    wide = {"type": "table", "columns": [f"c{i}" for i in range(9)], "rows": [["x"]]}
    assert check_blocks([wide]) == ["0: a table holds at most 8 columns"]


def test_columns_hold_two_or_three_wide_blocks():
    chart = {"type": "chart", "kind": "line", "x": ["a", "b"], "series": [{"data": [1, 2]}]}
    table = {"type": "table", "columns": ["A"], "rows": [["x"]]}
    assert check_blocks([{"type": "columns", "children": [chart, table]}]) == []
    assert check_blocks([{"type": "columns", "children": [chart, table, chart, table]}]) == [
        "0: columns hold at most 3 children"]


def test_columns_cannot_hold_sections_or_columns():
    inner = {"type": "columns", "children": [{"type": "text", "text": "a"}]}
    section = {"type": "section", "title": "s", "children": [{"type": "text", "text": "b"}]}
    assert check_blocks([{"type": "columns", "children": [inner, section]}]) == [
        "0.children.0: columns can't hold columns or a section",
        "0.children.1: columns can't hold columns or a section",
    ]


def test_include_needs_an_id():
    assert check_blocks([{"type": "include", "id": "7f3a09bc"}]) == []
    problem = '0: include needs the id of a stored board, like "7f3a09bc"'
    assert check_blocks([{"type": "include", "id": "nope"}]) == [problem]


def test_list_needs_a_row_with_a_title():
    assert check_blocks([{"type": "list", "items": ["Third Wave", {"name": "Dyu"}]}]) == []
    assert check_blocks([{"type": "list", "items": [{"subtitle": "no title"}]}]) == [
        "0: list needs at least one item with a title"]
    assert check_blocks([{"type": "list"}]) == ["0: list needs at least one item with a title"]


def test_progress_needs_title_value_and_a_goal_above_zero():
    assert check_blocks([{"type": "progress", "title": "Trip fund", "value": 5, "goal": 10}]) == []
    assert check_blocks([{"type": "progress", "value": 5, "goal": 10}]) == ["0: progress needs a title"]
    assert check_blocks([{"type": "progress", "title": "x", "value": "5", "goal": 10}]) == [
        "0: progress needs a numeric value"]
    assert check_blocks([{"type": "progress", "title": "x", "value": 5, "goal": 0}]) == [
        "0: progress needs a goal above 0"]


def test_streak_needs_a_count():
    assert check_blocks([{"type": "streak", "count": 3}]) == []
    assert check_blocks([{"type": "streak", "days": []}]) == ["0: streak needs a numeric count"]


def test_heatmap_needs_rows_cols_and_full_value_rows():
    good = {"type": "heatmap", "rows": ["JPM", "GS"], "cols": ["Q1", "Q2"], "values": [[4.1, -1.2], [7.5, None]]}
    assert check_blocks([good]) == []
    assert check_blocks([{"type": "heatmap", "rows": ["a"], "cols": [], "values": [[1]]}]) == [
        "0: heatmap needs rows, cols and values"]
    short = {**good, "values": [[4.1, -1.2], [7.5]]}
    assert check_blocks([short]) == ['0.values.1: row "GS" has 1 values, the heatmap has 2 columns']
    assert check_blocks([{**good, "values": [[None, None], [None, None]]}]) == ["0: heatmap needs at least one number"]


def test_flip_needs_a_card_with_front_and_back():
    assert check_blocks([{"type": "flip", "cards": [{"question": "Host?", "answer": "Nagoya"}]}]) == []
    assert check_blocks([{"type": "flip", "cards": [{"front": "only"}]}]) == [
        "0: flip needs at least one card with a front and a back"]


def test_flip_sides_stay_short():
    fits = {"front": "q" * 120, "back": "a" * 240}
    assert check_blocks([{"type": "flip", "cards": [fits, {"question": "  " + "q" * 120 + "  ", "answer": "a"}]}]) == []
    assert check_blocks([{"type": "flip", "cards": [fits, {"front": "q" * 121, "back": "a"},
                                                    {"question": "q", "answer": "a" * 241}, {"front": "only"}]}]) == [
        "0.cards.1: front is at most 120 characters: a short question",
        "0.cards.2: back is at most 240 characters: a short answer"]


def test_small_atoms():
    assert check_blocks([{"type": "badge", "text": "New"}, {"type": "link", "url": "https://www.irctc.co.in"},
                         {"type": "image", "url": "https://x.example/a.jpg"},
                         {"type": "bar", "label": "Packed", "value": 6, "max": 9}]) == []
    assert check_blocks([{"type": "badge"}, {"type": "link", "url": "javascript:alert(1)"},
                         {"type": "image", "url": "http://x.example/a.jpg"}, {"type": "bar", "label": "x"}]) == [
        "0: badge needs text", "1: link needs an https url", "2: image needs an https url",
        "3: bar needs a label and a numeric value"]


def test_actions_need_one_to_three_buttons_with_label_and_run():
    assert check_blocks([{"type": "actions", "items": [{"label": "Analyze", "run": "Analyze TCS"}]}]) == []
    assert check_blocks([{"type": "actions", "items": []}]) == ["0: actions needs 1-3 items"]
    four = [{"label": f"b{i}", "run": "go"} for i in range(4)]
    assert check_blocks([{"type": "actions", "items": four}]) == ["0: actions needs 1-3 items"]
    assert check_blocks([{"type": "actions", "items": [{"label": "Go"}]}]) == ["0.items.0: button needs label and run"]


def test_button_needs_a_label_and_run_or_an_https_url():
    assert check_blocks([{"type": "button", "label": "Plan", "run": "Plan day 2"},
                         {"type": "button", "label": "Book", "url": "https://www.irctc.co.in"}]) == []
    broken = [{"type": "button", "run": "x"}, {"type": "button", "label": "Go", "url": "http://x.example"}]
    assert check_blocks(broken) == ["0: button needs a label", "1: button needs run or an https url"]


def test_tiles_need_two_to_eight_titled_cards():
    tile = {"title": "Kyoto", "ask": "Plan Kyoto"}
    assert check_blocks([{"type": "tiles", "items": [tile, {"title": "Nara", "run": "Plan Nara"}]}]) == []
    assert check_blocks([{"type": "tiles", "items": [tile]}]) == ["0: tiles needs 2-8 items"]
    assert check_blocks([{"type": "tiles", "items": [tile] * 9}]) == ["0: tiles needs 2-8 items"]
    assert check_blocks([{"type": "tiles", "items": [tile, {"title": "Nara"}, {"ask": "x"}]}]) == [
        "0.items.2: tile needs a title"]


def test_tiles_allow_informational_cards_without_actions():
    """Passive tiles are valid alongside interactive tiles."""
    board = [{"type": "tiles", "items": [
        {"title": "Scenic drive", "subtitle": "Explore the Hudson Valley"},
        {"title": "Village stroll", "subtitle": "Browse local shops"},
        {"title": "Plan dinner", "ask": "Suggest dinner options"},
    ]}]
    assert check_blocks(board) == []


def test_checklist_needs_1_to_40_items_with_text():
    assert check_blocks([{"type": "checklist", "items": ["Passport", {"text": "Jacket", "group": "Clothes"}]}]) == []
    assert check_blocks([{"type": "checklist", "items": []}]) == ["0: checklist needs 1-40 items"]
    assert check_blocks([{"type": "checklist", "items": ["x"] * 41}]) == ["0: checklist needs 1-40 items"]
    assert check_blocks([{"type": "checklist", "items": ["ok", {"group": "Clothes"}, " "]}]) == [
        "0.items.1: item needs text", "0.items.2: item needs text"]


LOAN = {"type": "calculator", "inputs": [{"id": "p", "label": "Loan", "min": 0, "max": 100, "value": 40}],
        "outputs": [{"label": "EMI", "formula": "emi(p, 8.5, 20)"}]}


def test_calculator_needs_usable_inputs():
    assert check_blocks([LOAN]) == []
    assert check_blocks([{**LOAN, "inputs": []}]) == ["0: calculator needs 1-6 inputs"]
    bad = [{"id": "emi"}, {"id": "a.b"}, {"id": "x", "min": 5, "max": 5}, {"id": "p"}, {"id": "p"}]
    assert check_blocks([{**LOAN, "inputs": bad}]) == [
        "0.inputs.0: input id \"emi\" is a helper's name",
        '0.inputs.1: input needs an id like "p" or "rate"',
        "0.inputs.2: input's max must be above its min",
        '0.inputs.4: input id "p" is used twice',
    ]


def test_calculator_outputs_need_label_and_formula():
    assert check_blocks([{**LOAN, "outputs": [{"label": "EMI"}]}]) == [
        "0.outputs.0: output needs a label and a formula"]
    assert check_blocks([{**LOAN, "outputs": [{"label": "x", "formula": "p"}] * 7}]) == [
        "0: a calculator shows at most 6 outputs"]


FORM = {"type": "form", "id": "trip", "title": "Weekend", "fields": [
    {"id": "where", "kind": "select", "label": "Where", "options": ["Hills", "Beach"]},
    {"id": "spend", "kind": "slider", "label": "Budget", "min": 5, "max": 30},
    {"id": "notes", "kind": "text", "label": "Notes"}]}


def test_form_needs_fields_it_can_draw():
    assert check_blocks([FORM]) == []
    assert check_blocks([{**FORM, "fields": []}]) == ["0: form needs 1-12 fields"]
    bad = [{"id": "a", "kind": "date"}, {"kind": "text"}, {"id": "r", "kind": "radio", "options": []},
           {"id": "s", "kind": "slider", "min": 5, "max": 5}, {"id": "t", "kind": "text"}, {"id": "t", "kind": "text"}]
    assert check_blocks([{**FORM, "fields": bad}]) == [
        '0.fields.0: field kind "date" isn\'t one of select, radio, checkbox, slider, text',
        "0.fields.1: field needs an id",
        "0.fields.2: radio needs options",
        "0.fields.3: slider needs min below max",
        '0.fields.5: field id "t" is used twice',
    ]


TEXT = {"type": "text", "text": "x"}


def tabs_of(*tabs: dict) -> dict:
    return {"type": "tabs", "tabs": list(tabs)}


def test_tabs_hold_two_to_six_labelled_tabs_of_blocks():
    one, two = {"label": "Overview", "children": [TEXT]}, {"label": "Risks", "children": [TEXT]}
    assert check_blocks([tabs_of(one, two)]) == []
    assert check_blocks([tabs_of(one)]) == ["0: tabs needs 2-6 tabs"]
    assert check_blocks([tabs_of(*[one] * 7)]) == ["0: tabs needs 2-6 tabs"]
    assert check_blocks([{"type": "tabs"}]) == ["0: tabs needs 2-6 tabs"]
    bad = [{"children": [TEXT]}, {"label": "x" * 31, "children": [TEXT]}, {"label": "Empty", "children": []}, "tab"]
    assert check_blocks([tabs_of(one, *bad)]) == [
        "0.tabs.1: tab needs a label",
        "0.tabs.2: a tab's label is at most 30 characters",
        "0.tabs.3: tab needs children",
        "0.tabs.4: tab is not an object",
    ]


def test_a_tab_may_carry_a_count_badge():
    one, two = {"label": "Bills", "children": [TEXT], "badge": 4}, {"label": "Done", "children": [TEXT]}
    assert check_blocks([tabs_of(one, two)]) == []
    for bad in (0, -1, 1000, 2.5, "4", True):
        assert check_blocks([tabs_of({**one, "badge": bad}, two)]) == [
            "0.tabs.0: a tab's badge is a whole number from 1 to 999"], bad


def test_a_tab_holds_any_blocks_read_as_if_at_the_top_level():
    columns = {"type": "columns", "children": [TEXT, TEXT]}
    section = {"type": "section", "title": "S", "children": [{"type": "row", "children": [TEXT, TEXT]}]}
    tab = {"label": "A", "children": [columns, section, {"type": "grid", "children": [TEXT, TEXT]}]}
    assert check_blocks([tabs_of(tab, {"label": "B", "children": [TEXT, {"type": "text"}]})]) == [
        "0.tabs.1.children.1: text needs text"]


def test_tabs_sit_at_the_top_level_only():
    tabs = tabs_of({"label": "A", "children": [TEXT]}, {"label": "B", "children": [TEXT]})
    assert check_blocks([{"type": "section", "title": "S", "children": [tabs]}]) == [
        "0.children.0: tabs go at the top level only"]
    assert check_blocks([tabs_of({"label": "A", "children": [tabs]}, {"label": "B", "children": [TEXT]})]) == [
        "0.tabs.0.children.0: tabs go at the top level only"]


EMI_CHART = {"kind": "line", "x": {"name": "y", "from": 0, "to": "n", "step": 1},
             "series": [{"name": "Balance", "formula": "balance(p, r, n, y)"}]}


def test_calculator_chart_is_checked_when_present():
    loan = {**LOAN, "inputs": [*LOAN["inputs"], {"id": "n", "min": 5, "max": 30, "value": 20}]}
    assert check_blocks([{**loan, "chart": EMI_CHART}]) == []
    labelled = {**EMI_CHART, "kind": "area", "x": {**EMI_CHART["x"], "label": "Y{y}"}}
    assert check_blocks([{**loan, "chart": labelled}]) == []
    assert check_blocks([{**loan, "chart": "line"}]) == ["0.chart: chart must be an object"]
    assert check_blocks([{**loan, "chart": {**EMI_CHART, "kind": "pie"}}]) == [
        "0.chart: chart kind is line, area or bar"]
    assert check_blocks([{**loan, "chart": {**EMI_CHART, "series": []}}]) == ["0.chart: chart needs 1-3 series"]
    assert check_blocks([{**loan, "chart": {**EMI_CHART, "series": EMI_CHART["series"] * 4}}]) == [
        "0.chart: chart needs 1-3 series"]
    assert check_blocks([{**loan, "chart": {**EMI_CHART, "series": [{"name": "B"}, {"formula": "y"}]}}]) == [
        "0.chart.series.0: series needs a name and a formula",
        "0.chart.series.1: series needs a name and a formula",
    ]


def test_calculator_chart_x_needs_a_free_name_and_a_range():
    loan = {**LOAN, "inputs": [*LOAN["inputs"], {"id": "n", "min": 5, "max": 30, "value": 20}]}

    def x_problems(x: object) -> list[str]:
        return check_blocks([{**loan, "chart": {**EMI_CHART, "x": x}}])

    assert x_problems(None) == ['0.chart.x: x needs a name like "y"']
    assert x_problems({"name": "a b", "from": 0, "to": 1, "step": 1}) == ['0.chart.x: x needs a name like "y"']
    assert x_problems({"name": "n", "from": 0, "to": 1, "step": 1}) == ["0.chart.x: x name \"n\" is an input's id"]
    assert x_problems({"name": "balance", "from": 0, "to": 1, "step": 1}) == [
        "0.chart.x: x name \"balance\" is a helper's name"]
    assert x_problems({"name": "y", "from": 0, "to": "n"}) == [
        "0.chart.x: x needs from, to and step (numbers or formulas)"]
    assert x_problems({"name": "y", "from": 0, "to": " ", "step": True}) == [
        "0.chart.x: x needs from, to and step (numbers or formulas)"]


def test_calculator_chart_x_label_puts_the_value_where_x_is_named():
    loan = {**LOAN, "inputs": [*LOAN["inputs"], {"id": "n", "min": 5, "max": 30, "value": 20}]}

    def label_problems(label: str) -> list[str]:
        return check_blocks([{**loan, "chart": {**EMI_CHART, "x": {**EMI_CHART["x"], "name": "d", "label": label}}}])

    assert label_problems("Night {d}") == []
    assert label_problems("Night") == []
    assert label_problems("Night {y}") == ["0.chart.x: label uses {y} but x is named d; write {d}"]
    assert label_problems("{d} of {n}, {total}") == ["0.chart.x: label uses {n}, {total} but x is named d; write {d}"]


def test_new_helpers_cannot_be_input_ids():
    for name in ("balance", "principal_paid", "interest_paid", "sip_value"):
        assert check_blocks([{**LOAN, "inputs": [{"id": name}]}]) == [
            f"0.inputs.0: input id \"{name}\" is a helper's name"]


def test_formula_helpers_match_the_web_side():
    source = (ROOT / "web" / "src" / "lib" / "formula.ts").read_text(encoding="utf-8")
    block = re.search(r"const HELPERS[^{]*\{(.*?)\};", source, re.DOTALL).group(1)
    assert sorted(re.findall(r"(\w+): \[", block)) == sorted(FORMULA_HELPERS)


# --- size and depth (a board can't grow without bound) -------------------------------------------------------------

TEXT = {"type": "text", "text": "hi"}


def nested_rows(depth: int) -> dict:
    """`depth` rows, each holding the next; the innermost holds a text."""
    block: dict = TEXT
    for _ in range(depth):
        block = {"type": "row", "children": [block]}
    return block


def test_at_most_40_blocks_at_the_top_level():
    assert check_blocks([TEXT] * 40) == []
    assert check_blocks([TEXT] * 41) == ["blocks: too many blocks (max 40)"]


def test_containers_nest_at_most_8_deep():
    assert check_blocks([nested_rows(8)]) == []
    path = ".".join(["0"] + ["children.0"] * 8)
    assert check_blocks([nested_rows(9)]) == [f"{path}: nested too deep (max 8)"]


def test_tabs_count_as_a_level():
    tabs = {"type": "tabs", "tabs": [{"label": "A", "children": [nested_rows(8)]}, {"label": "B", "children": [TEXT]}]}
    path = "0.tabs.0.children.0" + ".children.0" * 7
    assert check_blocks([tabs]) == [f"{path}: nested too deep (max 8)"]


def test_600_nested_rows_are_a_problem_not_a_crash():
    problems = check_blocks([nested_rows(600)])
    assert len(problems) == 1 and problems[0].endswith(": nested too deep (max 8)")


# --- what a button sends (it is sent as the user, so no /commands or @-references) ----------------------------------

RISKY = ["/reset", "  @file:~/.ssh/id_rsa", "!rm -rf ~", "Summarise @url:https://evil.example/x", "see @folder:/etc",
         "look at @notes:secret", "show me @diff"]
NO_SEND = "a button's message can't start with / @ or ! or carry @-references"


@pytest.mark.parametrize("run", RISKY)
def test_a_button_cant_send_a_command_or_reference(run):
    assert check_blocks([{"type": "button", "label": "Go", "run": run}]) == [f"0: {NO_SEND}"]
    assert check_blocks([{"type": "actions", "items": [{"label": "Go", "run": "fine"}, {"label": "X", "run": run}]}]) \
        == [f"0.items.1: {NO_SEND}"]
    tiles = {"type": "tiles", "items": [{"title": "A", "run": "Plan A"}, {"title": "B", "ask": run}]}
    assert check_blocks([tiles]) == [f"0.items.1: {NO_SEND}"]
    rows = {"type": "list", "rows": [{"title": "A"}, {"title": "B", "run": run}]}
    assert check_blocks([rows]) == [f"0.rows.1: {NO_SEND}"]
    for fine in ("Email me at name@example.com", "Meet @ 5pm", "Plan day 2", "What's 5 / 2?"):  # an @ alone is fine
        assert check_blocks([{"type": "button", "label": "Go", "run": fine}]) == []


# --- form field ids ---------------------------------------------------------------------------------------------------


@pytest.mark.parametrize("field_id", ["x" * 41, "1st", "two words", "a.b", "constructor()"])
def test_form_field_ids_are_plain_words(field_id):
    fine = [{"id": f, "kind": "text"} for f in ("where", "_x", "trip-2", "A_b", "x" * 40)]
    form = {"type": "form", "fields": [{"id": field_id, "kind": "text"}, *fine]}
    assert check_blocks([form]) == ['0.fields.0: field id must be a word like "where" (letters, digits, _ or -)']


@pytest.mark.parametrize("field_id", ["__proto__", "constructor", "prototype"])
def test_object_built_in_names_are_not_field_ids(field_id):
    form = {"type": "form", "fields": [{"id": field_id, "kind": "text"}]}
    assert check_blocks([form]) == [f'0.fields.0: field id "{field_id}" is reserved']


# --- form extras: option notes, groups, slider ends, text placeholder and multiline -----------------------------------


def test_form_takes_notes_groups_ends_and_text_extras():
    form = {"type": "form", "id": "goa", "title": "Goa weekend", "fields": [
        {"id": "pace", "kind": "radio", "label": "Pace", "group": "Your style", "value": "easy", "options": [
            {"value": "easy", "label": "Easy", "note": "Beach, long lunches"}, "Full"]},
        {"id": "spend", "kind": "slider", "label": "Budget", "min": 5, "max": 60, "ends": ["Shoestring", "Splurge"]},
        {"id": "notes", "kind": "text", "label": "Anything else?", "multiline": True,
         "placeholder": "e.g. no early starts"},
    ]}
    assert check_blocks([form]) == []


def test_form_extras_must_be_short_text():
    fields = [
        {"id": "a", "kind": "radio", "options": [{"value": "x", "note": "n" * 81}]},
        {"id": "b", "kind": "select", "options": [{"value": "x", "note": 5}]},
        {"id": "c", "kind": "text", "group": "g" * 41},
        {"id": "d", "kind": "slider", "ends": ["slow"]},
        {"id": "e", "kind": "slider", "ends": ["slow", "q" * 21]},
        {"id": "f", "kind": "text", "placeholder": "p" * 61},
        {"id": "g", "kind": "text", "multiline": "yes"},
        {"id": "h", "kind": "text", "group": "g" * 40, "placeholder": "p" * 60},
        {"id": "i", "kind": "slider", "ends": ["s" * 20, "q"]},
        {"id": "j", "kind": "checkbox", "options": [{"value": "x", "note": "n" * 80}]},
    ]
    assert check_blocks([{"type": "form", "fields": fields}]) == [
        "0.fields.0: option note is text of at most 80 characters",
        "0.fields.1: option note is text of at most 80 characters",
        "0.fields.2: group is text of at most 40 characters",
        "0.fields.3: slider ends are two texts of at most 20 characters, [left, right]",
        "0.fields.4: slider ends are two texts of at most 20 characters, [left, right]",
        "0.fields.5: placeholder is text of at most 60 characters",
        "0.fields.6: multiline is true or false",
    ]


# --- flow and steps -------------------------------------------------------------------------------

FLOW = {"type": "flow", "id": "tf", "title": "How a transformer picks the next word", "direction": "right", "nodes": [
    {"id": "tokens", "label": "Tokens", "icon": "note", "note": "The text split into **pieces**."},
    {"id": "attn", "label": "Attention", "icon": "brain"},
    {"id": "ffn", "label": "Feed-forward"},
    {"id": "next", "label": "Next word", "note": "The likeliest token."},
], "groups": [{"label": "Repeated × 12 layers", "nodes": ["attn", "ffn"]}]}

STEPS = {"type": "steps", "title": "Step by step", "for": "tf", "items": [
    {"title": "Split the text into tokens", "text": "Each **piece** becomes a number.", "node": "tokens"},
    {"title": "Attend", "text": "Every token looks at the others.", "node": "attn",
     "image": "https://a.example/attention.jpg"},
]}


def test_a_good_flow_and_steps_pass():
    assert check_blocks([FLOW, STEPS]) == []
    assert check_blocks([{"type": "flow", "nodes": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}]}]) == []


def test_flow_needs_2_to_10_nodes():
    one = {"type": "flow", "nodes": [{"id": "a", "label": "A"}]}
    many = {"type": "flow", "nodes": [{"id": f"n{i}", "label": "N"} for i in range(11)]}
    assert check_blocks([one, many, {"type": "flow"}]) == [
        "0: flow needs 2-10 nodes", "1: flow needs 2-10 nodes", "2: flow needs 2-10 nodes"]


def test_flow_fields_are_checked_strictly():
    flow = {"type": "flow", "id": "Big Flow", "title": "t" * 81, "direction": "left", "nodes": [
        {"id": "a", "label": "A"}, "b"]}
    assert check_blocks([flow]) == [
        '0: flow id must be a short lowercase slug like "tf" (a-z, 0-9, - or _; up to 24)',
        "0: title is text of at most 80 characters",
        '0: direction is "right" or "down"',
        "0.nodes.1: node is not an object",
    ]


def test_flow_nodes_are_checked_one_by_one():
    nodes = [
        {"id": "ok", "label": "Fine", "icon": "brain", "note": "n" * 280},
        {"id": "ok", "label": "Twice"},
        {"id": "__proto__", "label": "x"},
        {"id": "c"},
        {"id": "d", "label": "l" * 41},
        {"id": "e", "label": "E", "note": "n" * 281},
        {"id": "f", "label": "F", "icon": "rocket"},
        {"id": "g", "label": "G", "note": 5},
    ]
    assert check_blocks([{"type": "flow", "nodes": nodes}]) == [
        '0.nodes.1: node id "ok" is used twice',
        '0.nodes.2: node id must be a short lowercase slug like "tf" (a-z, 0-9, - or _; up to 24)',
        "0.nodes.3: node needs a label",
        "0.nodes.4: label is text of at most 40 characters",
        "0.nodes.5: note is text of at most 280 characters",
        '0.nodes.6: icon "rocket" isn\'t one of the catalog icons',
        "0.nodes.7: note is text of at most 280 characters",
    ]


def test_flow_groups_frame_a_run_of_existing_nodes():
    nodes = [{"id": k, "label": k.upper()} for k in ("a", "b", "c", "d")]
    run = {"label": "Run", "nodes": ["b", "c"]}
    assert check_blocks([{"type": "flow", "nodes": nodes, "groups": [run] * 4}]) == ["0: flow takes at most 3 groups"]
    assert check_blocks([{"type": "flow", "nodes": nodes, "groups": "all"}]) == ["0: flow takes at most 3 groups"]
    groups = [run, {"label": "Gap", "nodes": ["a", "c"]}, {"label": "Unknown", "nodes": ["z"]}]
    assert check_blocks([{"type": "flow", "nodes": nodes, "groups": groups}]) == [
        "0.groups.1: group nodes must be node ids next to each other, in order",
        "0.groups.2: group nodes must be node ids next to each other, in order",
    ]
    groups = [run, {"label": "Shared", "nodes": ["c", "d"]}, {"nodes": ["a"]}]
    assert check_blocks([{"type": "flow", "nodes": nodes, "groups": groups}]) == [
        "0.groups.1: groups can't share nodes",
        "0.groups.2: group needs a label of at most 40 characters",
    ]
    backwards = {"label": "Back", "nodes": ["c", "b"]}
    assert check_blocks([{"type": "flow", "nodes": nodes, "groups": [backwards, {"label": "x", "nodes": []}]}]) == [
        "0.groups.0: group nodes must be node ids next to each other, in order",
        "0.groups.1: group nodes must be node ids next to each other, in order",
    ]


def test_steps_need_2_to_12_titled_items():
    one = {"type": "steps", "items": [{"title": "Only"}]}
    many = {"type": "steps", "items": [{"title": f"s{i}"} for i in range(13)]}
    assert check_blocks([one, many]) == ["0: steps needs 2-12 items", "1: steps needs 2-12 items"]


def test_steps_fields_are_checked_strictly():
    steps = {"type": "steps", "for": "Not A Slug", "title": 5, "items": [
        {"title": "Fine", "text": "t" * 600, "node": "tokens", "image": "https://a.example/x.jpg"},
        {"text": "no title"},
        {"title": "t" * 81},
        {"title": "Long", "text": "t" * 601},
        {"title": "Node", "node": "Two Words"},
        {"title": "Photo", "image": "http://a.example/x.jpg"},
        "plain",
    ]}
    assert check_blocks([steps]) == [
        '0: for must be a flow\'s id, a short lowercase slug like "tf" (a-z, 0-9, - or _; up to 24)',
        "0: title is text of at most 80 characters",
        "0.items.1: step needs a title of at most 80 characters",
        "0.items.2: step needs a title of at most 80 characters",
        "0.items.3: text is text of at most 600 characters",
        '0.items.4: node must be a node id, a short lowercase slug like "tf" (a-z, 0-9, - or _; up to 24)',
        "0.items.5: image must be an https photo url",
        "0.items.6: step is not an object",
    ]


# --- flow contents and packets --------------------------------------------------------------------

def _flow(**extra) -> dict:
    nodes = [{"id": k, "label": k.upper()} for k in ("tok", "attn", "ffn", "out")]
    return {"type": "flow", "id": "tf", "nodes": nodes, **extra}


def test_flow_holds_chips_and_counts_its_repeat():
    flow = _flow(groups=[{"label": "Repeated", "nodes": ["attn", "ffn"], "count": 6}])
    flow["nodes"][0]["holds"] = ["The", "animal", {"text": "it", "tone": "accent"}]
    steps = {"type": "steps", "for": "tf", "items": [
        {"title": "Cut", "node": "tok"},
        {"title": "Embed", "node": "attn", "send": True, "holds": {"attn": ["[.2 −1.1 …]"], "tok": []}},
        {"title": "Again", "node": "ffn", "tick": 5, "send": False},
    ]}
    assert check_blocks([flow, steps]) == []


def test_flow_holds_and_count_are_checked_strictly():
    groups = [{"label": "A", "nodes": ["attn"], "count": 1}, {"label": "B", "nodes": ["ffn"], "count": True}]
    flow = _flow(groups=groups)
    flow["nodes"][0]["holds"] = ["x"] * 11
    flow["nodes"][1]["holds"] = ["a" * 17]
    flow["nodes"][2]["holds"] = [{"text": "x", "tone": "loud"}]
    flow["nodes"][3]["holds"] = "The animal"
    assert check_blocks([flow]) == [
        "0.nodes.0: holds is at most 10 chips, each text of at most 16 characters or {text, tone: \"accent\"}",
        "0.nodes.1: holds is at most 10 chips, each text of at most 16 characters or {text, tone: \"accent\"}",
        "0.nodes.2: holds is at most 10 chips, each text of at most 16 characters or {text, tone: \"accent\"}",
        "0.nodes.3: holds is at most 10 chips, each text of at most 16 characters or {text, tone: \"accent\"}",
        "0.groups.0: count is a whole number from 2 to 100",
        "0.groups.1: count is a whole number from 2 to 100",
    ]


def test_step_holds_send_and_tick_are_checked_strictly():
    items = [
        {"title": "Fine", "holds": {"tok": ["a"]}, "send": True, "tick": 20},
        {"title": "Keys", "holds": {"Not A Slug": ["a"]}},
        {"title": "Chips", "holds": {"tok": [""]}},
        {"title": "List", "holds": ["a"]},
        {"title": "Send", "send": "yes"},
        {"title": "Tick", "tick": 21},
        {"title": "Tick", "tick": 0.5},
        {"title": "Many", "holds": {f"n{i}": ["a"] for i in range(11)}},
    ]
    chips = 'holds is at most 10 chips, each text of at most 16 characters or {text, tone: "accent"}'
    assert check_blocks([{"type": "steps", "items": items}]) == [
        '0.items.1: holds maps node ids to chips: {"embed": ["a vector"]}, at most 10 nodes',
        f"0.items.2: {chips}",
        '0.items.3: holds maps node ids to chips: {"embed": ["a vector"]}, at most 10 nodes',
        "0.items.4: send is true or false",
        "0.items.5: tick is a whole number from 1 to 20",
        "0.items.6: tick is a whole number from 1 to 20",
        '0.items.7: holds maps node ids to chips: {"embed": ["a vector"]}, at most 10 nodes',
    ]


def test_checklist_items_may_carry_unique_short_ids():
    ok = [{"type": "checklist", "items": [{"text": "Pay Xfinity", "id": "a1b2c3d4"},
                                          {"text": "Reply to Emma", "id": "e5"}]}]
    assert check_blocks(ok) == []
    dup = [{"type": "checklist", "items": [{"text": "A", "id": "x"}, {"text": "B", "id": "x"}]}]
    assert check_blocks(dup) == ["0.items.1: item id is used twice"]
    long = [{"type": "checklist", "items": [{"text": "A", "id": "x" * 41}]}]
    assert check_blocks(long) == ["0.items.0: item id is plain text up to 40 characters"]
