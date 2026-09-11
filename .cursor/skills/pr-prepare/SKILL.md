---
name: pr-prepare
description: >-
  Prepares a diffmate branch for commit: typecheck, tests, formatting, and a
  conventions checklist. Use when the user is about to commit or wants a
  pre-merge checklist.
disable-model-invocation: true
---

# Prepare commit (diffmate)

## Repo layout

- **Engine (harness-agnostic):** `src/engine/`
- **CLI (phase 1):** `src/cli/`
- **MCP server (phase 2, Claude Code only):** `src/mcp/`
- **Install helper:** `src/install/`
- **UI:** `src/ui/`
- **Architecture reference:** `docs/PLAN.md`

## Checklist (run in order)

1. **Git status**
   ```bash
   git status
   git diff
   ```
   Confirm `node_modules/` and `dist/` are never staged.

2. **Typecheck**
   ```bash
   npm run typecheck   # tsc --noEmit
   ```

3. **Tests** (once `engine/` has fixtures — see `docs/PLAN.md` milestone M2)
   ```bash
   npm test            # node --test
   ```

4. **Format check**
   ```bash
   npx prettier --check .
   ```

5. **Dependency policy** — if `package.json` dependencies changed, confirm
   the addition clears the bar in `.cursor/rules/diffmate.mdc` (a real
   reason, not convenience) and update `AGENTS.md` if the reasoning is
   durable.

## Commit message hints

- Short imperative summary (e.g. `add diff parser for unified hunks`).
- Note which milestone from `docs/PLAN.md` the change advances.
- Only commit when the user explicitly asks.

## Do not

- Commit secrets, `.env*`, `.DS_Store`, `node_modules/`, or `dist/`
- Add a runtime dependency without updating the dependency policy in
  `.cursor/rules/diffmate.mdc`
- Run diffmate against a real repo's uncommitted changes as a "test" —
  use a scratch repo or fixture diffs instead
