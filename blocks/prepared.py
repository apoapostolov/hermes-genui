"""prepared (Today only): ideas the assistant found before you asked, for one or two things coming up ("Anna's
birthday": a cake, flowers, a dinner spot), each a photo card; a tap asks Hermes about it."""

from .common import NO_SEND, acts_before_the_model, has_text, safe_text


def _idea_ok(idea: object) -> bool:
    return (isinstance(idea, dict) and has_text(idea.get("title")) and not acts_before_the_model(idea.get("title"))
            and isinstance(idea.get("photo"), str) and idea["photo"].startswith("https://"))


def check_prepared(block: dict, path: str) -> list[tuple[str, str]]:
    """1-2 groups, each with a title and 2-4 ideas (a title and an https photo); an ask can't be a command.

    {"groups": [{"title": "x", "ideas": [one]}]} → [("0.groups.0", "2-4 ideas, each a title and an https photo")]
    """
    groups = block.get("groups")
    if not isinstance(groups, list) or not 1 <= len(groups) <= 2:
        return [(path, "prepared needs 1-2 groups")]
    problems = []
    for i, group in enumerate(groups):
        at = f"{path}.groups.{i}"
        ideas = group.get("ideas") if isinstance(group, dict) else None
        if not (isinstance(group, dict) and has_text(group.get("title"))):
            problems.append((at, "a group needs a title"))
        elif not (isinstance(ideas, list) and 2 <= len(ideas) <= 4 and all(_idea_ok(x) for x in ideas)):
            problems.append((at, "2-4 ideas, each a title and an https photo"))
        elif isinstance(group.get("ask"), dict) and acts_before_the_model(group["ask"].get("text")):
            problems.append((f"{at}.ask", NO_SEND))
    return problems


def text_prepared(block: dict) -> str:
    """"**For Anna's birthday** · Wed 25 Nov" then "- Chocolate layer cake: Fremont bakery" per idea."""
    out = []
    for group in block.get("groups") or []:
        if not isinstance(group, dict):
            continue
        head = f"**For {safe_text(group.get('title'))}**"
        head += f" · {safe_text(group['date'])}" if group.get("date") else ""
        ideas = [f"- {safe_text(x.get('title'))}" + (f": {safe_text(x['note'])}" if x.get("note") else "")
                 for x in group.get("ideas") or [] if isinstance(x, dict)]
        out.append("\n".join([head, *ideas]))
    return "\n\n".join(out)
