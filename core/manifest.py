"""The plugin's name, version and homepage, read once from plugin.yaml, so a rename or a release changes one file.

Everything that says the plugin's name takes it from here: the system-prompt section id, the namespace of the recipe
skills ("<NAME>:trip-planner"), the toolset, and the User-Agent the photo and market sources are asked with.

    plugin.yaml:  name: hermes-genui / version: "0.3.0" / homepage: https://github.com/sagarmainkar/hermes-genui
    → NAME "hermes-genui";  VERSION "0.3.0";
      USER_AGENT "hermes-genui/0.3.0 (+https://github.com/sagarmainkar/hermes-genui)"
"""

import re
from pathlib import Path

PLUGIN_YAML = Path(__file__).resolve().parent.parent / "plugin.yaml"

# What Hermes accepts as a plugin skill namespace, and the catalog as an entry name.
_NAME = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


def read_fields(text: str) -> dict[str, str]:
    """The top-level `key: value` lines of plugin.yaml, quotes and a trailing ` # comment` dropped. Indented lines
    (the settings under config_schema) are skipped. No YAML library: the plugin needs only these few plain values.

    'name: x\\nversion: "1.0"  # release\\nconfig_schema:\\n  name: no' → {"name": "x", "version": "1.0",
    "config_schema": ""}
    """
    fields = {}
    for line in text.splitlines():
        if not line or line[0] in " \t#-":
            continue
        key, sep, value = line.partition(":")
        if sep:
            value = re.split(r"\s+#", value, maxsplit=1)[0].strip()
            fields[key.strip()] = value.strip('"').strip("'")
    return fields


_FIELDS = read_fields(PLUGIN_YAML.read_text(encoding="utf-8"))
NAME = _FIELDS["name"]
VERSION = _FIELDS["version"]
HOMEPAGE = _FIELDS["homepage"]
if not _NAME.match(NAME):
    raise ValueError(f"plugin.yaml name {NAME!r}: use lowercase letters, digits, - and _")

# How the plugin names itself to the sites it asks (Wikimedia refuses a client without a contact URL, and Yahoo a
# library's default one).
USER_AGENT = f"{NAME}/{VERSION} (+{HOMEPAGE})"
