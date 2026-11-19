"""Which block guide the model gets (#42), while the two are measured against each other with evals/run.py.

"full" (the default): every block's fields and example in the show_blocks description.
"menu": a short menu there, and block_guide returns the fields and example of the blocks the model will use.
Set HERMES_GENUI_GUIDE=menu before the plugin loads to switch.
"""

import os

GUIDE = "full" if os.environ.get("HERMES_GENUI_GUIDE", "").strip().lower() == "full" else "menu"
