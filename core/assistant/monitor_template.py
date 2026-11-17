"""The change detector Hermes runs before each assistant check (the scheduled task's `monitor`). It is copied into the
profile's scripts/ folder, where Hermes requires monitor scripts, with the plugin's folder and the assistant's config
written in. It prints the demo's act and the ids of the mail in the inbox, nothing else: the output changes only when
new mail arrives (or the user asks for act 2), so a check with nothing new is skipped without calling the model, and no
mail text ever reaches the check's prompt through Hermes's diff.
"""

TEMPLATE = '''"""hermes-genui personal assistant: change detector for the "Personal assistant check" scheduled task.
Written by assistant_setup; removed when the assistant is cleared. Prints the act and mail ids only."""
import importlib.util
import json
from datetime import date, datetime
from pathlib import Path

DEMO = Path({demo!r})
CONFIG = Path({config!r})
spec = importlib.util.spec_from_file_location("hermes_genui_assistant_demo", DEMO)
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)
try:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
except (OSError, ValueError):
    config = {{}}
now = datetime.now().astimezone()
anchor = date.fromisoformat(config["demo_anchor"]) if config.get("demo_anchor") else None
act = int(config.get("demo_act") or 1)
next_at = datetime.fromisoformat(config["demo_next_at"]) if config.get("demo_next_at") else None
mails = demo.inbox(now, None, anchor, act, next_at)
print(f"act {{act}} since {{config.get('demo_reset_at') or config.get('setup_at') or ''}}")
print(f"{{len(mails)}} mails")
for mail in mails:
    print(mail["id"])
'''


def script_text(demo_path: str, config_path: str = "") -> str:
    return TEMPLATE.format(demo=demo_path, config=config_path)
