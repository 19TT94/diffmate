# Code review rules (Cursor Agent Review + Bugbot)

Project rules for [Cursor Agent Review](https://cursor.com/docs/agent/agent-review)
(local, before push) and [Bugbot](https://cursor.com/docs/bugbot) (GitHub PR
reviews). Conventions live in [`rules/diffmate.mdc`](rules/diffmate.mdc).

## Repo layout

- **Engine (harness-agnostic):** `src/engine/` — git access, diff parsing,
  session state + event bus, HTTP server, output builder
- **CLI (phase 1):** `src/cli/`
- **MCP server (phase 2, Claude Code only):** `src/mcp/`
- **Install helper:** `src/install/`
- **UI:** `src/ui/` — vanilla HTML/CSS/JS
- **Architecture reference:** `docs/PLAN.md`

## Always check

- **Git state is read-only** — no `git add -N`, no index writes, no
  mutation of any kind. diffmate only ever reads diffs.
- **Local server binds `127.0.0.1` only**, with a random session token in
  the served URL — no other auth exists.
- **MCP tool contracts match `docs/PLAN.md`** exactly: `start_review`,
  `wait_for_activity`, `answer_question`, `end_review` — schema and event
  shapes (`no_activity` / `question` / `review_complete`).
- **`wait_for_activity`'s timeout is an unverified constraint** — Claude
  Code's real MCP tool-call timeout hasn't been confirmed empirically. Flag
  any change that assumes a specific ceiling as unverified.
- **Session/event bus stays generic** — `engine/session.ts`'s `bus` must
  stay a general-purpose `EventEmitter`, not special-cased for CLI-only or
  MCP-only use.
- **Approve/reject semantics** — never auto-revert, never run a git mutation
  command as a side effect of a review decision.

## Prefer

- Reusing `engine/` code unchanged between `cli/` and `mcp/` entry points.
- Node builtins and `execFile` over new dependencies or `exec`.
- Matching the Prettier/tsconfig conventions already in the repo.

## Deprioritize in review

- Formatting nits already caught by `prettier --check`.
- Refactors outside the change's scope unless they fix a real bug.

## Priority paths

| Area | Paths |
| --- | --- |
| Session/event bus | `src/engine/session.ts` |
| HTTP + SSE server | `src/engine/httpServer.ts` |
| Diff parsing | `src/engine/parseDiff.ts` |
| MCP tools | `src/mcp/tools.ts` |
| CLI entry | `src/cli/index.ts` |
