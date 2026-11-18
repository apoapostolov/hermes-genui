# Evals: how well models use the blocks

A set of prompts, and a runner that sends them to a model and scores what it draws. Use it to compare models, guide
designs and proposed fields with numbers instead of impressions. The plan it serves is in issue #42.

## What a run does

For each prompt in `prompts/blocks.toml`, the runner (`run.py`):

1. Gives the model what Hermes gives it in the Desktop app:
   - the plugin's system-prompt section
   - the reminder the plugin adds beside a visual request
   - the real `show_blocks` tool, with today's guide in its description
2. Answers the model's `show_blocks` calls with the plugin's own handler: a tag, or "Not drawn. Fix these...". The
   model can then correct itself, as it would in a chat. Boards go to a temporary folder, never a Hermes profile.
3. Scores the result against the prompt's `expect`. It also records the number of `show_blocks` calls, whether the
   first was valid, whether the tag reached the reply, any tag the model made up without calling the tool, tokens and
   time.

It needs no Hermes, only the plugin's folder and a model behind any OpenAI-compatible API.

## Running it

```sh
# LM Studio (its server port is in the Developer tab; 1234 by default)
uv run --no-project --with httpx --with psutil python evals/run.py \
  --base-url http://localhost:1234/v1 --model gemma-4-12b

# a few prompts only
uv run --no-project --with httpx --with psutil python evals/run.py --model gemma-4-12b --only table-phones,none-capital

# a hosted model
EVAL_API_KEY=... uv run --no-project --with httpx --with psutil python evals/run.py \
  --base-url https://openrouter.ai/api/v1 --model some/model
```

`httpx` and `psutil` are there because the plugin imports them; Hermes normally provides them.

Each run prints a line per prompt and a summary, and writes every detail to `evals/results/<model>-<time>.jsonl`. That
includes the model's calls, the handler's answers and the reply. `evals/results/` is not committed.

Options:

- `--max-turns`: model calls per prompt, retries included (default 4).
- `--temperature`: default: the server's own setting for the model. Some models loop at 0.
- `--max-tokens`: per model call, thinking included (default 6000), so a model that loops still stops.
- `--system-file`: use a real Hermes system prompt instead of the one-line stand-in.
- `--out`: the results file.

## Adding prompts

Add a `[[prompt]]` to `prompts/blocks.toml`. The format is described at the top of that file, and
`tests/evals/test_prompts_file.py` checks it in CI. Good prompts:

- **Sound like a real user.** Write what someone would type, not a description of the block.
- **Carry their data.** The model gets no tools but `show_blocks`, so put the numbers in the prompt.
- **Name one right answer**, plus `alternatives` when another block is just as good. If people would disagree about
  the right block, the prompt tests taste, not the guide.
- **Test a proposed field directly.** Make the field the clearest way to answer, and say where the prompt came from
  (`from = "#21"`).
- **Include prompts where nothing should be drawn.** These matter as much as the drawing ones.

Aim for at least two prompts per block, a few that combine blocks, and a few with nothing to draw.

## Adding or changing a block

A pull request that adds a block, or adds fields to one, comes with evidence that models use it well:

1. **Prompts.** Add at least two prompts for the block (more for each new field) to `prompts/blocks.toml`, written so
   the new block or field is the clearest answer. Add one prompt where a similar block would be wrong, to catch the
   new one being picked too eagerly.
2. **Runs.** Run only the prompts about your block on at least two models, one of them a small local model (such as
   Gemma 4 12B), and add `--markdown`:

   ```sh
   uv run --no-project --with httpx --with psutil python evals/run.py \
     --base-url http://localhost:1234/v1 --model gemma-4-12b --block chart --markdown
   ```

3. **Results.** Paste each Markdown table into the pull request, and say which model and quantization you used.

If your change also touches the guide text other blocks share, run the whole set before and after, and paste both
summaries.

## Is a run a pass?

Each prompt passes or fails on its own:

- **A drawing prompt** passes when a board was drawn (it passed the plugin's checks) and it contains the `expect` block
  or one of its `alternatives`, plus every `also`. With `kind`, it must also contain a chart of that kind.
- **A `none` prompt** passes when nothing was drawn.

A whole run has no single pass mark, because models differ and small ones vary from run to run. Judge a change by
comparing runs:

- the same model and prompts, before and after the change
- a new block's prompts across models

A change is welcome when its own prompts pass on the models people use, and nothing that passed before now fails.

The CI tests never call a model. They only check `prompts/blocks.toml`'s format and the runner's scoring.

## Reading the results

Small local models vary from run to run, so compare several runs or a larger set before
deciding anything.

The runner is kinder than real use in two ways:

- Hermes's real system prompt is longer.
- Hermes offers many more tools than `show_blocks`.

Use `--system-file` with a captured Hermes prompt to get closer to real conditions.
