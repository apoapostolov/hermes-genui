Two structure elements decide what is drawn at all: `when` and `repeat`.

when has `test`, `then` and `else`. Both branches are required; write [] for nothing. The test is a boolean or unknown:
anything else is refused as a wrong operand type. Only the selected branch is drawn, which is why one branch can read a
value the other could not.

repeat walks an array written in `data`:
- `items` is {"get": "data.issues"}, a plain data array. A computed value is refused here.
- `key` is the item property that stays stable, usually id. Every item needs its own.
- `template` is the elements drawn once per item.
- `empty` is what to draw when the array is empty; without it, an empty array draws nothing.

The issue triage widget:
{"kind": "repeat", "id": "issues", "items": {"get": "data.issues"}, "key": "id",
 "template": [{"kind": "row", "id": "row", "gap": "sm", "children": [
   {"kind": "text", "id": "title", "expr": {"get": "item.title"}},
   {"kind": "badge", "id": "status", "expr": {"get": "item.status"}, "tone": "info"}]}],
 "empty": [{"kind": "text", "id": "no-issues", "text": "No issues in this list."}]}

Rules: at most 100 items; each item is an object carrying the key; keys are unique. Inside the template only
item.<field> is readable from the row, and item is read-only: to keep a row, a button sets a state value to
{"get": "item.id"} and a `when` compares that state with item.id.

A repeat does not nest, so a row that needs a second list belongs at the top level of the view. The text fallback
draws the template once per item, in order, and draws `empty` when the array is empty.
