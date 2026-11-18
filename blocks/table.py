"""table: columns and rows, sortable on Hermes Desktop."""

from .common import cell_value, md_table, safe_text, table_cell

MAX_TABLE_ROWS = 12


def check_table(block: dict, path: str) -> list[tuple[str, str]]:
    """Columns (up to 8) and rows (up to 30), no row wider than the columns; rows may also be objects keyed by
    column name.

    columns = ["A", "B"], rows[1] = ["1", "2", "3"] → [("0.rows.1", "row has 3 cells, table has 2 columns")]
    """
    columns = block.get("columns")
    rows = block.get("rows")
    if not isinstance(columns, list) or not columns:
        return [(path, "table needs columns")]
    if len(columns) > 8:
        return [(path, "a table holds at most 8 columns")]
    if not isinstance(rows, list) or not rows:
        return [(path, "table needs rows")]
    if len(rows) > 30:
        return [(path, "a table holds at most 30 rows")]
    problems = []
    for i, row in enumerate(rows):
        if isinstance(row, dict):
            continue
        if not isinstance(row, list):
            problems.append((f"{path}.rows.{i}", "row must be a list of cells"))
        elif len(row) > len(columns):
            problems.append((f"{path}.rows.{i}", f"row has {len(row)} cells, table has {len(columns)} columns"))
    return problems


def text_table(block: dict) -> str:
    """The caption in bold, then a Markdown table of up to 12 rows and a note on how many were left out.

    rows may be cell lists or objects keyed by column name: {"A": 1, "B": 2.5} → "| 1 | 2.5 |". A cell written as
    null is a value nobody knows and prints a dash; a column an object row doesn't carry prints blank.
    """
    names, rows = block.get("columns"), block.get("rows")
    if not isinstance(names, list) or not names or not isinstance(rows, list) or not rows:
        return ""
    names = names[:8]
    columns = [table_cell(c) for c in names]
    cells = []
    for row in rows[:MAX_TABLE_ROWS]:
        if isinstance(row, dict):
            cells.append([cell_value(row[name]) if isinstance(name, str) and name in row else "" for name in names])
        elif isinstance(row, list):
            cells.append([cell_value(v) for v in row])
    caption = safe_text(block.get("caption") or block.get("title"))
    lines = ([f"**{caption}**"] if caption else []) + md_table(columns, cells)
    if len(rows) > MAX_TABLE_ROWS:
        lines.append(f"_({len(rows) - MAX_TABLE_ROWS} more rows)_")
    return "\n".join(lines)
