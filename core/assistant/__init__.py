"""The personal assistant: a scheduled check of mail and calendar that files what needs the user, suggests or takes
actions, and remembers them; the Today page shows it.

demo.py is the v1 source (seeded mail and events that arrive through the day), memory.py keeps the assistant's
config, items and check log. The dashboard API loads these by path (Hermes imports dashboard/plugin_api.py on its
own), so they import nothing from the package and load their siblings by path.
"""
