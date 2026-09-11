---
name: code-review
description: >-
  Reviews diffmate changes using the conventions in AGENTS.md and
  .cursor/rules/diffmate.mdc. Use when the user asks for a code review, PR
  review, pre-push review, or findings before committing.
---

# Code review (diffmate)

## When to use

- User asks to review changes, a branch diff, or a PR
- Before committing (no remote/PR flow yet — see `docs/PLAN.md` status)

## Instructions

1. Read [`.cursor/BUGBOT.md`](../../BUGBOT.md) and
   [`.cursor/rules/diffmate.mdc`](../../rules/diffmate.mdc) for review rules
   and conventions.
2. Compare against the working tree unless the user specifies a base ref.
3. Do **not** edit files unless the user asks — review only.
4. Typecheck anything touched: `npm run typecheck` (`tsc --noEmit`). Run
   `node --test` if `engine/` logic changed.

## Output format

```markdown
## Summary
[1–2 sentences]

## Findings

### Blocker
- `path:line` — issue — suggested fix

### Suggestion
- ...

### Nit
- ... (skip items covered by Prettier)

## Checklist
- [ ] `tsc --noEmit` clean
- [ ] `node --test` passes if `engine/` logic changed
- [ ] No new runtime dependency without a documented reason (dependency
      policy in `.cursor/rules/diffmate.mdc`)
- [ ] Git state untouched — diffmate only reads diffs, never mutates
```

## Priority areas

| Area | Paths |
| --- | --- |
| Session/event bus | `src/engine/session.ts` |
| HTTP + SSE server | `src/engine/httpServer.ts` |
| Diff parsing | `src/engine/parseDiff.ts` |
| MCP tools | `src/mcp/tools.ts` |
| CLI entry | `src/cli/index.ts` |

## diffmate-specific checks

- **Engine reuse** — new behavior needed by both `cli/` and `mcp/` belongs
  in `engine/`, not duplicated across entry points.
- **Event bus stays generic** — no CLI-only or MCP-only special-casing in
  `session.ts`.
- **Approve/reject is a signal, not an action** — diffmate never mutates
  files or runs git commands beyond reading diffs.
- **MCP tool shapes match `docs/PLAN.md`** exactly if `mcp/tools.ts` changed.
