"""Dashboards: assembled from the plugin's own blocks. A skill writes a spec (a title and sections, each naming a
source and how to show it); sources.py turns each source's data into catalog blocks; assemble.py puts a spec together
whenever the Today page asks, with no model call. The dashboard API loads these by path, so they load their siblings
(and core/live, core/assistant) by path too.
"""
