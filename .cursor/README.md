# Cursor project configuration

This folder configures Cursor for **diffmate** (local-first AI-diff review
tool: browser UI + CLI + Claude Code MCP server).

| Path | Purpose |
| --- | --- |
| [`BUGBOT.md`](BUGBOT.md) | Review rules for **Agent Review** and **Bugbot** |
| [`rules/diffmate.mdc`](rules/diffmate.mdc) | Agent rules: imports, dependency policy, engine invariants |
| [`skills/code-review/`](skills/code-review/) | Agent skill: review changes against diffmate conventions |
| [`skills/pr-prepare/`](skills/pr-prepare/) | Agent skill: typecheck/test/format checklist before committing |

## Quick commands

Not yet available — land with milestone M0 (see `docs/PLAN.md`):

```bash
npm run typecheck   # tsc --noEmit
npm run build       # esbuild -> dist/
npm test            # node --test
```

## Human-facing docs

- Project overview: [`README.md`](../README.md) (repo root)
- Full architecture and build plan: [`docs/PLAN.md`](../docs/PLAN.md)
