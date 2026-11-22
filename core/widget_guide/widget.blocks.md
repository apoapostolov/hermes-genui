Embedded blocks put an existing block inside the widget, with values the person's controls change.

`spec` is a complete block of one allowlisted type: stat, bar, chart, table or source. Write it as you would anywhere
else, and put a placeholder number or cell where the widget will write a value.

`bindings` maps a JSON pointer into that spec to an expression. Only these places can be bound:
- stat: /value
- bar: /value and /max
- chart: /series/<n>/data/<i>, a number or null
- table: /rows/<i>/<column>, a cell of text, a number, true/false or null

Everything else is structural and refused: labels, titles, kinds, chart labels, urls, sources and action strings. A
source block takes no bindings at all, so it is written in full.

A bar whose value is the planned spend, out of the written budget:
{"kind": "block", "id": "spend-bar",
 "spec": {"type": "bar", "label": "Planned spend", "value": 0, "max": 1200},
 "bindings": {"/value": {"get": "computed.planned"}, "/max": {"get": "data.budget"}}}

The pointer must already exist in the spec, so a three-point chart can bind /series/0/data/2 but not /data/9. The spec is
checked after its bindings are resolved, with the same checker the block has on its own: a chart whose labels and data
disagree is refused, and a value of the wrong type is refused as a number or a cell.

include, a nested widget, and the Today page's own blocks are refused inside a widget. The text fallback draws each
embedded block with its own plain-text form, so no information is lost where blocks are not drawn.
