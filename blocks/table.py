"""table: columns and rows, sortable on Hermes Desktop."""

from .common import fmt_num, md_table, safe_text, table_cell

MAX_TABLE_ROWS = 12
COLUMN_KINDS = {"text", "number", "currency", "percent", "date", "badge", "link", "bar", "sources"}
AGGREGATE_OPS = {"sum", "avg", "min", "max", "count"}


def is_structured(block: dict) -> bool:
    columns = block.get("columns")
    return (
        (isinstance(columns, list) and any(isinstance(c, dict) for c in columns))
        or block.get("filterable") is True
        or "page" in block
        or isinstance(block.get("aggregates"), list)
    )


def check_structured(block: dict, path: str) -> list[tuple[str, str]]:
    columns, rows = block.get("columns"), block.get("rows")
    if not isinstance(columns, list) or not columns or len(columns) > 8:
        return [(path, "a structured table needs 1-8 columns")]
    if not isinstance(rows, list) or not rows or len(rows) > 30:
        return [(path, "a structured table needs 1-30 rows")]
    ids = set()
    problems = []
    for i, column in enumerate(columns):
        if not isinstance(column, dict):
            problems.append((f"{path}.columns.{i}", "column needs id and label"))
            continue
        cid = safe_text(column.get("id"), 40)
        if not cid or cid in ids:
            problems.append((f"{path}.columns.{i}", "column id is missing or used twice"))
        else:
            ids.add(cid)
        if column.get("kind") is not None and column["kind"] not in COLUMN_KINDS:
            problems.append((f"{path}.columns.{i}", "unknown column kind"))
    if "page" in block:
        page = block["page"]
        if not (isinstance(page, int) and 1 <= page <= 10):
            problems.append((path, "page must be 1 to 10"))
    for i, aggregate in enumerate(block.get("aggregates") or []):
        if not isinstance(aggregate, dict) or aggregate.get("op") not in AGGREGATE_OPS:
            problems.append((f"{path}.aggregates.{i}", "aggregate op is sum, avg, min, max or count"))
    return problems


def check_table(block: dict, path: str) -> list[tuple[str, str]]:
    """Columns (up to 8) and rows (up to 30), no row wider than the columns; rows may also be objects keyed by
    column name.

    columns = ["A", "B"], rows[1] = ["1", "2", "3"] → [("0.rows.1", "row has 3 cells, table has 2 columns")]
    """
    if is_structured(block):
        return check_structured(block, path)
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


def structured_cell(row: dict, column: dict) -> str:
    cid = safe_text(column.get("id"), 40)
    if column.get("kind") == "sources":
        sources = row.get("sources") or []
        labels = [
            safe_text(s.get("label") if isinstance(s, dict) else s, 40)
            for s in sources if isinstance(s, (dict, str))
        ]
        return ", ".join(x for x in labels if x)
    cell = (row.get("cells") or {}).get(cid)
    if not isinstance(cell, dict):
        return ""
    value = cell.get("value")
    if column.get("kind") == "currency" and isinstance(value, (int, float)):
        return f"{safe_text(column.get('unit'), 12)}{fmt_num(value)}".strip()
    if column.get("kind") == "percent" and isinstance(value, (int, float)):
        return f"{fmt_num(value)}%"
    if isinstance(value, (int, float)):
        return fmt_num(value)
    return table_cell(cell.get("text"))


def text_structured(block: dict) -> str:
    columns = [c for c in block.get("columns", []) if isinstance(c, dict)]
    rows = [r for r in block.get("rows", []) if isinstance(r, dict)]
    if not columns or not rows:
        return ""
    names = [table_cell(c.get("label") or c.get("id")) for c in columns]
    cells = [[structured_cell(row, column) for column in columns] for row in rows[:MAX_TABLE_ROWS]]
    caption = safe_text(block.get("caption") or block.get("title"))
    lines = ([f"**{caption}**"] if caption else []) + md_table(names, cells)
    if len(rows) > MAX_TABLE_ROWS:
        lines.append(f"_({len(rows) - MAX_TABLE_ROWS} more rows)_")
    for aggregate in block.get("aggregates") or []:
        if not isinstance(aggregate, dict):
            continue
        cid = safe_text(aggregate.get("column"), 40)
        values = [(r.get("cells") or {}).get(cid, {}).get("value") for r in rows]
        values = [v for v in values if isinstance(v, (int, float))]
        if not values:
            continue
        op = aggregate.get("op")
        value = {"sum": sum(values), "avg": sum(values) / len(values),
                 "min": min(values), "max": max(values), "count": len(values)}.get(op)
        if value is not None:
            label = safe_text(aggregate.get("label"), 20) or str(op)
            lines.append(f"_{label}: {fmt_num(value)}_")
    return "\n".join(lines)


def text_table(block: dict) -> str:
    """The caption in bold, then a Markdown table of up to 12 rows and a note on how many were left out.

    rows may be cell lists or objects keyed by column name: {"A": 1, "B": 2.5} → "| 1 | 2.5 |"
    """
    if is_structured(block):
        return text_structured(block)
    names, rows = block.get("columns"), block.get("rows")
    if not isinstance(names, list) or not names or not isinstance(rows, list) or not rows:
        return ""
    names = names[:8]
    columns = [table_cell(c) for c in names]
    cells = []
    for row in rows[:MAX_TABLE_ROWS]:
        if isinstance(row, dict):
            cells.append([table_cell(row.get(name)) if isinstance(name, str) else "" for name in names])
        elif isinstance(row, list):
            cells.append([table_cell(v) for v in row])
    caption = safe_text(block.get("caption") or block.get("title"))
    lines = ([f"**{caption}**"] if caption else []) + md_table(columns, cells)
    if len(rows) > MAX_TABLE_ROWS:
        lines.append(f"_({len(rows) - MAX_TABLE_ROWS} more rows)_")
    return "\n".join(lines)
