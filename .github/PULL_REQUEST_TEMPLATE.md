## What and why

<!-- One or two sentences. Link the issue for a new block type. -->

## Checks

- [ ] Tests added or updated first, and every check passes locally (see CONTRIBUTING.md → Checks)
- [ ] `desktop/plugin.js` rebuilt if anything under `web/src` changed
- [ ] New or changed block: strict Python check, lenient web reader, text fallback, light and dark, keyboard, phone width
- [ ] `core/catalog.json` changed: a line in `core/menu.txt` for a new block, and the fixture regenerated
- [ ] Changed what the model reads (blocks, fields, catalog wording, prompt text): eval prompts added and results pasted below (see `evals/README.md`)
- [ ] No HTML or code from the model or the web reaches the page; fetches go through `tools/photos/safety.py`
- [ ] Network calls, new data read or stored, or new prompt text are listed in the README's privacy section
