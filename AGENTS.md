# diffmate — coding agents

Local-first tool for reviewing AI-agent-generated diffs: a browser UI for
side-by-side hunk review, approve/reject decisions, and (Claude Code only)
live Q&A with the agent that wrote the diff. A minimal-dependency Node.js +
TypeScript, ESM engine/CLI/MCP server, paired with a React + styled-components
browser UI (`src/ui/`, its own package).

## Status

In progress. The harness-agnostic engine (git access, diff parsing,
`ReviewSession` state/event model, REST/SSE HTTP server) and the React
review UI are built and tested. The CLI entry point, structured output
builder, and the Claude Code MCP server (phase 2) are still to come. See
[`docs/PLAN.md`](docs/PLAN.md) for the full architecture, package layout,
and build order.

```bash
npm install
npm run typecheck   # tsc --noEmit (engine/cli/mcp/install; src/ui excluded)
npm test            # node --test on src/engine, then vitest on src/ui
npm run format       # prettier --check .

# src/ui is its own Vite package (React + TypeScript + styled-components):
npm run dev:ui        # vite dev server
npm run build:ui       # production build -> src/ui/dist
npm run lint:ui         # eslint

# Not yet available — land with milestone M7 (see docs/PLAN.md):
npm run build       # esbuild -> dist/
```

This file is the **tool-agnostic** entrypoint for coding agents (Cursor,
Codex, Claude Code, etc.) working on this repo. `CLAUDE.md` just imports it.

## Layout

Per `docs/PLAN.md`:

| Path | Role |
| --- | --- |
| `src/engine/` | Harness-agnostic core: git access, diff parsing, session state, HTTP server, output builder |
| `src/cli/` | Phase 1 entry point — one-shot blocking CLI, works from any harness |
| `src/mcp/` | Phase 2 entry point — Claude Code MCP server (stdio), live Q&A |
| `src/install/` | `diffmate install` — writes `.mcp.json` + project-local slash command |
| `src/ui/` | React + TypeScript + styled-components (Vite). Its own package.json, tsconfig, and dependency policy — see `.cursor/rules/diffmate-ui.mdc` |

## Conventions

- **TypeScript strict, ESM, Node 18+** (`tsconfig.json`). Type-check with
  `tsc --noEmit`; `esbuild` does the actual build.
- **Formatting via Prettier** (`.prettierrc`): no semicolons, single quotes,
  trailing commas, 80-column width. Match neighboring files.
- **One runtime dependency needs a real reason** — this applies to the root
  Node package (`engine/`, `cli/`, `mcp/`, `install/`), not `src/ui/`.
  `@modelcontextprotocol/sdk` clears the bar (hand-rolling MCP's JSON-RPC
  framing isn't worth it). Shell out to `git` via `execFile`, never add a
  git library — git is already a hard requirement for diffmate to exist.
  Prefer Node builtins (`node:http`, `node:events`, `node:crypto`,
  `node:child_process`) over utility packages. `src/ui/` is a separate Vite
  package (own `package.json`, wired in as an npm workspace so one root
  `npm install` covers both) with a normal React app's dependency footprint
  (React, styled-components) — see `.cursor/rules/diffmate-ui.mdc`.
- **Import groups** — external packages first (no label), then local
  modules grouped with a blank line + comment label (`// Engine`, `// CLI`,
  `// MCP`, `// Types`). See `.cursor/rules/diffmate.mdc` for the full
  pattern and example (root package); `src/ui/` uses its own group set —
  see `.cursor/rules/diffmate-ui.mdc`.
- **The engine's event bus stays generic from day one** — a plain
  `EventEmitter`-based pub/sub in `engine/session.ts`, not a single
  resolve-once promise. Phase 2's MCP `wait_for_activity` subscribes to the
  same bus phase 1's CLI uses for `review_complete`; this must never require
  reworking `session.ts`.
- **diffmate never mutates git state or files.** Approve/reject are signals
  only, consumed by whichever agent reads the structured output. Never let
  UI copy or a tool description imply an auto-revert.
- Only commit when explicitly asked.

## Skills

Each skill exists once per tool since the two harnesses load skills from
different locations and frontmatter dialects; keep a pair in sync if either
changes.

| Purpose | Cursor | Claude Code |
| --- | --- | --- |
| Review changes against diffmate conventions | [`code-review`](.cursor/skills/code-review/SKILL.md) | [`diffmate-code-review`](.claude/skills/diffmate-code-review/SKILL.md) |
| Pre-commit checklist (typecheck, tests, format) | [`pr-prepare`](.cursor/skills/pr-prepare/SKILL.md) | [`pr-prepare`](.claude/skills/pr-prepare/SKILL.md) |

The Claude Code review skill is named `diffmate-code-review`, not
`code-review`, to avoid colliding with Claude Code's own built-in
`/code-review` command.
