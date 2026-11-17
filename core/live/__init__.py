"""Live values for the Today page, fetched by the plugin itself with no model involved.

resolve.py turns cities and names into places and symbols, feeds.py fetches each kind of data, and cache.py serves
them without fetching anything twice. The dashboard API loads these by path (Hermes imports dashboard/plugin_api.py
on its own), so these modules load their siblings by path too instead of importing from the package.
"""
