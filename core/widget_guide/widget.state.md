State and computed values are written before the view: state is what the person changes on the card, computed is what
the widget works out from it.

Every state declaration has `type` (number, string or boolean), a visible `label` and an `initial`, plus its limits:
- number: finite `min`, `max` and a positive `step`, with min <= initial <= max.
- string: a finite `maxLength`, and `options` when a select picks from a list.
- boolean: initial true or false.
At most 16 declarations. An `input` names one by `state` ("nights" or "state.nights"); a `select` needs a string state
with options, a checkbox a boolean one. A `button` with `{"op": "reset"}` puts every declaration back to its initial.

An expression is a literal, a reference, or an operator:
- references are always qualified: state.nights, data.budget, computed.planned, and item.id inside a repeat. There is
  no indexing and no dynamic name; __proto__, prototype and constructor are refused.
- operators: add, sub, mul, div, eq, lt, lte, and, or, not, if. Arithmetic takes two numbers, and/or two booleans, not
  one boolean, if three values (test, then, else). if reads only the branch it selects.

computed maps a name to one expression: at most 32, no cycles, and a computed name can't repeat a state or data name.
Bindings and text elements read a computed value the same way: {"get": "computed.planned"}.

null means unknown. Any arithmetic or comparison with unknown is unknown, and a `when` test that is unknown takes its
else branch. Nothing is guessed: a division by zero is refused with "divided by zero", a result too large for a float
with "non-finite result", a mistyped operand with "wrong operand type", a name nothing declares with "unknown
reference". None of them becomes 0.

A widget's text fallback evaluates all of this at the initial state.
