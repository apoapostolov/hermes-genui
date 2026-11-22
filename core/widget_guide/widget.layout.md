Layout and content elements: the pieces a widget's `view` is made of.

Layout: `stack`, `row`, `grid` and `surface` hold `children`.
- stack puts its children one under another. Use it for the ordinary case: a heading, its note, then the figures.
- row puts two or three short pieces side by side; keep them short, because a narrow card wraps them.
- grid lays its children out in `columns` (1-4). Only a grid takes `columns`.
- surface draws a raised card around its children, to set one part of the page apart.

Every element needs a stable `id`, unique across the whole authored tree, inside `when`, `repeat` and `empty` too. An
id starts with a letter and then uses letters, digits, - or _ (up to 64 characters).

Limits: at most 200 authored elements, at most 8 levels of nesting, and `gap` is xs, sm, md or lg. A layout element
with no children is refused; an empty branch is written `[]`.

Content elements take `tone`: muted, good, warn, bad, info or plain.
- text: `text` or `expr`, and tone. Use muted for a note under the title.
- number: `expr`, `label`, optional `unit` and tone.
- badge: `text` or `expr`, and tone. Good for a status or a warning.
- divider: a line between groups.
- image: a literal https `url` and `alt`.
- link: `text` and a literal https `url`.

URLs are written out, never computed: an expression in `url` is refused, and only https survives.

A control changes one state declaration and carries a visible `label`: `input` with `control` number, slider, select,
checkbox or text. A number or slider moves between its declaration's min and max.

Text fallback: a widget reads as its content in view order, a row joined by dots, controls as "Label: value
(adjustable … in the interactive view)", and its buttons as one closing Next line.
