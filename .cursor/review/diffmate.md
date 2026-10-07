---
description: diffmate review rules — engine and UI conventions, typecheck and tests
---

# Review guide (diffmate)

Applied by the global `code-review` skill (and Claude's built-in `/code-review`) to every change in this repo.

## Before reviewing

1. Read `.cursor/BUGBOT.md` and `.cursor/rules/diffmate.mdc` for review
   rules and conventions (`AGENTS.md` is the tool-agnostic summary of the
   same conventions).
2. Compare against the working tree unless the user specifies a base ref.
3. Typecheck anything touched: `npm run typecheck` (`tsc --noEmit`). Run
   `npm test` (`node --test` on `src/engine`, then vitest on `src/ui`) if
   `engine/` or `src/ui/` logic changed.

## Checklist

- [ ] `tsc --noEmit` clean
- [ ] `npm test` passes if `engine/` or `src/ui/` logic changed
- [ ] No new runtime dependency without a documented reason (dependency
      policy in `AGENTS.md` / `.cursor/rules/diffmate.mdc`)
- [ ] Git state untouched — diffmate only reads diffs, never mutates

## Priority areas

| Area              | Paths                      |
| ----------------- | -------------------------- |
| Session/event bus | `src/engine/session.ts`    |
| HTTP + SSE server | `src/engine/httpServer.ts` |
| Diff parsing      | `src/engine/parseDiff.ts`  |
| Structured output | `src/engine/output.ts`     |
| MCP tools         | `src/mcp/tools.ts`         |
| CLI entry         | `src/cli/index.ts`         |
| Review UI         | `src/ui/src/`              |

## diffmate-specific checks

- **Engine reuse** — new behavior needed by both `cli/` and `mcp/` belongs
  in `engine/`, not duplicated across entry points.
- **Event bus stays generic** — no CLI-only or MCP-only special-casing in
  `session.ts`.
- **Approve/reject is a signal, not an action** — diffmate never mutates
  files or runs git commands beyond reading diffs.
- **MCP tool shapes match `docs/PLAN.md`** exactly if `mcp/tools.ts` changed.
