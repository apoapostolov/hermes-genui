---
name: explain
description: "Explain how something works: explain, how does X work, walk me through, what happens when, a simulation of a quantity over time, or a stack of layers. Use static flows for simple processes and steps for meaningful state changes; use compare for best-way recommendations."
version: 0.2.0
platforms: [linux, macos, windows]
---
# Explain

Use this when someone wants to understand how something works: a mechanism, a process, a system ("how does UPI work",
"what happens when I type a URL", "explain transformers", "how does compound interest work"). For a one-line fact,
just answer in text; to revise or be quizzed, use the `learn` recipe. For advice on which approach to take,
especially when an alternative changes the user's requested workflow, use `compare` rather than forcing a
mechanism diagram.

## Static vs interactive decision

Choose one primary presentation for the process.

- **Default to a static `flow`** when the user can understand the complete
  sequence from the node labels and notes. A process having multiple stages
  is not, by itself, a reason to add `steps`.
- **Use `steps` only when advancing changes what the diagram teaches**, such
  as accumulated contents, repeated computation, evolving values, or state
  that cannot be understood as clearly in the static diagram.
- Moving the highlight, sending a decorative packet, or revealing another
  sentence about an already visible node does not count as meaningful change.
- Do not add `steps` to a simple static flow as a second explanation of the
  same information. If a static flow is sufficient, stop there.
- Preserve interactive walkthroughs when the user requests a genuine
  state-by-state demonstration or the state changes are central to the lesson.

## Steps

1. **Don't ask first.** Guess the level from how they asked (a student, a professional, just curious) and say it in
   one line of the reply ("Pitched for a curious beginner; no maths needed."). Offer "Simpler" and "More technical"
   buttons so they can move it.
2. **Pick one concrete case and follow it** all the way through: the sentence "The animal didn't cross the street
   because it was", "₹1,00,000 at 10% for 30 years", "a ₹500 UPI payment". Every box, step and number is about it.
3. **Check the facts.** For anything technical, dated or numeric, use web search. Never invent a number, a date or a
   name; leave out what you can't back up.
4. **Choose the stage by the mechanism's shape**, one stage block per board (a second only for "More technical"):
   - simple, self-explanatory chain → a static `flow` with concise `note` text; no `steps`;
   - complex process with meaningful changing state → a `flow` walked by `steps`;
   - a quantity over time → `simulate` (its formulas are worked out live; never do that maths in text);
   - a stack of layers or levels → `layers`.
5. **If using interactive steps, make each one earn its click.** Use them only if the flow changes meaningfully,
   not merely to highlight boxes or reveal text. For a stepped flow, 4-8 steps, each with at most 2 sentences and its
   `node`; give it `holds` (what boxes hold from now on), `send: true` (a packet slides along the arrow from the box
   lit before) and, inside a repeated `group` with a `count`, `tick` (it runs again that many times).
6. **Numbers.** Shapes, labels and positions are yours to choose; values, weights and counts come from a source or a
   formula. Label anything made up for the picture: a `badge` "numbers illustrative" (tone warn) near the stage.
7. **Lay it out** with one `show_blocks` call: a `heading` with the question; a `row` with a `badge` naming the level
   (and the "numbers illustrative" badge when it applies) and a `button` "More technical"; the stage (with `steps`
   only when progression is useful);
   for a beginner a short `list` of 3-5 key terms (title the term, subtitle its meaning; no flash cards unless asked);
   a `source` line when outside facts were used; then `actions`: "Go deeper on <stage>", "Quiz me", "Simpler".
8. **Formulas** go in the reply text as KaTeX between `$$ … $$` lines, which Desktop draws; never inside a block. One
   core formula at most, and only at a level that wants it.
9. **Reply** with the level line, the formula if any, then the tag on its own line. Keep the words short; the blocks
   carry the explanation.
10. **Next round.** "Simpler" or "More technical": redraw at that level. "Go deeper on <stage>": a new stage for that
    part alone. "Quiz me": hand over to the `learn` recipe.

## Static flow example (simple mechanism)

For a process whose entire meaning fits at a glance, render a single `flow` and no `steps`:

```json
[
  {"type": "heading", "text": "How a document reaches a shared folder"},
  {"type": "flow", "id": "save", "nodes": [
    {"id": "edit", "label": "Edit", "note": "Change the document."},
    {"id": "save", "label": "Save", "note": "Write the updated file."},
    {"id": "sync", "label": "Sync", "note": "Make it available on other devices."}
  ]}
]
```

## Interactive layout example (explain how transformers work, for a curious beginner)

The reply text above the tag can carry the core formula:
$$\mathrm{Attention}(Q, K, V) = \mathrm{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V$$

The flow follows one sentence through one pass; the stack sits in a folded "More technical" section.

```json
[
  {"type": "heading", "text": "How a transformer picks the next word"},
  {"type": "row", "children": [
    {"type": "badge", "text": "Level: curious beginner"},
    {"type": "badge", "text": "numbers illustrative", "tone": "warn"},
    {"type": "button", "label": "More technical", "run": "Explain transformers again, more technical, with the maths"}
  ]},
  {"type": "flow", "id": "tf", "title": "One pass makes one new token", "nodes": [
    {"id": "tokens", "label": "Tokens", "holds": ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was"]},
    {"id": "embed", "label": "Embeddings", "holds": ["a vector each"]},
    {"id": "attn", "label": "Self-attention", "holds": ["mix in context"]},
    {"id": "ffn", "label": "Feed-forward", "holds": ["rework each"]},
    {"id": "scores", "label": "Scores", "holds": ["a score per word"]},
    {"id": "pick", "label": "Next token", "holds": ["?"]}
  ], "groups": [{"label": "Repeated", "nodes": ["attn", "ffn"], "count": 6}]},
  {"type": "steps", "for": "tf", "items": [
    {"title": "Cut the text into tokens", "node": "tokens",
     "text": "The sentence so far becomes a list of tokens. Here each word is one token; real tokenisers often split words."},
    {"title": "Turn each token into a vector", "node": "embed", "send": true,
     "text": "Each token becomes a vector of learned numbers (512 per token in the original paper's base model). The numbers shown are made up.",
     "holds": {"embed": ["[.2 −1.1 …]", "[.8 .3 …]", "[−.4 .9 …]", "[.1 .5 …]", "[.2 −.9 …]", "[−.6 .2 …]", "[.7 .1 …]", "[.3 −.2 …]", "[.5 .6 …]"]}},
    {"title": "Let the tokens look at each other", "node": "attn", "send": true,
     "text": "Self-attention lets every token mix in what matters from the others. Afterwards the vector for \"it\" (highlighted) carries some of \"animal\".",
     "holds": {"attn": ["▃▁▅▂", "▆▂▃▁", "▂▅▁▄", "▄▁▆▂", "▃▁▂▅", "▆▄▅▁", "▁▂▆▄", {"text": "▇▅▆▃", "tone": "accent"}, "▂▆▄▁"]}},
    {"title": "Rework each token", "node": "ffn", "send": true,
     "text": "A small network reworks each token's vector on its own. Attention plus feed-forward make one layer.",
     "holds": {"ffn": ["▄▂▆▃", "▇▃▄▁", "▃▆▂▅", "▅▂▇▃", "▄▂▃▆", "▇▅▆▂", "▂▃▇▅", {"text": "▇▆▇▄", "tone": "accent"}, "▃▇▅▂"]}},
    {"title": "Run the layer five more times", "node": "ffn", "tick": 5,
     "text": "The same two stages run again, each layer with its own learned weights. The original paper stacks 6 layers.",
     "holds": {"ffn": ["▅▃▇▂", "▆▄▅▂", "▂▇▃▆", "▆▃▅▄", "▅▁▄▇", "▇▆▅▃", "▃▄▆▆", {"text": "█▇▆▅", "tone": "accent"}, "▄▆▆▃"]}},
    {"title": "Score every possible next word", "node": "scores", "send": true,
     "text": "The last token's vector gets a score for every word in the vocabulary, and softmax turns the scores into probabilities. These scores are illustrative.",
     "holds": {"scores": [{"text": "tired █████", "tone": "accent"}, "hungry ███", "scared ██", "old █"]}},
    {"title": "Pick one", "node": "pick", "send": true,
     "text": "A likely token is chosen: here \"tired\".",
     "holds": {"pick": [{"text": "tired", "tone": "accent"}]}},
    {"title": "Add it and go again", "node": "tokens", "send": true,
     "text": "\"tired\" joins the end of the text and the whole pass runs again. A reply is this loop, one token at a time.",
     "holds": {"tokens": ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", {"text": "tired", "tone": "accent"}]}}
  ]},
  {"type": "list", "title": "Key terms", "items": [
    {"title": "Token", "subtitle": "A word or piece of a word the model reads and writes"},
    {"title": "Vector", "subtitle": "A list of numbers that stands for a token"},
    {"title": "Attention", "subtitle": "Weighing the other tokens to decide what matters for this one"},
    {"title": "Layer", "subtitle": "One round of attention plus feed-forward"}
  ]},
  {"type": "section", "title": "More technical: the whole stack", "collapsed": true, "children": [
    {"type": "layers", "title": "The transformer stack",
     "caption": "Simplified to one stack; the original paper pairs an encoder and a decoder of 6 layers each.",
     "layers": [
       {"id": "embed", "label": "Embedding", "tone": "blue", "note": "Turns each token into a vector and adds a signal for its position in the text."},
       {"id": "l1", "label": "Layer 1", "tone": "violet", "note": "Self-attention, then feed-forward: each token gathers context from the others, then is reworked on its own."},
       {"id": "l2", "label": "Layer 2", "tone": "violet", "note": "The same shape as layer 1 with its own learned weights."},
       {"id": "l3", "label": "Layer 3", "tone": "violet", "note": "Each layer reads the vectors the layer below wrote, and writes better ones."},
       {"id": "l4", "label": "Layer 4", "tone": "violet", "note": "Stacking layers lets the model build from simple patterns to more abstract ones."},
       {"id": "l5", "label": "Layer 5", "tone": "violet", "note": "Still attention plus feed-forward, with its own weights."},
       {"id": "l6", "label": "Layer 6", "tone": "violet", "note": "The last of the 6 layers in the original paper."},
       {"id": "out", "label": "Output", "tone": "green", "note": "A final linear layer and **softmax** give a probability for every token in the vocabulary."}
     ]}
  ]},
  {"type": "source", "text": "Vaswani et al. 2017, Attention Is All You Need", "url": "https://arxiv.org/abs/1706.03762"},
  {"type": "actions", "items": [
    {"label": "Go deeper on attention", "run": "Go deeper on self-attention in transformers"},
    {"label": "Quiz me", "run": "Quiz me on how transformers work"},
    {"label": "Simpler", "run": "Explain transformers again, simpler"}
  ]}
]
```

## Second example (how compound interest works): a quantity over time

The reply text can carry $$A = P\left(1 + \frac{r}{100}\right)^{t}$$ and the stage is a `simulate`, whose formulas
are worked out live from the slider:

```json
[
  {"type": "heading", "text": "How compound interest grows ₹1,00,000"},
  {"type": "row", "children": [
    {"type": "badge", "text": "Level: curious beginner"},
    {"type": "button", "label": "More technical", "run": "Explain compound interest again, more technical"}
  ]},
  {"type": "simulate", "title": "₹1,00,000 left alone for 30 years",
   "t": {"name": "years", "to": 30, "step": 1, "unit": "years", "speed": 1.25},
   "inputs": [{"name": "rate", "label": "Interest per year", "min": 6, "max": 14, "step": 0.5, "value": 10, "unit": "%"}],
   "values": {"P": 100000},
   "view": {"kind": "dots", "per": 10000, "start": "₹1,00,000 you put in", "piles": [
     {"name": "Simple interest", "formula": "P * (1 + rate / 100 * years)", "adds": "interest"},
     {"name": "Compound interest", "formula": "P * (1 + rate / 100) ^ years", "adds": "interest on interest"}
   ]},
   "unit": "₹"},
  {"type": "list", "title": "Key terms", "items": [
    {"title": "Principal", "subtitle": "The amount you start with"},
    {"title": "Simple interest", "subtitle": "Interest on the principal only"},
    {"title": "Compound interest", "subtitle": "Interest on the principal and on interest already earned"}
  ]},
  {"type": "actions", "items": [
    {"label": "Go deeper on compounding", "run": "Go deeper on how often interest compounds"},
    {"label": "Quiz me", "run": "Quiz me on compound interest"},
    {"label": "Simpler", "run": "Explain compound interest again, simpler"}
  ]}
]
```

## Rules

- Blocks only: never write HTML or use `::preview` for a diagram, a walkthrough or a simulation.
- Facts and numbers only from search, tools, formulas or the user; anything made up for the picture is labelled
  "numbers illustrative". A step's `image` must be a URL `find_photos` returned; otherwise leave it out.
- A `flow` has 2-10 nodes (aim for 4-8), each holding at most 10 chips of up to 16 characters, and at most 3 groups,
  each framing neighbouring nodes (`count` 2-100); ids are short lowercase slugs. A `steps` block has 2-12 steps; its
  `for` is the flow's id, each `node` one of its node ids, `holds` keys node ids and `tick` is 1-20.
- A `simulate` takes up to 4 sliders, up to 8 fixed `values` and 1-3 piles; formulas use only those names, `t`'s
  name and the calculator's helpers. A `layers` block has 2-12 slabs, bottom first, labels up to 24 characters.
- Notes stay under 280 characters, step text at most 2 sentences; `**bold**` is the only markup inside blocks.
- Formulas only in the reply text as KaTeX (`$$ … $$`), never inside a block.
- `actions` take up to 3, and their text never starts with `/`, `@` or `!`.
