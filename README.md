# diffmate

A local-first tool for reviewing AI-agent-generated code diffs before they
reach GitHub. Opens a browser UI to step through a diff hunk-by-hunk,
side-by-side, leave comments, and approve or reject individual hunks —
closer to Cursor's review panel than a raw `git diff`. For Claude Code
specifically, it also lets you ask the live agent session questions about
a change and get a real answer back, mid-review.

## Status

In progress. The harness-agnostic engine (git scope resolution, diff
parsing, the `ReviewSession` state/event model, the local REST/SSE HTTP
server) and the React review UI (`src/ui/`) are built and tested. The CLI
entry point and the Claude Code MCP server (phase 2) are still to come. See
[`docs/PLAN.md`](docs/PLAN.md) for the full design: architecture, package
layout, the phase 1 (harness-agnostic CLI review) and phase 2 (Claude
Code MCP live Q&A) build plan, and open risks.

## Why

Existing tools (`agent-diff-view` and similar) already nail side-by-side
diff viewing triggered from a coding harness, but they're a one-shot
blocking call: the CLI starts a server, waits for a single submit, and
exits. That shape can't support an explicit approve/reject decision per
hunk, or a live question-and-answer loop with the agent that actually wrote
the code. diffmate is a from-scratch rewrite that adds both, while keeping
the core review flow usable from any harness.

## Setup

Requires Node 18+.

```bash
npm install
```

`src/ui/` (the React review UI) is a separate package — its own
`package.json`/`tsconfig` with a different TypeScript config (bundler
resolution, JSX) and dependency policy than the engine — wired in as an
npm workspace, so this one `npm install` at the root covers both.

## Development

```bash
npm run typecheck   # tsc --noEmit — engine/cli/mcp/install (src/ui has its own, see below)
npm test             # node:test on src/engine, then vitest on src/ui
npm run format        # prettier --check .
```

`src/ui/`'s own scripts are reachable from the root via:

```bash
npm run dev:ui        # vite dev server with HMR (UI only, no live data)
npm run build:ui       # production build -> src/ui/dist
npm run lint:ui         # eslint
npm run test:ui          # vitest run
```

## Try it (demo)

The CLI entry point (`diffmate review`, milestone M7) and the structured
output builder (M6) aren't built yet, so there's no `diffmate` command to
run. What _is_ built — git diff resolution, parsing, the `ReviewSession`
state model, and the REST/SSE server — is enough to try the review UI
against a real repo with a small demo script:

```bash
npm run build:ui                 # only needed once, or after UI changes
npm run demo                      # reviews the working-tree diff of the current directory
npm run demo -- /path/to/a/repo    # or point it at any other git repo
```

This opens a browser tab against that repo's uncommitted changes (staged +
unstaged + untracked), lets you approve/reject/comment on hunks with the
full keyboard shortcuts, and on **Submit review** prints the final
per-hunk decisions to the terminal and shuts the server down. It's a stand-in
for the real CLI, not the CLI itself — no structured markdown/JSON output
yet (that's M6), and diffmate itself isn't a git repo yet, so `npm run demo`
with no argument won't work inside this project until one exists.

## Usage

Not yet implemented as a real CLI — see **Try it (demo)** above in the
meantime. Full usage instructions will be added once phase 1
(`docs/PLAN.md`, milestone M7) ships.
