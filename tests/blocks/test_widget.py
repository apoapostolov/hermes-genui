"""The widget block (#62 prototype): one block that composes local state, expressions and elements.

Both sides read the same fixtures, `web/src/blocks/widget/fixtures.json`, so the values and the exact error strings in
this file are the cross-language agreement: a Python change that drifts from the TypeScript reader fails here first.
"""

import importlib
import json

import pytest

from conftest import ROOT, load_plugin_package

load_plugin_package()
blocks = importlib.import_module("hermes_genui.blocks")
check = importlib.import_module("hermes_genui.core.check")
text_fallback = importlib.import_module("hermes_genui.hooks.text_fallback")
show_blocks = importlib.import_module("hermes_genui.tools.show_blocks")
widget = importlib.import_module("hermes_genui.blocks.widget")
common = importlib.import_module("hermes_genui.blocks.common")

FIXTURES = json.loads(
    (ROOT / "web" / "src" / "blocks" / "widget" / "fixtures.json").read_text(encoding="utf-8"))
WIDGETS = {entry["id"]: entry for entry in FIXTURES["widgets"]}
EXPRESSIONS = FIXTURES["expressions"]


def checked(block: dict) -> list[str]:
    return check.check_blocks([block])


def as_text(block: dict) -> str:
    return blocks.TYPES["widget"][1](block)


def copy(widget_id: str) -> dict:
    return json.loads(json.dumps(WIDGETS[widget_id]))


def minimal(**changes) -> dict:
    """A widget that passes, so one changed field is the only thing a test can be about."""
    block = {"type": "widget", "version": 1, "id": "demo", "title": "Demo", "data": {}, "state": {}, "computed": {},
             "view": [{"kind": "text", "id": "heading", "text": "Demo"}]}
    block.update(changes)
    return block


# --- the shared expression fixtures ------------------------------------------------------------------------------


@pytest.mark.parametrize("case", EXPRESSIONS, ids=[case["name"] for case in EXPRESSIONS])
def test_every_shared_expression_fixture_gives_its_value_and_exact_error(case):
    assert widget.evaluate(case["expr"], case["scope"]) == (case["value"], case["error"])


def test_if_reads_only_the_branch_it_selects():
    # The unselected branch divides by zero: finding that out would mean the branch was read.
    expr = {"op": "if", "args": [False, {"op": "div", "args": [1, 0]}, "safe"]}
    assert widget.evaluate(expr) == ("safe", None)


def test_null_propagates_before_types_are_looked_at():
    assert widget.evaluate({"op": "add", "args": [None, "text"]}) == (None, None)
    assert widget.evaluate({"op": "lt", "args": [None, None]}) == (None, None)
    assert widget.evaluate({"op": "not", "args": [None]}) == (None, None)


def test_a_division_by_zero_is_a_diagnostic_and_never_a_zero():
    assert widget.evaluate({"op": "div", "args": [8, 0]}) == (None, "divided by zero")
    assert widget.evaluate({"op": "div", "args": [8, 4]}) == (2, None)


def test_a_non_finite_result_is_named():
    assert widget.evaluate({"op": "mul", "args": [1e308, 10]}) == (None, "non-finite result")


def test_wrong_operands_are_named():
    assert widget.evaluate({"op": "and", "args": [True, 1]}) == (None, "wrong operand type")
    assert widget.evaluate({"op": "lt", "args": ["a", 1]}) == (None, "wrong operand type")


def test_a_reference_reads_only_declared_paths():
    assert widget.evaluate({"get": "state.nights"}, {"state": {"nights": 4}}) == (4, None)
    assert widget.evaluate({"get": "state.__proto__"}, {"state": {"__proto__": 1}}) == (None, "unknown reference")
    assert widget.evaluate({"get": "state.issues.0.id"}, {"state": {"issues": []}}) == (None, "unknown reference")
    assert widget.evaluate({"get": "tools.list"}) == (None, "unknown reference")


# --- the three shared widgets ------------------------------------------------------------------------------------


@pytest.mark.parametrize("widget_id", list(WIDGETS))
def test_each_shared_widget_passes_the_checker(widget_id):
    assert checked(copy(widget_id)) == []


def test_the_trip_budget_reads_at_its_initial_state():
    assert as_text(copy("trip-budget")) == "\n".join([
        "Trip budget",
        "Illustrative budget; prices have not been fetched.",
        "Nights: 4 (adjustable from 1 to 10 in the interactive view)",
        "Remaining: 400 USD · Planned spend: 800 USD",
        "Planned spend: 800 / 1,200",
        "[Within budget]",
        "Next: Ask Hermes to revise",
    ])


def test_the_capacity_planner_feeds_computed_values_into_an_embedded_chart_and_table():
    assert as_text(copy("capacity-planner")) == "\n".join([
        "Capacity planner",
        "Fixture capacity; no live bookings.",
        "Guests: 2 (adjustable from 1 to 8 in the interactive view) · "
        "Room: standard (adjustable in the interactive view: standard, suite)",
        "Daily capacity: 4",
        "**Planned capacity**: Capacity 4 → 4 (▲ 0%)",
        "**Planned capacity**",
        "| Day | Seats |",
        "| --- | --- |",
        "| Day 1 | 4 |",
        "| Day 2 | 6 |",
        "| Day 3 | 4 |",
    ])


def test_the_issue_triage_repeats_in_order_with_its_selected_detail_and_its_empty_view():
    assert as_text(copy("issue-triage")) == "\n".join([
        "Issue triage",
        "Fixture issues; no network access.",
        "Empty state copy · [open]",
        "Add a short empty view.",
        "Slider keyboard focus · [open]",
        "No archived issues.",
        "Next: Prepare follow-up",
    ])


def test_the_initial_state_decides_a_when_branch():
    trip = copy("trip-budget")
    trip["state"]["nights"]["initial"] = 7  # 7 * 200 = 1,400 planned against a 1,200 budget
    assert "[Over budget]" in as_text(trip)
    assert "Remaining: -200 USD" in as_text(trip)


def test_the_repeat_takes_its_conditional_branch_per_item():
    triage = copy("issue-triage")
    triage["state"]["selected"]["initial"] = "GEN-2"
    text = as_text(triage)
    assert "Keep the focus ring on the range input." in text
    assert "Add a short empty view." not in text


def test_an_unknown_value_reads_as_unknown():
    trip = copy("trip-budget")
    trip["data"]["note"] = None
    assert checked(trip) == []
    assert "unknown" in as_text(trip).split("\n")


def test_the_widget_never_raises_on_malformed_input():
    for broken in ({}, {"type": "widget"}, {"type": "widget", "view": "rows"}, {"type": "widget", "view": [{}]},
                   {"type": "widget", "view": [{"kind": "repeat"}]}, {"type": "widget", "state": 5, "view": []},
                   "not a widget"):
        assert as_text(broken) == ""


def test_the_widget_respects_the_board_cap_and_its_truncation_note():
    long_widget = copy("trip-budget")
    long_widget["view"] = [{"kind": "text", "id": f"line-{i}", "text": "x" * 300} for i in range(20)]
    text = as_text(long_widget)
    assert len(text) <= text_fallback.LIMIT
    assert text.endswith(text_fallback.MORE_NOTE)


# --- the board around the widget ---------------------------------------------------------------------------------


def test_a_board_reads_the_widget_at_its_initial_state():
    assert text_fallback.blocks_as_text([copy("trip-budget")]) == as_text(copy("trip-budget"))


def test_a_widget_sits_in_a_row_without_the_board_walk_refusing_it():
    row = {"type": "row", "children": [copy("trip-budget")]}
    assert checked(row) == []
    assert "Trip budget" in text_fallback.blocks_as_text([row])


def test_a_widget_image_is_a_literal_url_and_needs_no_tool_photo():
    trip = copy("trip-budget")
    trip["view"].append({"kind": "image", "id": "room", "url": "https://example.org/room.jpg", "alt": "Room"})
    assert checked(trip) == []
    assert show_blocks.unknown_photos([trip], set()) == []
    assert "![Room](https://example.org/room.jpg)" in as_text(trip)


# --- version and identity ----------------------------------------------------------------------------------------


def test_version_two_is_refused():
    trip = copy("trip-budget")
    trip["version"] = 2
    assert checked(trip) == ["0: version must be 1"]


def test_a_missing_or_boolean_version_is_refused():
    for version in (None, True, "1", 1.0):
        trip = copy("trip-budget")
        if version is None:
            del trip["version"]
        else:
            trip["version"] = version
        assert checked(trip) == ["0: version must be 1"]


def test_the_id_and_title_are_required_and_readable():
    trip = copy("trip-budget")
    trip["id"] = "1-bad"
    trip["title"] = "  "
    assert checked(trip) == [
        '0: widget needs an id like "trip-budget" (a letter, then letters, digits, - or _)',
        "0: widget needs a title",
    ]


# --- data -------------------------------------------------------------------------------------------------------


def test_data_cannot_reach_a_tool_a_file_or_another_board():
    trip = copy("trip-budget")
    trip["data"]["lookup"] = {"fetch": "https://example.org/x"}
    trip["data"]["nested"] = [{"tool": "run"}]
    assert checked(trip) == [
        '0.data.lookup.fetch: "fetch" is not allowed in widget data',
        '0.data.nested.0.tool: "tool" is not allowed in widget data',
    ]


def test_an_include_block_cannot_hide_in_data():
    trip = copy("trip-budget")
    trip["data"]["extra"] = {"type": "include", "id": "7f3a09bc"}
    assert checked(trip) == ["0.data.extra: an include block can't sit inside widget data"]


# --- state ------------------------------------------------------------------------------------------------------


def test_state_declarations_are_bounded():
    declarations = {f"s{i}": {"type": "boolean", "label": f"S{i}", "initial": False} for i in range(17)}
    assert checked(minimal(state=declarations)) == ["0.state: at most 16 state declarations"]


def test_a_number_needs_finite_bounds_and_an_initial_inside_them():
    declaration = {"type": "number", "label": "Nights", "initial": 4, "min": 1, "max": 10, "step": 1}
    assert checked(minimal(state={"nights": {**declaration, "step": 0}})) == \
        ["0.state.nights: step must be a positive number"]
    assert checked(minimal(state={"nights": {**declaration, "initial": 99}})) == \
        ["0.state.nights: initial must sit between min and max"]
    without_max = {key: value for key, value in declaration.items() if key != "max"}
    assert checked(minimal(state={"nights": without_max})) == \
        ["0.state.nights: a number needs finite min, max and step"]
    assert checked(minimal(state={"nights": {**declaration, "min": 9}})) == \
        ["0.state.nights: initial must sit between min and max"]


def test_a_string_needs_a_max_length_and_an_option_it_starts_on():
    triage = copy("issue-triage")
    del triage["state"]["selected"]["maxLength"]
    assert checked(triage) == ["0.state.selected: a string needs a finite maxLength"]
    triage = copy("issue-triage")
    triage["state"]["selected"]["initial"] = "GEN-9"
    assert checked(triage) == ["0.state.selected: initial must be one of the options"]


def test_a_boolean_starts_as_true_or_false():
    declaration = {"type": "boolean", "label": "Flag", "initial": "yes"}
    assert checked(minimal(state={"flag": declaration})) == ["0.state.flag: a boolean starts as true or false"]


# --- computed ----------------------------------------------------------------------------------------------------


def test_computed_values_are_bounded_and_acyclic():
    many = {f"c{i}": {"op": "add", "args": [i, 1]} for i in range(33)}
    assert checked(minimal(computed=many)) == ["0.computed: at most 32 computed values"]
    assert checked(minimal(computed={"a": {"get": "computed.b"}, "b": {"get": "computed.a"}})) == [
        "0.computed.a: circular dependency",
        "0.computed.b: circular dependency",
    ]


def test_a_computed_name_cannot_repeat_a_state_or_data_name():
    trip = copy("trip-budget")
    trip["computed"]["nights"] = {"op": "add", "args": [1, 1]}
    assert checked(trip) == ["0.computed.nights: a computed name can't repeat a state or data name"]


def test_computed_reads_only_declared_paths():
    trip = copy("trip-budget")
    trip["computed"]["bad"] = {"get": "state.missing"}
    assert checked(trip) == ['0.computed.bad: unknown reference "state.missing"']
    assert checked(minimal(computed={"bad": {"get": "item.id"}})) == \
        ['0.computed.bad: "item.id" reads item, which only a repeat has']


def test_a_constant_computed_diagnostic_reaches_the_model_once():
    assert checked(minimal(computed={"bad": {"op": "div", "args": [1, 0]}})) == ["0.computed.bad: divided by zero"]
    assert checked(minimal(computed={"bad": {"op": "mul", "args": [1e308, 10]}})) == \
        ["0.computed.bad: non-finite result"]
    assert checked(minimal(computed={"bad": {"op": "pow", "args": [2, 3]}})) == \
        ['0.computed.bad: unknown operator "pow"']
    assert checked(minimal(computed={"bad": {"op": "add", "args": ["a", 1]}})) == \
        ["0.computed.bad: wrong operand type"]


# --- elements ---------------------------------------------------------------------------------------------------


def test_an_element_needs_a_known_kind_a_unique_id_and_a_shallow_tree():
    trip = copy("trip-budget")
    trip["view"][0] = {"kind": "carousel", "id": "heading"}
    assert checked(trip) == ['0.view.0: unknown element kind "carousel"']

    trip = copy("trip-budget")
    trip["view"][1]["id"] = "heading"
    assert checked(trip) == ['0.view.1: duplicate element id "heading"']

    trip = copy("trip-budget")
    del trip["view"][0]["id"]
    assert checked(trip) == ['0.view.0: element needs an id like "heading"']


def test_the_view_holds_at_most_two_hundred_nodes_and_eight_levels():
    trip = copy("trip-budget")
    trip["view"] = [{"kind": "text", "id": f"t{i}", "text": "x"} for i in range(201)]
    assert checked(trip) == ["0.view: at most 200 element nodes (this view has 201)"]

    nested: dict = {"kind": "text", "id": "leaf", "text": "x"}
    for level in range(9):
        nested = {"kind": "stack", "id": f"level-{level}", "children": [nested]}
    trip = copy("trip-budget")
    trip["view"] = [nested]
    problems = checked(trip)
    assert len(problems) == 1 and problems[0].endswith("nested too deep (max 8)")


def test_a_repeat_cannot_hold_a_repeat():
    triage = copy("issue-triage")
    inner = {"kind": "repeat", "id": "inner", "items": {"get": "data.issues"}, "key": "id",
             "template": [{"kind": "text", "id": "t", "text": "x"}]}
    triage["view"][2]["template"].append(inner)
    assert checked(triage) == ["0.view.2.template.2: a repeat can't sit inside a repeat"]


def test_a_repeat_reads_a_data_array_with_a_stable_key():
    triage = copy("issue-triage")
    triage["view"][2]["items"] = {"get": "state.selected"}
    assert checked(triage) == ['0.view.2: repeat items must be a data array, like {"get": "data.issues"}']

    triage = copy("issue-triage")
    triage["data"]["issues"][1]["id"] = "GEN-1"
    assert checked(triage) == ['0.view.2: repeat keys must be unique; "GEN-1" repeats']

    triage = copy("issue-triage")
    del triage["data"]["issues"][0]["id"]
    assert checked(triage) == ['0.view.2: every repeat item needs a stable "id"']


def test_a_when_may_leave_else_out_and_refuses_an_else_that_is_not_a_list():
    trip = copy("trip-budget")
    del trip["view"][5]["else"]
    assert checked(trip) == []

    trip = copy("trip-budget")
    trip["view"][5]["else"] = {"kind": "text", "text": "no"}
    assert checked(trip) == ["0.view.5: else is a list of elements (or leave it out for nothing)"]


def test_controls_must_match_the_state_they_change():
    trip = copy("trip-budget")
    trip["view"][2]["children"][0]["state"] = "missing"
    assert checked(trip) == ['0.view.2.children.0: state "missing" isn\'t declared']

    trip = copy("trip-budget")
    trip["view"][2]["children"][0]["control"] = "checkbox"
    assert checked(trip) == ["0.view.2.children.0: a checkbox input needs a boolean state"]

    capacity = copy("capacity-planner")
    del capacity["state"]["room"]["options"]
    assert checked(capacity) == ["0.view.2.children.1: select needs options on the state declaration"]


def test_a_button_sets_state_resets_or_fills_the_composer():
    triage = copy("issue-triage")
    triage["view"][2]["template"][0]["children"][2]["action"]["state"] = "computed.capacity"
    assert checked(triage) == [
        "0.view.2.template.0.children.2: set can only change state; data and computed are read-only"]

    trip = copy("trip-budget")
    trip["view"][6]["action"]["message"] = "/reset"
    assert checked(trip) == [f"0.view.6: {common.NO_SEND}"]

    trip = copy("trip-budget")
    trip["view"][6]["action"] = {"op": "reset"}
    assert checked(trip) == []

    trip = copy("trip-budget")
    trip["view"][6]["action"]["fields"] = ["nights", "missing"]
    assert checked(trip) == ['0.view.6: fill fields are declared state names; "missing" isn\'t one']


def test_urls_are_literal_https_and_never_expressions():
    trip = copy("trip-budget")
    trip["view"].append({"kind": "image", "id": "photo", "url": "http://example.org/a.jpg", "alt": "Room"})
    assert checked(trip) == ["0.view.7.url: image needs an https url"]

    trip = copy("trip-budget")
    trip["view"].append({"kind": "image", "id": "photo", "url": {"get": "data.note"}, "alt": "Room"})
    assert checked(trip) == ["0.view.7.url: a url is literal, never an expression"]

    trip = copy("trip-budget")
    trip["view"].append({"kind": "link", "id": "site", "text": "Site", "url": "https://example.org"})
    assert checked(trip) == []


# --- embedded blocks ---------------------------------------------------------------------------------------------


def test_an_embedded_block_is_allowlisted():
    trip = copy("trip-budget")
    for refused in ("include", "widget", "kpis"):
        trip["view"][4]["spec"]["type"] = refused
        assert checked(trip) == ["0.view.4.spec: an embedded block can be stat, bar, chart, table, source"]


def test_bindings_are_allowed_only_at_the_places_the_contract_names():
    trip = copy("trip-budget")
    trip["view"][4]["bindings"]["/label"] = "Reworded"
    assert checked(trip) == ['0.view.4.bindings."/label": a bar block can bind /value or /max only']

    trip = copy("trip-budget")
    trip["view"][4]["bindings"]["/max"] = {"get": "data.note"}
    assert checked(trip) == ['0.view.4.bindings."/max": needs a number']

    trip = copy("trip-budget")
    trip["view"].append({"kind": "block", "id": "handbook", "spec": {"type": "source", "text": "Handbook"},
                         "bindings": {"/text": "Other"}})
    assert checked(trip) == ["0.view.7.bindings: a source block takes no bindings"]


def test_a_binding_path_must_point_into_the_written_spec():
    capacity = copy("capacity-planner")
    capacity["view"][4]["bindings"] = {"/series/0/data/9": {"get": "computed.capacity"}}
    assert checked(capacity) == ['0.view.4.bindings."/series/0/data/9": no such place in the spec']


def test_the_embedded_block_is_checked_after_its_bindings_are_resolved():
    # The bar's value is written as 0 and the binding puts 800 there; only the resolved block is checked.
    trip = copy("trip-budget")
    trip["view"][4]["spec"]["max"] = 0
    assert checked(trip) == []

    # A chart whose labels and data disagree is refused through the embedded block's own checker.
    capacity = copy("capacity-planner")
    capacity["view"][4]["spec"]["x"].append("Day 4")
    assert checked(capacity) == ["0.view.4.spec.series.0: data has 3 values but x has 4 labels"]
