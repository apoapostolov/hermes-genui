"""heatmap: row labels by column labels, each cell a number coloured by its size."""

from .common import is_number, md_table, safe_text, table_cell


def check_heatmap(block: dict, path: str) -> list[tuple[str, str]]:
    """Row labels, column labels and, for each row, a value per column; at least one number in all.

    rows = ["JPM", "GS"], cols = ["Q1", "Q2"], values = [[4.1, -1.2], [7.5]]
    → [("0.values.1", 'row "GS" has 1 values, the heatmap has 2 columns')]
    """
    rows, cols, values = block.get("rows"), block.get("cols"), block.get("values")
    if not all(isinstance(side, list) and side for side in (rows, cols, values)):
        return [(path, "heatmap needs rows, cols and values")]
    problems = []
    numbers = 0
    for i, label in enumerate(rows):
        cells = values[i] if i < len(values) else None
        if not isinstance(cells, list) or len(cells) < len(cols):
            have = len(cells) if isinstance(cells, list) else 0
            why = f'row "{label}" has {have} values, the heatmap has {len(cols)} columns'
            problems.append((f"{path}.values.{i}", why))
            continue
        numbers += sum(1 for v in cells[: len(cols)] if is_number(v))
    if problems:
        return problems
    if not numbers:
        return [(path, "heatmap needs at least one number")]
    return []


def _cell(value: object) -> str:
    """One heatmap cell: a number as written, and anything else a dash. The web reader keeps a number per cell and a
    blank where there isn't one (num(cells[j]) → null), so a null and a word are both an unknown here.

    4.1 → "4.1";  None → "–";  "n/a" → "–"
    """
    return table_cell(value) if is_number(value) else "–"


def text_heatmap(block: dict) -> str:
    """The title (and unit), then rows by columns as a small Markdown table of the values; a cell the model wrote as
    null reads "–", an unknown that isn't a measured zero."""
    rows, cols, values = block.get("rows"), block.get("cols"), block.get("values")
    if not all(isinstance(side, list) and side for side in (rows, cols, values)):
        return ""
    cols = cols[:12]
    body = []
    for i, label in enumerate(rows[:12]):
        line = values[i] if i < len(values) and isinstance(values[i], list) else []
        body.append([table_cell(label)] + [_cell(v) for v in line[: len(cols)]])
    title, unit = safe_text(block.get("title")), safe_text(block.get("unit"), 20)
    head = (f"**{title or 'Heatmap'}**" + (f" ({unit})" if unit else "")) if title or unit else ""
    return "\n".join(([head] if head else []) + md_table([""] + [table_cell(c) for c in cols], body))
