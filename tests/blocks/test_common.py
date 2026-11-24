"""The shared checker helpers, one at a time. Placement words first: the tool, the store and the drawing side all
read the board's and each block's place ask through align_word, so it is pinned here where every side can see it."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
common = importlib.import_module("hermes_genui.blocks.common")


def test_align_word_reads_the_three_words_leniently():
    for word in ("left", "center", "right"):
        assert common.align_word(word) == word
    assert common.align_word(" Center ") == "center"
    assert common.align_word("RIGHT") == "right"


def test_align_word_gives_nothing_for_anything_else():
    for junk in (None, "", "middle", "justify", 123, ["center"], {"w": "center"}):
        assert common.align_word(junk) is None
