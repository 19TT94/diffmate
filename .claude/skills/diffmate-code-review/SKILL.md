---
name: diffmate-code-review
description: >-
  Reviews diffmate changes using the conventions in AGENTS.md and
  .cursor/rules/diffmate.mdc. Use when the user asks for a code review, PR
  review, pre-push review, or findings before committing changes in this
  repo.
allowed-tools: Bash(npm run typecheck) Bash(npm test) Bash(git diff *) Bash(git status *)
---

# Code review (diffmate)

Ported from the Cursor skill at `.cursor/skills/code-review/SKILL.md` — keep
the two in sync if either changes.

## When to use

- User asks to review changes, a branch diff, or a PR
- Before committing

## Instructions

1. Read `.cursor/BUGBOT.md` and `.cursor/rules/diffmate.mdc` for review
   rules and conventions (`AGENTS.md` is the tool-agnostic summary of the
   same conventions).
2. Compare against the working tree unless the user specifies a base ref.
3. Do **not** edit files unless the user asks — review only.
4. Typecheck anything touched: `npm run typecheck` (`tsc --noEmit`). Run
   `npm test` (`node --test` on `src/engine`, then vitest on `src/ui`) if
   `engine/` or `src/ui/` logic changed.

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
- [ ] `npm test` passes if `engine/` or `src/ui/` logic changed
- [ ] No new runtime dependency without a documented reason (dependency
      policy in `AGENTS.md` / `.cursor/rules/diffmate.mdc`)
- [ ] Git state untouched — diffmate only reads diffs, never mutates
```

## Priority areas

| Area | Paths |
| --- | --- |
| Session/event bus | `src/engine/session.ts` |
| HTTP + SSE server | `src/engine/httpServer.ts` |
| Diff parsing | `src/engine/parseDiff.ts` |
| Structured output | `src/engine/output.ts` |
| MCP tools | `src/mcp/tools.ts` |
| CLI entry | `src/cli/index.ts` |
| Review UI | `src/ui/src/` |

## diffmate-specific checks

- **Engine reuse** — new behavior needed by both `cli/` and `mcp/` belongs
  in `engine/`, not duplicated across entry points.
- **Event bus stays generic** — no CLI-only or MCP-only special-casing in
  `session.ts`.
- **Approve/reject is a signal, not an action** — diffmate never mutates
  files or runs git commands beyond reading diffs.
- **MCP tool shapes match `docs/PLAN.md`** exactly if `mcp/tools.ts` changed.
