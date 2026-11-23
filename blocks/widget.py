"""widget: one block that composes local state, computed values, elements and allowlisted embedded blocks (#62).

The model writes the whole thing as JSON; Hermes Desktop draws it and keeps the state while the card lives. This half
checks it before a board is stored and reads it back as plain text for chat apps, both at the initial state.

    check_widget(block, path) → [(path, why), ...]   (empty when the widget can be drawn)
    text_widget(block) → Markdown at the initial state, or "" when nothing in it reads as text
    evaluate(expr, scope) → (value, error)           (the shared expression engine; error is None when it worked)

The rules are the prototype contract (WIDGET_PROTOTYPE_CONTRACT.md): version 1, explicit paths (state.x, data.x,
computed.x, item.x), null for unknown, and a refusal that names what is wrong instead of guessing a value. Parsing and
validation stay in this module, so core/check.py needs only the registry entry.
"""

import math
import re

from .atoms import check_bar, text_bar
from .chart import check_chart, text_chart
from .common import (
    NO_SEND,
    acts_before_the_model,
    fmt_num,
    is_https,
    is_number,
    md_link,
    safe_text,
    safe_url,
    with_unit,
)
from .kpis import check_stat, text_stat
from .source import check_source, text_source
from .table import check_table, text_table

MAX_STATE = 16
MAX_COMPUTED = 32
MAX_NODES = 200
MAX_DEPTH = 8
MAX_ITEMS = 100
MAX_OPTIONS = 16
MAX_FILL_FIELDS = 16

NAME = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}")
PROTOTYPE = frozenset({"__proto__", "prototype", "constructor"})
FORBIDDEN_DATA_KEYS = ("fetch", "tool", "tools", "include")
STATE_TYPES = ("number", "string", "boolean")
CONTROLS = ("number", "slider", "select", "checkbox", "text")
CONTROL_STATE = {"number": "number", "slider": "number", "select": "string", "checkbox": "boolean", "text": "string"}
TONES = ("muted", "good", "warn", "bad", "info", "plain")
GAPS = ("xs", "sm", "md", "lg")
LAYOUT_KINDS = ("stack", "row", "grid", "surface")
HORIZONTAL = ("row", "grid")
ELEMENT_KINDS = (*LAYOUT_KINDS, "text", "number", "badge", "divider", "image", "link", "input", "button", "when",
                "repeat", "block")
EMBEDDED = {
    "stat": (check_stat, text_stat),
    "bar": (check_bar, text_bar),
    "chart": (check_chart, text_chart),
    "table": (check_table, text_table),
    "source": (check_source, text_source),
}
OPERATORS = ("add", "sub", "mul", "div", "eq", "lt", "lte", "and", "or", "not", "if")
ARITY = {"add": 2, "sub": 2, "mul": 2, "div": 2, "eq": 2, "lt": 2, "lte": 2, "and": 2, "or": 2, "not": 1, "if": 3}
NAMESPACES = ("data", "state", "computed", "item")

_EXPR_SHAPE = 'an expression is a literal, {"get": "state.x"} or {"op": "add", "args": [...]}'
_BINDABLE = {
    "stat": "/value",
    "bar": "/value or /max",
    "chart": "/series/<n>/data/<i>",
    "table": "/rows/<i>/<column>",
}
_UNRESOLVED = object()


# --- expressions -------------------------------------------------------------------------------------------------


def evaluate(expr: object, scope: dict | None = None) -> tuple[object, str | None]:
    """One expression against a scope of {"data": ..., "state": ..., "computed": ..., "item": ...}, as the value and
    the diagnostic; null means unknown, and a diagnostic always comes with a null value.

    evaluate({"get": "state.nights"}, {"state": {"nights": 4}}) → (4, None)
    evaluate({"op": "div", "args": [1, 0]}) → (None, "divided by zero")
    evaluate({"op": "add", "args": [None, 2]}) → (None, None)
    evaluate({"op": "pow", "args": [2, 3]}) → (None, "unknown operator")
    """
    scope = scope if isinstance(scope, dict) else {}
    computed = scope.get("computed")

    def resolve(name: str) -> tuple[object, str | None]:
        if isinstance(computed, dict) and name in computed:
            return computed[name], None
        return None, "unknown reference"

    return _eval(expr, scope, resolve)


def _eval(expr: object, scope: dict, resolve) -> tuple[object, str | None]:
    """The value of one expression; `resolve` answers a computed name, so a widget resolves its graph lazily."""
    if expr is None or isinstance(expr, bool):
        return expr, None
    if is_number(expr):
        return (expr, None) if _finite(expr) else (None, "non-finite result")
    if isinstance(expr, str):
        return expr, None
    if not isinstance(expr, dict):
        return None, "wrong operand type"
    if "get" in expr:
        return _lookup(expr.get("get"), scope, resolve)
    op = expr.get("op")
    if op not in OPERATORS:
        return None, "unknown operator"
    args = expr.get("args")
    if not isinstance(args, list) or len(args) != ARITY[op]:
        return None, "wrong operand type"
    if op == "if":
        return _eval_if(args, scope, resolve)
    values = []
    for arg in args:
        value, error = _eval(arg, scope, resolve)
        if error:
            return None, error
        values.append(value)
    handler = {"add": _sum, "sub": _difference, "mul": _product, "div": _quotient, "eq": _equal, "lt": _less,
               "lte": _less_or_equal, "and": _both, "or": _either, "not": _negate}[op]
    return handler(*values)


def _lookup(ref: object, scope: dict, resolve) -> tuple[object, str | None]:
    """A reference's value. Only data.x, state.x, computed.x and item.x; anything else is unknown."""
    if not isinstance(ref, str):
        return None, "unknown reference"
    parts = ref.split(".")
    if len(parts) != 2 or not all(parts) or parts[0] not in NAMESPACES or not NAME.fullmatch(parts[1]) \
            or parts[1] in PROTOTYPE:
        return None, "unknown reference"
    namespace, name = parts
    if namespace == "computed":
        return resolve(name)
    bucket = scope.get(namespace)
    if not isinstance(bucket, dict) or name not in bucket:
        return None, "unknown reference"
    return bucket[name], None


def _eval_if(args: list, scope: dict, resolve) -> tuple[object, str | None]:
    """if(test, then, else), reading only the branch the test selects.

    {"op": "if", "args": [false, {"op": "div", "args": [1, 0]}, "safe"]} → ("safe", None)
    """
    test, error = _eval(args[0], scope, resolve)
    if error:
        return None, error
    if test is None:
        return None, None
    if not isinstance(test, bool):
        return None, "wrong operand type"
    return _eval(args[1] if test else args[2], scope, resolve)


def _arithmetic(values: list) -> tuple[list | None, str | None]:
    """The operands when every one is a number; null propagates as unknown before types are looked at."""
    if any(value is None for value in values):
        return None, None
    if not all(is_number(value) for value in values):
        return None, "wrong operand type"
    return values, None


def _result(value: float) -> tuple[object, str | None]:
    return (value, None) if _finite(value) else (None, "non-finite result")


def _sum(a: object, b: object) -> tuple[object, str | None]:
    values, error = _arithmetic([a, b])
    return (None, error) if error or values is None else _result(values[0] + values[1])


def _difference(a: object, b: object) -> tuple[object, str | None]:
    values, error = _arithmetic([a, b])
    return (None, error) if error or values is None else _result(values[0] - values[1])


def _product(a: object, b: object) -> tuple[object, str | None]:
    values, error = _arithmetic([a, b])
    return (None, error) if error or values is None else _result(values[0] * values[1])


def _quotient(a: object, b: object) -> tuple[object, str | None]:
    values, error = _arithmetic([a, b])
    if error or values is None:
        return None, error
    if values[1] == 0:
        return None, "divided by zero"
    return _result(values[0] / values[1])


def _equal(a: object, b: object) -> tuple[object, str | None]:
    """Same-ish primitives compare; a number and a string are simply not equal, and null is unknown."""
    if a is None or b is None:
        return None, None
    if is_number(a) and is_number(b):
        return a == b, None
    if isinstance(a, str) and isinstance(b, str):
        return a == b, None
    if isinstance(a, bool) and isinstance(b, bool):
        return a == b, None
    return False, None


def _ordered(a: object, b: object, test) -> tuple[object, str | None]:
    if a is None or b is None:
        return None, None
    if is_number(a) and is_number(b):
        return test(a, b), None
    if isinstance(a, str) and isinstance(b, str):
        return test(a, b), None
    return None, "wrong operand type"


def _less(a: object, b: object) -> tuple[object, str | None]:
    return _ordered(a, b, lambda x, y: x < y)


def _less_or_equal(a: object, b: object) -> tuple[object, str | None]:
    return _ordered(a, b, lambda x, y: x <= y)


def _both(a: object, b: object) -> tuple[object, str | None]:
    if a is None or b is None:
        return None, None
    if not (isinstance(a, bool) and isinstance(b, bool)):
        return None, "wrong operand type"
    return a and b, None


def _either(a: object, b: object) -> tuple[object, str | None]:
    if a is None or b is None:
        return None, None
    if not (isinstance(a, bool) and isinstance(b, bool)):
        return None, "wrong operand type"
    return a or b, None


def _negate(a: object) -> tuple[object, str | None]:
    if a is None:
        return None, None
    if not isinstance(a, bool):
        return None, "wrong operand type"
    return not a, None


def _finite(value: object) -> bool:
    return is_number(value) and math.isfinite(value)


# --- what an expression may read ---------------------------------------------------------------------------------


class _Ctx:
    """The declared names an expression may read, and whether an item is in scope."""

    def __init__(self, data: dict, state: dict, computed: dict, item_ok: bool = False,
                 item_keys: set[str] | None = None):
        self.data = data
        self.state = state
        self.computed = computed
        self.data_names = set(data)
        self.state_names = set(state)
        self.computed_names = set(computed)
        self.item_ok = item_ok
        self.item_keys = item_keys

    def with_item(self, keys: set[str] | None) -> "_Ctx":
        return _Ctx(self.data, self.state, self.computed, item_ok=True, item_keys=keys)


def _check_expr(expr: object, path: str, ctx: _Ctx) -> list[tuple[str, str]]:
    """Every problem with one expression: its shape, then each reference against what the widget declares."""
    if expr is None or isinstance(expr, bool) or is_number(expr) or isinstance(expr, str):
        if is_number(expr) and not _finite(expr):
            return [(path, "expression numbers must be finite")]
        return []
    if not isinstance(expr, dict):
        return [(path, _EXPR_SHAPE)]
    if "get" in expr:
        if set(expr) - {"get"}:
            return [(path, "an expression has get or op, nothing else")]
        return _check_ref(expr.get("get"), path, ctx)
    if "op" not in expr:
        return [(path, _EXPR_SHAPE)]
    op = expr["op"]
    if op not in OPERATORS:
        return [(path, f'unknown operator "{op}"' if isinstance(op, str) else _EXPR_SHAPE)]
    args = expr.get("args")
    if not isinstance(args, list) or len(args) != ARITY[op]:
        return [(path, f"{op} takes {ARITY[op]} value{'' if ARITY[op] == 1 else 's'}")]
    problems: list[tuple[str, str]] = []
    for i, arg in enumerate(args):
        problems += _check_expr(arg, f"{path}.args.{i}", ctx)
    return problems


def _check_ref(ref: object, path: str, ctx: _Ctx) -> list[tuple[str, str]]:
    """A reference must name a declared value, and item only inside a repeat."""
    if not isinstance(ref, str):
        return [(path, 'get needs a path like "state.nights"')]
    parts = ref.split(".")
    if len(parts) != 2 or not all(parts) or parts[0] not in NAMESPACES or not NAME.fullmatch(parts[1]) \
            or parts[1] in PROTOTYPE:
        return [(path, f'can\'t read "{safe_text(ref, 40)}"; paths are data.x, state.x, computed.x or item.x')]
    namespace, name = parts
    if namespace == "item":
        if not ctx.item_ok:
            return [(path, f'"{ref}" reads item, which only a repeat has')]
        if ctx.item_keys is not None and name not in ctx.item_keys:
            return [(path, f'unknown reference "{ref}"')]
        return []
    known = {"data": ctx.data_names, "state": ctx.state_names, "computed": ctx.computed_names}[namespace]
    if name not in known:
        return [(path, f'unknown reference "{ref}"')]
    return []


def _is_constant(expr: object, defs: dict, seen: frozenset = frozenset()) -> bool:
    """Whether an expression reads nothing that changes: literals, and computed values built only from them."""
    if not isinstance(expr, dict):
        return True
    if "get" in expr:
        ref = expr.get("get")
        if not isinstance(ref, str) or not ref.startswith("computed."):
            return False
        name = ref.partition(".")[2]
        if name in seen or name not in defs:
            return False
        return _is_constant(defs[name], defs, seen | {name})
    args = expr.get("args")
    return isinstance(args, list) and all(_is_constant(arg, defs, seen) for arg in args)


def _eval_problem(expr: object, path: str, ctx: _Ctx) -> list[tuple[str, str]]:
    """The diagnostic a constant expression already shows, so the model sees it before the card does."""
    if not _is_constant(expr, ctx.computed):
        return []
    _value, error = evaluate(expr, {})
    return [(path, error)] if error else []


# --- checking ----------------------------------------------------------------------------------------------------


def check_widget(block: dict, path: str) -> list[tuple[str, str]]:
    """A widget's problems: version, identity, data, declarations, the computed graph, then the authored view.

    version 2 → [(path, "version must be 1")]
    a view element without an id → [(path + ".view.0", 'element needs an id like "heading"')]
    """
    problems: list[tuple[str, str]] = []
    problems += _check_head(block, path)
    data, data_problems = _check_data(block.get("data"), f"{path}.data")
    problems += data_problems
    state = _check_state(block.get("state"), f"{path}.state", problems)
    computed = _check_computed(block.get("computed"), f"{path}.computed", data, state, problems)
    _check_view(block.get("view"), f"{path}.view", data, state, computed, problems)
    return problems


def _check_head(block: dict, path: str) -> list[tuple[str, str]]:
    problems = []
    version = block.get("version")
    if not (type(version) is int and version == 1):  # noqa: E721 — isinstance counts True as an int, and only 1 passes
        problems.append((path, "version must be 1"))
    widget_id = block.get("id")
    if not isinstance(widget_id, str) or not NAME.fullmatch(widget_id):
        problems.append((path, 'widget needs an id like "trip-budget" (a letter, then letters, digits, - or _)'))
    title = block.get("title")
    if not (isinstance(title, str) and title.strip()):
        problems.append((path, "widget needs a title"))
    return problems


def _check_data(data: object, path: str) -> tuple[dict, list[tuple[str, str]]]:
    """The agent's own JSON: plain JSON only, with no way to reach a tool, a file or another board."""
    if data is None:
        return {}, []
    if not isinstance(data, dict):
        return {}, [(path, "data must be an object")]
    problems: list[tuple[str, str]] = []
    _walk_data(data, path, problems)
    return data, problems


def _walk_data(value: object, path: str, problems: list[tuple[str, str]]) -> None:
    if isinstance(value, dict):
        if value.get("type") == "include":
            problems.append((path, "an include block can't sit inside widget data"))
            return
        for key, child in value.items():
            here = f"{path}.{key}"
            if key in FORBIDDEN_DATA_KEYS:
                problems.append((here, f'"{key}" is not allowed in widget data'))
            else:
                _walk_data(child, here, problems)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            _walk_data(child, f"{path}.{i}", problems)
    elif isinstance(value, str | bool) or value is None:
        return
    elif is_number(value):
        if not _finite(value):
            problems.append((path, "data must be JSON: numbers stay finite"))
    else:
        problems.append((path, "data must be JSON: objects, arrays, strings, numbers, true/false or null"))


def _check_state(state: object, path: str, problems: list[tuple[str, str]]) -> dict:
    """The declarations, each with its own type and bounds; returns the ones that read as declarations."""
    if state is None:
        return {}
    if not isinstance(state, dict):
        problems.append((path, "state must be an object of declarations"))
        return {}
    if len(state) > MAX_STATE:
        problems.append((path, f"at most {MAX_STATE} state declarations"))
    good: dict = {}
    for name, declaration in state.items():
        here = f"{path}.{name}"
        if not isinstance(name, str) or not NAME.fullmatch(name):
            problems.append((here, "a state name is a letter, then letters, digits, - or _"))
            continue
        if _check_declaration(declaration, here, problems):
            good[name] = declaration
    return good


def _check_declaration(declaration: object, path: str, problems: list[tuple[str, str]]) -> bool:
    """One state declaration; True when the rest of the check can read it."""
    if not isinstance(declaration, dict):
        problems.append((path, "a declaration needs type, label and initial"))
        return False
    kind = declaration.get("type")
    if kind not in STATE_TYPES:
        problems.append((path, "type must be number, string or boolean"))
        return False
    if not (isinstance(declaration.get("label"), str) and declaration["label"].strip()):
        problems.append((path, "a declaration needs a visible label"))
    if "initial" not in declaration:
        problems.append((path, "a declaration needs an initial value"))
        return False
    initial = declaration["initial"]
    if kind == "number":
        return _check_number_declaration(declaration, initial, path, problems)
    if kind == "string":
        return _check_string_declaration(declaration, initial, path, problems)
    if not isinstance(initial, bool):
        problems.append((path, "a boolean starts as true or false"))
        return False
    return True


def _check_number_declaration(declaration: dict, initial: object, path: str,
                              problems: list[tuple[str, str]]) -> bool:
    bounds = [declaration.get("min"), declaration.get("max"), declaration.get("step")]
    if not all(_finite(bound) for bound in bounds):
        problems.append((path, "a number needs finite min, max and step"))
        bounded = False
    else:
        low, high, step = bounds
        bounded = True
        if low > high:
            problems.append((path, "min must not be more than max"))
            bounded = False
        if step <= 0:
            problems.append((path, "step must be a positive number"))
    if not is_number(initial):
        problems.append((path, "initial must be a number"))
        return False
    if bounded and not low <= initial <= high:
        problems.append((path, "initial must sit between min and max"))
    return True


def _check_string_declaration(declaration: dict, initial: object, path: str,
                              problems: list[tuple[str, str]]) -> bool:
    limit = declaration.get("maxLength")
    bounded = _finite(limit) and limit > 0
    if not bounded:
        problems.append((path, "a string needs a finite maxLength"))
    if not isinstance(initial, str):
        problems.append((path, "initial must be text"))
        return False
    if bounded and len(initial) > limit:
        problems.append((path, "initial is longer than maxLength"))
    options = declaration.get("options")
    if options is None:
        return True
    if not isinstance(options, list) or not 1 <= len(options) <= MAX_OPTIONS or \
            not all(isinstance(option, str) for option in options):
        problems.append((path, f"options must be 1-{MAX_OPTIONS} text values"))
        return True
    if len(set(options)) != len(options):
        problems.append((path, "options must be distinct"))
    if bounded and any(len(option) > limit for option in options):
        problems.append((path, "an option is longer than maxLength"))
    if initial not in options:
        problems.append((path, "initial must be one of the options"))
    return True


def _check_computed(computed: object, path: str, data: dict, state: dict,
                    problems: list[tuple[str, str]]) -> dict:
    """The computed graph: one expression per name, declared names in scope, no cycles, no shadowing a state or data
    name, and a constant expression's diagnostic (`divided by zero`, `non-finite result`) named here."""
    if computed is None:
        return {}
    if not isinstance(computed, dict):
        problems.append((path, "computed must be an object of expressions"))
        return {}
    if len(computed) > MAX_COMPUTED:
        problems.append((path, f"at most {MAX_COMPUTED} computed values"))
    good: dict = {}
    for name, expr in computed.items():
        here = f"{path}.{name}"
        if not isinstance(name, str) or not NAME.fullmatch(name):
            problems.append((here, "a computed name is a letter, then letters, digits, - or _"))
            continue
        if name in state or name in data:
            problems.append((here, "a computed name can't repeat a state or data name"))
        good[name] = expr
    ctx = _Ctx(data, state, good)
    for name, expr in good.items():
        problems += _check_expr(expr, f"{path}.{name}", ctx)
    problems += _cycles(good, path)
    broken = {where for where, _ in problems}
    for name, expr in good.items():
        if f"{path}.{name}" not in broken:
            problems += _eval_problem(expr, f"{path}.{name}", ctx)
    return good


def _cycles(defs: dict, path: str) -> list[tuple[str, str]]:
    """Each name that sits on a cycle, named once.

    {"a": {"get": "computed.b"}, "b": {"get": "computed.a"}} → both are named
    """
    problems: list[tuple[str, str]] = []

    def walk(name: str, trail: tuple[str, ...]) -> None:
        if name in trail:
            problems.append((f"{path}.{name}", "circular dependency"))
            return
        expr = defs.get(name)
        if not isinstance(expr, dict) or "get" not in expr:
            return
        ref = expr.get("get")
        if isinstance(ref, str) and ref.startswith("computed."):
            walk(ref.partition(".")[2], (*trail, name))

    for name in defs:
        walk(name, ())
    seen: set[str] = set()
    unique = []
    for where, why in problems:
        if where not in seen:
            seen.add(where)
            unique.append((where, why))
    return unique


def _check_view(view: object, path: str, data: dict, state: dict, computed: dict,
                problems: list[tuple[str, str]]) -> None:
    if not isinstance(view, list):
        problems.append((path, "view must be a list of elements"))
        return
    if not view:
        problems.append((path, "view needs at least one element"))
        return
    nodes = _count_nodes(view)
    if nodes > MAX_NODES:
        problems.append((path, f"at most {MAX_NODES} element nodes (this view has {nodes})"))
        return
    _check_elements(view, path, 1, _Ctx(data, state, computed), set(), problems)


def _count_nodes(elements: list) -> int:
    """Every authored element, the ones inside when and repeat branches too."""
    total = 0
    for element in elements:
        if not isinstance(element, dict):
            total += 1
            continue
        total += 1
        for key in ("children", "then", "else", "template", "empty"):
            children = element.get(key)
            if isinstance(children, list):
                total += _count_nodes(children)
    return total


def _check_elements(elements: list, path: str, depth: int, ctx: _Ctx, seen: set[str],
                    problems: list[tuple[str, str]]) -> None:
    for i, element in enumerate(elements):
        _check_element(element, f"{path}.{i}", depth, ctx, seen, problems)


def _check_element(element: object, path: str, depth: int, ctx: _Ctx, seen: set[str],
                   problems: list[tuple[str, str]]) -> None:
    if depth > MAX_DEPTH:
        problems.append((path, f"nested too deep (max {MAX_DEPTH})"))
        return
    if not isinstance(element, dict):
        problems.append((path, "an element is an object with kind and id"))
        return
    kind = element.get("kind")
    if kind not in ELEMENT_KINDS:
        problems.append((path, f'unknown element kind "{kind}"' if isinstance(kind, str)
                         else "an element needs a kind"))
        return
    if not _check_element_id(element.get("id"), path, seen, problems):
        return
    _ELEMENT_CHECKS[kind](element, path, depth, ctx, seen, problems)


def _check_element_id(element_id: object, path: str, seen: set[str], problems: list[tuple[str, str]]) -> bool:
    if not isinstance(element_id, str) or not element_id:
        problems.append((path, 'element needs an id like "heading"'))
        return False
    if not NAME.fullmatch(element_id):
        problems.append((path, "an element id is a letter, then letters, digits, - or _ (up to 64)"))
        return False
    if element_id in seen:
        problems.append((path, f'duplicate element id "{element_id}"'))
        return False
    seen.add(element_id)
    return True


def _check_tone(element: dict, path: str, problems: list[tuple[str, str]]) -> None:
    if "tone" in element and element["tone"] not in TONES:
        problems.append((path, f"tone must be {', '.join(TONES)}"))


def _element_layout(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                    problems: list[tuple[str, str]]) -> None:
    kind = element["kind"]
    children = element.get("children")
    if not isinstance(children, list) or not children:
        problems.append((path, f"{kind} needs children"))
        return
    if "gap" in element and element["gap"] not in GAPS:
        problems.append((path, f"gap must be {', '.join(GAPS)}"))
    if "columns" in element:
        columns = element["columns"]
        if kind != "grid":
            problems.append((path, "columns is for a grid"))
        elif not (type(columns) is int and 1 <= columns <= 4):
            problems.append((path, "columns is a whole number from 1 to 4"))
    _check_elements(children, f"{path}.children", depth + 1, ctx, seen, problems)


def _element_text(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                  problems: list[tuple[str, str]]) -> None:
    del depth, seen
    written = isinstance(element.get("text"), str) and element["text"].strip() != ""
    if written and "expr" in element:
        problems.append((path, "text takes text or expr, not both"))
        return
    if written:
        _check_tone(element, path, problems)
    elif "expr" in element:
        problems += _check_expr(element["expr"], f"{path}.expr", ctx)
        problems += _eval_problem(element["expr"], f"{path}.expr", ctx)
        _check_tone(element, path, problems)
    else:
        problems.append((path, "text needs text or an expr"))


def _element_number(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                    problems: list[tuple[str, str]]) -> None:
    del depth, seen
    if not (isinstance(element.get("label"), str) and element["label"].strip()):
        problems.append((path, "number needs a visible label"))
    if "expr" not in element:
        problems.append((path, "number needs an expr"))
    else:
        problems += _check_expr(element["expr"], f"{path}.expr", ctx)
        problems += _eval_problem(element["expr"], f"{path}.expr", ctx)
    _check_tone(element, path, problems)


def _element_badge(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                   problems: list[tuple[str, str]]) -> None:
    del depth, seen
    written = isinstance(element.get("text"), str) and element["text"].strip() != ""
    if written and "expr" in element:
        problems.append((path, "badge takes text or expr, not both"))
        return
    if written:
        _check_tone(element, path, problems)
    elif "expr" in element:
        problems += _check_expr(element["expr"], f"{path}.expr", ctx)
        problems += _eval_problem(element["expr"], f"{path}.expr", ctx)
        _check_tone(element, path, problems)
    else:
        problems.append((path, "badge needs text or an expr"))


def _element_divider(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                     problems: list[tuple[str, str]]) -> None:
    del element, path, depth, ctx, seen, problems


def _element_image(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                   problems: list[tuple[str, str]]) -> None:
    del depth, seen
    _check_literal_url(element.get("url"), f"{path}.url", "image", ctx, problems)
    if not (isinstance(element.get("alt"), str) and element["alt"].strip()):
        problems.append((path, "image needs alt text"))


def _element_link(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                  problems: list[tuple[str, str]]) -> None:
    del depth, seen
    if not (isinstance(element.get("text"), str) and element["text"].strip()):
        problems.append((path, "link needs text"))
    _check_literal_url(element.get("url"), f"{path}.url", "link", ctx, problems)


def _check_literal_url(url: object, path: str, what: str, ctx: _Ctx, problems: list[tuple[str, str]]) -> None:
    """A URL is written out, never computed: an expression there would move where a link points."""
    if isinstance(url, dict):
        problems += _check_expr(url, path, ctx)
        problems.append((path, "a url is literal, never an expression"))
        return
    if not is_https(url):
        problems.append((path, f"{what} needs an https url"))


def _element_input(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                   problems: list[tuple[str, str]]) -> None:
    del depth, seen
    control = element.get("control")
    if control not in CONTROLS:
        problems.append((path, f"control must be {', '.join(CONTROLS)}"))
        return
    if not (isinstance(element.get("label"), str) and element["label"].strip()):
        problems.append((path, "input needs a visible label"))
    name = _state_target(element.get("state"))
    if name is None or name not in ctx.state:
        problems.append((path, f'state "{safe_text(element.get("state"), 40)}" isn\'t declared'))
        return
    declaration = ctx.state[name]
    wanted = CONTROL_STATE[control]
    if isinstance(declaration, dict) and declaration.get("type") != wanted:
        problems.append((path, f"a {control} input needs a {wanted} state"))
    if control == "select" and isinstance(declaration, dict) and declaration.get("type") == "string" \
            and not declaration.get("options"):
        problems.append((path, "select needs options on the state declaration"))
    options = element.get("options")
    if options is None:
        return
    if control != "select":
        problems.append((path, "options is for a select"))
    elif not (isinstance(options, list) and all(isinstance(option, str) for option in options)):
        problems.append((path, "options must be a list of text"))
    elif isinstance(declaration, dict) and declaration.get("options") and \
            [option for option in options if option not in declaration["options"]]:
        problems.append((path, "options must be the ones the state declares"))


def _state_target(value: object) -> str | None:
    """The state name a control or a set names, written "nights" or "state.nights"."""
    if not isinstance(value, str) or not value:
        return None
    if value.startswith("state."):
        return value.partition(".")[2]
    if value.split(".", 1)[0] in ("data", "computed", "item"):
        return None
    return value


def _element_button(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                    problems: list[tuple[str, str]]) -> None:
    del depth, seen
    if not (isinstance(element.get("label"), str) and element["label"].strip()):
        problems.append((path, "button needs a label"))
    action = element.get("action")
    if not isinstance(action, dict):
        problems.append((path, "button needs an action: set, reset or fill"))
        return
    op = action.get("op")
    if op == "reset":
        return
    if op == "set":
        _check_set(action, path, ctx, problems)
    elif op == "fill":
        _check_fill(action, path, ctx, problems)
    else:
        problems.append((path, "action op must be set, reset or fill"))


def _check_set(action: dict, path: str, ctx: _Ctx, problems: list[tuple[str, str]]) -> None:
    target = action.get("state")
    if isinstance(target, str) and target.split(".", 1)[0] in ("data", "computed", "item"):
        problems.append((path, "set can only change state; data and computed are read-only"))
        return
    name = _state_target(target)
    if name is None or name not in ctx.state:
        problems.append((path, 'set needs state, like "state.nights"'))
        return
    if "value" not in action:
        problems.append((path, "set needs a value"))
        return
    problems += _check_expr(action["value"], f"{path}.value", ctx)
    problems += _eval_problem(action["value"], f"{path}.value", ctx)


def _check_fill(action: dict, path: str, ctx: _Ctx, problems: list[tuple[str, str]]) -> None:
    message = action.get("message")
    if not (isinstance(message, str) and message.strip()):
        problems.append((path, "fill needs a message"))
    elif acts_before_the_model(message):
        problems.append((path, NO_SEND))
    fields = action.get("fields")
    if not isinstance(fields, list) or not fields or len(fields) > MAX_FILL_FIELDS:
        problems.append((path, f"fill lists 1-{MAX_FILL_FIELDS} state names"))
        return
    for field in fields:
        if not isinstance(field, str) or _state_target(field) not in ctx.state:
            problems.append((path, f'fill fields are declared state names; "{safe_text(field, 40)}" isn\'t one'))


def _element_when(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                  problems: list[tuple[str, str]]) -> None:
    if "test" not in element:
        problems.append((path, "when needs a test"))
    else:
        problems += _check_expr(element["test"], f"{path}.test", ctx)
        problems += _eval_problem(element["test"], f"{path}.test", ctx)
    then = element.get("then")
    if not isinstance(then, list):
        problems.append((path, "when needs then (use [] for nothing)"))
    else:
        _check_elements(then, f"{path}.then", depth + 1, ctx, seen, problems)
    otherwise = element.get("else")
    if otherwise is None:
        return
    if not isinstance(otherwise, list):
        problems.append((path, "else is a list of elements (or leave it out for nothing)"))
        return
    _check_elements(otherwise, f"{path}.else", depth + 1, ctx, seen, problems)


def _element_repeat(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                    problems: list[tuple[str, str]]) -> None:
    if ctx.item_ok:
        problems.append((path, "a repeat can't sit inside a repeat"))
        return
    name = _items_path(element.get("items"))
    if name is None:
        problems.append((path, 'repeat items must be a data array, like {"get": "data.issues"}'))
    elif name not in ctx.data_names:
        problems.append((path, f'unknown reference "data.{name}"'))
    key = element.get("key")
    if not isinstance(key, str) or not key or "." in key or key in PROTOTYPE:
        problems.append((path, "repeat needs a key: the item property that stays stable"))
        key = None
    template = element.get("template")
    if not isinstance(template, list) or not template:
        problems.append((path, "repeat needs a template of elements"))
        template = []
    empty = element.get("empty")
    if empty is not None and not isinstance(empty, list):
        problems.append((path, "empty is a list of elements ([] for nothing)"))
        empty = None
    item_ctx = ctx
    if name is not None and key is not None:
        item_ctx = _check_items(path, name, key, ctx, problems)
    else:  # the template still reads item, so it is checked with an item of unknown fields
        item_ctx = ctx.with_item(None)
    _check_elements(template, f"{path}.template", depth + 1, item_ctx, seen, problems)
    if empty:
        _check_elements(empty, f"{path}.empty", depth + 1, item_ctx, seen, problems)


def _items_path(value: object) -> str | None:
    """The data name a repeat walks: {"get": "data.issues"} or "data.issues" → "issues"."""
    ref = value.get("get") if isinstance(value, dict) else value
    if not isinstance(ref, str) or not ref.startswith("data."):
        return None
    name = ref.partition(".")[2]
    return name if NAME.fullmatch(name) else None


def _check_items(path: str, name: str, key: str, ctx: _Ctx, problems: list[tuple[str, str]]) -> _Ctx:
    """The data array itself: at most 100 objects, each with its own key; returns the item scope."""
    rows = ctx.data.get(name)
    if not isinstance(rows, list):
        return ctx.with_item(None)
    if len(rows) > MAX_ITEMS:
        problems.append((path, f"a repeat holds at most {MAX_ITEMS} items"))
    keys: set = set()
    for row in rows[:MAX_ITEMS]:
        if not isinstance(row, dict):
            problems.append((path, f"repeat items are objects with a {key}"))
            return ctx.with_item(None)
        value = row.get(key)
        if not isinstance(value, str | int | float | bool):
            problems.append((path, f'every repeat item needs a stable "{key}"'))
            return ctx.with_item(None)
        if value in keys:
            problems.append((path, f'repeat keys must be unique; "{safe_text(value, 40)}" repeats'))
            return ctx.with_item(None)
        keys.add(value)
    item_keys: set[str] = set()
    for row in rows[:MAX_ITEMS]:
        item_keys |= {field for field in row if isinstance(field, str)}
    return ctx.with_item(item_keys or None)


def _element_block(element: dict, path: str, depth: int, ctx: _Ctx, seen: set[str],
                   problems: list[tuple[str, str]]) -> None:
    del depth, seen
    spec = element.get("spec")
    if not isinstance(spec, dict):
        problems.append((path, "block needs a spec: the block to embed"))
        return
    kind = spec.get("type")
    if kind not in EMBEDDED:
        problems.append((f"{path}.spec", f"an embedded block can be {', '.join(EMBEDDED)}"))
        return
    bindings = element.get("bindings")
    binding_problems = _check_bindings(bindings, kind, spec, f"{path}.bindings", ctx)
    problems += binding_problems
    resolved = _apply_bindings(bindings, spec, kind, ctx) if isinstance(bindings, dict) and not binding_problems \
        else _deep_copy(spec)
    problems += EMBEDDED[kind][0](resolved, f"{path}.spec")


def _check_bindings(bindings: object, kind: str, spec: dict, path: str,
                    ctx: _Ctx) -> list[tuple[str, str]]:
    """Each binding path must be one of the places the contract allows, and hold the right value type."""
    if bindings is None:
        return []
    if not isinstance(bindings, dict):
        return [(path, "bindings must be an object of paths to expressions")]
    if kind == "source":
        return [(path, "a source block takes no bindings")]
    problems: list[tuple[str, str]] = []
    for pointer, expr in bindings.items():
        tokens = _pointer(pointer)
        here = f'{path}."{pointer}"'
        if tokens is None or not _allowed_pointer(kind, tokens):
            problems.append((here, f"a {kind} block can bind {_BINDABLE[kind]} only"))
            continue
        if not _has_path(spec, tokens):
            problems.append((here, "no such place in the spec"))
            continue
        problems += _check_expr(expr, here, ctx)
        problems += _eval_problem(expr, here, ctx)
        value, error = _binding_value(expr, ctx)
        if not error and value is not _UNRESOLVED and not _binding_fits(kind, value):
            problems.append((here, f"needs {_binding_kind(kind)}"))
    return problems


def _has_path(spec: object, tokens: list[str]) -> bool:
    """Whether the written spec has room for this value already.

    a chart's /series/0/data/2 → True;  /series/0/data/9 on a three-point series → False
    """
    node = spec
    for token in tokens:
        if isinstance(node, dict) and token in node:
            node = node[token]
        elif isinstance(node, list) and token.isdigit() and int(token) < len(node):
            node = node[int(token)]
        else:
            return False
    return True


def _pointer(pointer: object) -> list[str] | None:
    if not isinstance(pointer, str) or not pointer.startswith("/") or pointer == "/":
        return None
    tokens = pointer[1:].split("/")
    return tokens if all(tokens) else None


def _allowed_pointer(kind: str, tokens: list[str]) -> bool:
    if kind == "stat":
        return tokens == ["value"]
    if kind == "bar":
        return tokens in (["value"], ["max"])
    if kind == "chart":
        return len(tokens) == 4 and tokens[0] == "series" and tokens[1].isdigit() and tokens[2] == "data" \
            and tokens[3].isdigit()
    if kind == "table":
        return len(tokens) == 3 and tokens[0] == "rows" and tokens[1].isdigit() and bool(tokens[2])
    return False


def _binding_value(expr: object, ctx: _Ctx) -> tuple[object, str | None]:
    """The bound value, or _UNRESOLVED when it reads an item (only a repeat knows it)."""
    if _reads_item(expr):
        return _UNRESOLVED, None
    return evaluate(expr, {"data": ctx.data, "state": _initials(ctx.state),
                           "computed": _resolved(ctx)})


def _resolved(ctx: _Ctx) -> dict:
    """The computed graph at the initial state, so a binding can read a computed value before the card exists."""
    memo: dict[str, tuple[object, str | None]] = {}
    busy: set[str] = set()

    def resolve(name: str) -> tuple[object, str | None]:
        if name in memo:
            return memo[name]
        expr = ctx.computed.get(name)
        if expr is None or name in busy:
            return None, None
        busy.add(name)
        value, error = _eval(expr, {"data": ctx.data, "state": _initials(ctx.state)}, resolve)
        busy.discard(name)
        memo[name] = (value, error)
        return value, error

    return {name: resolve(name)[0] for name in ctx.computed}


def _reads_item(expr: object) -> bool:
    if isinstance(expr, dict):
        if "get" in expr:
            return isinstance(expr["get"], str) and expr["get"].startswith("item.")
        args = expr.get("args")
        return isinstance(args, list) and any(_reads_item(arg) for arg in args)
    return False


def _binding_fits(kind: str, value: object) -> bool:
    if value is None:
        return True
    if kind in ("stat", "bar", "chart"):
        return is_number(value)
    return not isinstance(value, dict | list)


def _binding_kind(kind: str) -> str:
    return "a number" if kind in ("stat", "bar", "chart") else "a cell: text, a number, true/false or null"


def _apply_bindings(bindings: object, spec: dict, kind: str, ctx: _Ctx) -> dict:
    """The spec with each binding's value written at its path; a value only a repeat knows keeps the written one."""
    out = _deep_copy(spec)
    if not isinstance(bindings, dict):
        return out
    for pointer, expr in bindings.items():
        tokens = _pointer(pointer)
        if tokens is None or not _allowed_pointer(kind, tokens):
            continue
        value, error = _binding_value(expr, ctx)
        if error or value is _UNRESOLVED:
            continue
        _set_path(out, tokens, value)
    return out


def _set_path(target: object, tokens: list[str], value: object) -> None:
    node = target
    for token in tokens[:-1]:
        if isinstance(node, dict) and token in node:
            node = node[token]
        elif isinstance(node, list) and token.isdigit() and int(token) < len(node):
            node = node[int(token)]
        else:
            return
    last = tokens[-1]
    if isinstance(node, dict):
        node[last] = value
    elif isinstance(node, list) and last.isdigit() and int(last) < len(node):
        node[int(last)] = value


def _deep_copy(value: object) -> object:
    if isinstance(value, dict):
        return {key: _deep_copy(child) for key, child in value.items()}
    if isinstance(value, list):
        return [_deep_copy(child) for child in value]
    return value


def _initials(state: dict) -> dict:
    return {name: declaration["initial"] for name, declaration in state.items()
            if isinstance(declaration, dict) and "initial" in declaration}


# --- plain text --------------------------------------------------------------------------------------------------


class _Reader:
    """A widget at its initial state: the values it starts with, and the computed graph resolved once and cached."""

    def __init__(self, data: dict, state: dict, computed: dict):
        self.data = data
        self.declarations = state
        self.state = _initials(state)
        self.defs = computed
        self.memo: dict[str, tuple[object, str | None]] = {}
        self.busy: set[str] = set()
        self.next_labels: list[str] = []

    def scope(self, item: dict | None = None) -> dict:
        return {"data": self.data, "state": self.state, "item": item}

    def computed(self, name: str) -> tuple[object, str | None]:
        if name in self.memo:
            return self.memo[name]
        if name in self.busy or name not in self.defs:
            return None, None
        self.busy.add(name)
        value, error = _eval(self.defs[name], self.scope(), self.computed)
        self.busy.discard(name)
        self.memo[name] = (value, error)
        return value, error

    def value(self, expr: object, item: dict | None = None) -> object:
        value, _error = _eval(expr, self.scope(item), self.computed)
        return value


def text_widget(block: dict) -> str:
    """A widget at its initial state, as Markdown: content in view order, the selected branch, repeats in order,
    embedded blocks through their own text, unknown as "unknown", and the buttons as one Next line.

    Every line is one piece, so a widget reads the same way inside a board as it does alone.
    Never raises: a widget it can't read gives "".
    """
    try:
        return _text_widget(block)
    except Exception:  # a malformed widget is skipped: the reply must still go out
        return ""


def _text_widget(block: object) -> str:
    if not isinstance(block, dict) or not isinstance(block.get("view"), list):
        return ""
    data = block.get("data") if isinstance(block.get("data"), dict) else {}
    state = block.get("state") if isinstance(block.get("state"), dict) else {}
    computed = block.get("computed") if isinstance(block.get("computed"), dict) else {}
    reader = _Reader(data, {name: declaration for name, declaration in state.items()
                            if isinstance(name, str) and isinstance(declaration, dict)},
                     {name: expr for name, expr in computed.items() if isinstance(name, str)})
    pieces = _read_list(block["view"], reader, None, 1)
    if reader.next_labels:
        labels = list(dict.fromkeys(reader.next_labels))
        pieces.append("Next: " + " · ".join(labels))
    body = "\n".join(piece for piece in pieces if piece)
    limit, note = _limit()
    if len(body) > limit:
        room = limit - len(note) - 1
        kept: list[str] = []
        size = 0
        for line in body.split("\n"):
            if size + len(line) + 1 > room:
                break
            kept.append(line)
            size += len(line) + 1
        body = "\n".join([*kept, note])
    return body


def _limit() -> tuple[int, str]:
    from ..hooks.text_fallback import LIMIT, MORE_NOTE  # the board's own cap, imported late to avoid a cycle
    return LIMIT, MORE_NOTE


def _read_list(elements: object, reader: _Reader, item: dict | None, depth: int) -> list[str]:
    if not isinstance(elements, list) or depth > MAX_DEPTH:
        return []
    out: list[str] = []
    for element in elements:
        out += _read_element(element, reader, item, depth)
    return out


def _read_element(element: object, reader: _Reader, item: dict | None, depth: int) -> list[str]:
    if not isinstance(element, dict):
        return []
    kind = element.get("kind")
    if kind in LAYOUT_KINDS:
        children = _read_list(element.get("children"), reader, item, depth + 1)
        if kind in HORIZONTAL:
            joined = " · ".join(child for child in children if child)
            return [joined] if joined else []
        return children
    if kind == "text":
        text = _text_value(element, reader, item)
        return [text] if text else []
    if kind == "number":
        return [_number_line(element, reader, item)]
    if kind == "badge":
        value = _text_value(element, reader, item)
        return [f"[{value}]"] if value else []
    if kind == "divider":
        return ["---"]
    if kind == "image":
        return [_image_line(element)]
    if kind == "link":
        return [_link_line(element)]
    if kind == "input":
        return [_input_line(element, reader)]
    if kind == "button":
        label = safe_text(element.get("label"))
        if label and item is None:  # a button inside a repeat has nothing to press in a chat message
            reader.next_labels.append(label)
        return []
    if kind == "when":
        branch = "then" if reader.value(element.get("test"), item) is True else "else"
        return _read_list(element.get(branch), reader, item, depth + 1)
    if kind == "repeat":
        return _repeat_lines(element, reader, item, depth)
    if kind == "block":
        return _block_line(element, reader, item)
    return []


def _text_value(element: dict, reader: _Reader, item: dict | None) -> str:
    if isinstance(element.get("text"), str):
        return safe_text(element["text"], inline=False)
    if "expr" in element:
        return _show(reader.value(element["expr"], item))
    return ""


def _number_line(element: dict, reader: _Reader, item: dict | None) -> str:
    label = safe_text(element.get("label"))
    value = reader.value(element.get("expr"), item) if "expr" in element else None
    shown = "unknown" if value is None else with_unit(_show(value), safe_text(element.get("unit"), 20))
    return f"{label}: {shown}" if label else shown


def _image_line(element: dict) -> str:
    url = safe_url(element.get("url"), https_only=True)
    alt = safe_text(element.get("alt"))
    if not url:
        return alt
    return f"![{alt or 'image'}]({url})"


def _link_line(element: dict) -> str:
    text = safe_text(element.get("text"))
    url = safe_url(element.get("url"), https_only=True)
    return md_link(text or url, url)


def _input_line(element: dict, reader: _Reader) -> str:
    """A control, its starting value, and how far it moves in the interactive view."""
    label = safe_text(element.get("label"))
    return f"{label}: {_control_value(element, reader)} ({_control_hint(element, reader)})"


def _control_value(element: dict, reader: _Reader) -> str:
    name = _state_target(element.get("state"))
    return _show(reader.state.get(name)) if name in reader.state else "unknown"


def _control_hint(element: dict, reader: _Reader) -> str:
    """A number or slider says its range; a select says its options; the rest only say they can be changed.

    an input for nights (min 1, max 10) → "adjustable from 1 to 10 in the interactive view"
    """
    name = _state_target(element.get("state"))
    declaration = reader.declarations.get(name) if name else None
    if not isinstance(declaration, dict):
        return "adjustable in the interactive view"
    if declaration.get("type") == "number" and element.get("control") in ("number", "slider") \
            and _finite(declaration.get("min")) and _finite(declaration.get("max")):
        return (f"adjustable from {fmt_num(declaration['min'])} to {fmt_num(declaration['max'])} "
                "in the interactive view")
    options = declaration.get("options") if declaration.get("type") == "string" else None
    if element.get("control") == "select" and isinstance(options, list) and options:
        named = ", ".join(option for option in options if isinstance(option, str))
        return f"adjustable in the interactive view: {named}"
    return "adjustable in the interactive view"


def _repeat_lines(element: dict, reader: _Reader, item: dict | None, depth: int) -> list[str]:
    rows = reader.value(element.get("items"), item)
    if not isinstance(rows, list) or not rows:
        return _read_list(element.get("empty"), reader, item, depth + 1)
    out: list[str] = []
    for row in rows[:MAX_ITEMS]:
        if not isinstance(row, dict):
            continue
        lines = _read_list(element.get("template"), reader, row, depth + 1)
        joined = "\n".join(line for line in lines if line)
        if joined:
            out.append(joined)
    return out


def _block_line(element: dict, reader: _Reader, item: dict | None) -> list[str]:
    spec = element.get("spec")
    if not isinstance(spec, dict) or spec.get("type") not in EMBEDDED:
        return []
    kind = spec["type"]
    resolved = _deep_copy(spec)
    bindings = element.get("bindings")
    if isinstance(bindings, dict):
        for pointer, expr in bindings.items():
            tokens = _pointer(pointer)
            if tokens is None or not _allowed_pointer(kind, tokens):
                continue
            value = reader.value(expr, item)
            if value is not None:
                _set_path(resolved, tokens, value)
    text = EMBEDDED[kind][1](resolved)
    return [text] if text else []


def _show(value: object) -> str:
    """A value as people read it; an unknown one says so rather than printing nothing."""
    if value is None:
        return "unknown"
    if isinstance(value, bool):
        return "true" if value else "false"
    if is_number(value):
        return fmt_num(value)
    return safe_text(value)


_ELEMENT_CHECKS = {
    "stack": _element_layout, "row": _element_layout, "grid": _element_layout, "surface": _element_layout,
    "text": _element_text, "number": _element_number, "badge": _element_badge, "divider": _element_divider,
    "image": _element_image, "link": _element_link, "input": _element_input, "button": _element_button,
    "when": _element_when, "repeat": _element_repeat, "block": _element_block,
}
