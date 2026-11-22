"""What every tool and hook shares: the block catalog and its tool description (catalog.json, catalog_text), the
board checker (check), the block store (store; also loaded on its own by dashboard/plugin_api.py, so it imports
nothing from the package), which chat surface a turn is on (surface), the Advanced rendering setting and its
per-model gate (advanced), the plugin's name and version from plugin.yaml (manifest) and the shipped recipes
(recipes)."""
