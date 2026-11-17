# GenUI port checklist

This tracks the rich-ui port work in [sagarmainkar/hermes-genui](https://github.com/sagarmainkar/hermes-genui). The visual contract lives in [AGENTS.md](AGENTS.md). Add one row when a PR opens and update its status here in the same pass.

## Opened PRs

| PR | Source | Scope | State | CI |
| --- | --- | --- | --- | --- |
| [#16](https://github.com/sagarmainkar/hermes-genui/pull/16) | [#15](https://github.com/sagarmainkar/hermes-genui/issues/15) | Stray `::blocks` tag renders nothing | Open | monitored |
| [#19](https://github.com/sagarmainkar/hermes-genui/pull/19) | [#18](https://github.com/sagarmainkar/hermes-genui/issues/18) | Wheel chains past a short table | Open | monitored |
| [#20](https://github.com/sagarmainkar/hermes-genui/pull/20) | [#11](https://github.com/sagarmainkar/hermes-genui/issues/11) | Generated image provenance and gallery | Open | green |
| [#29](https://github.com/sagarmainkar/hermes-genui/pull/29) | [#24](https://github.com/sagarmainkar/hermes-genui/issues/24) | Chart caveat and axis captions | Open | green |
| [#30](https://github.com/sagarmainkar/hermes-genui/pull/30) | [#25](https://github.com/sagarmainkar/hermes-genui/issues/25) | Ranked bars in `list` | Open | green |
| [#31](https://github.com/sagarmainkar/hermes-genui/pull/31) | [#23](https://github.com/sagarmainkar/hermes-genui/issues/23) | KPI change from `previous`, cost tone inversion | Open | green |
| [#32](https://github.com/sagarmainkar/hermes-genui/pull/32) | [#27](https://github.com/sagarmainkar/hermes-genui/issues/27) | Checklist item states, owner and note | Open | green |
| [#33](https://github.com/sagarmainkar/hermes-genui/pull/33) | [#17](https://github.com/sagarmainkar/hermes-genui/issues/17) | Progress shapes, thresholds and segments | Open | green |
| [#34](https://github.com/sagarmainkar/hermes-genui/pull/34) | [#21](https://github.com/sagarmainkar/hermes-genui/issues/21) | Scatter and waterfall chart kinds | Open | green |
| [#35](https://github.com/sagarmainkar/hermes-genui/pull/35) | [#26](https://github.com/sagarmainkar/hermes-genui/issues/26) | Histogram and range chart kinds | Open | pending |
| [#36](https://github.com/sagarmainkar/hermes-genui/pull/36) | [#22](https://github.com/sagarmainkar/hermes-genui/issues/22) | `null` means unknown, never 0 | Open | pending |

## Remaining port queue

Ordered by estimated implementation cost. A row becomes a PR row above when its branch is pushed and the PR is opened.

| Order | Issue | Scope | UI bible aspect to add when it lands |
| --- | --- | --- | --- |
| 1 | [#28](https://github.com/sagarmainkar/hermes-genui/issues/28) | Accessible names and roles across blocks | One naming ladder across blocks and where a dedicated role changes an existing drawing |

## Definition of done for each row

- Branch pushed to `apoapostolov/hermes-genui`, PR open against `sagarmainkar/hermes-genui:main`, linked to its issue.
- Reader, React renderer, Python checker and text fallback updated together where the field changes meaning.
- Focus, keyboard and reduced-motion behavior inherited from the existing control, not reimplemented.
- `AGENTS.md` updated in the same session when the change introduces a visual or interaction aspect the contract did not already name.
- Bundle rebuilt from LF-normalized sources, both CI checks green, and a read-only CI monitor attached.
