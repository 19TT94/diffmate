# diffmate — implementation plan

## Context

Reviewing AI-agent-generated diffs today means either eyeballing a terminal
diff or pushing to GitHub first. `agent-diff-view` (MIT, npm) comes closest
to the workflow wanted: a local browser UI, side-by-side hunk-by-hunk
stepping, triggered from inside the coding harness. It already nails the
diff-viewing UX, but it's architecturally a one-shot blocking call — the CLI
starts a server, blocks for a single `/submit`, and exits. That shape can't
support two things wanted on top of it: an explicit approve/reject decision
per hunk (Cursor-style), and asking the *actual agent session that wrote the
diff* a question and getting a real answer back — not a comment queued for
later.

**diffmate** is a from-scratch rewrite (not a fork — MIT license means we
could borrow code, but we're building diffmate's own codebase, using the
reference tool only as a UX/parsing reference) that adds both. Confirmed
name (unclaimed on npm), confirmed direction on the three open questions
from the original handoff:

1. **Live Q&A = Option A** — a real MCP server so the browser can talk to
   the live Claude Code session, not a fresh scoped LLM call.
2. **Rewrite from scratch**, not a literal fork of agent-diff-view.
3. **Harness scope** — the core review flow (diff parsing, side-by-side UI,
   approve/reject, comments, structured output) stays harness-agnostic, the
   same way the reference tool's one-shot CLI mode works from any harness.
   Live Q&A is Claude Code–only for now, layered on top via MCP.

The design below keeps those two front ends (a harness-agnostic one-shot CLI,
and a Claude Code–specific MCP server) as thin wrappers over one shared
engine, so phase 2 doesn't require reworking phase 1.

## Package layout

```
diffmate/
  bin/diffmate.js              # shebang shim -> dist/cli/index.js
  src/
    cli/index.ts               # phase 1 entry: `diffmate` / `diffmate review`
    cli/args.ts                # --staged / --base <ref> / --json
    mcp/server.ts              # phase 2 entry: `diffmate mcp` (stdio transport)
    mcp/tools.ts                # tool schemas + handlers over the engine
    engine/git.ts               # shell out to git, resolve diff scope
    engine/parseDiff.ts         # unified diff text -> File[]/Hunk[]
    engine/session.ts           # ReviewSession: state + event bus
    engine/httpServer.ts        # local HTTP server: REST + SSE + static UI
    engine/output.ts            # final markdown/JSON feedback builder
    engine/types.ts             # File, Hunk, Question, Session, Events
    install/installClaudeCode.ts # `diffmate install`: .mcp.json + slash cmd
    ui/                          # React + TypeScript + styled-components
      package.json / tsconfig*.json / vite.config.ts / eslint.config.js
      src/main.tsx, App.tsx, components/, components/ui/, hooks/, lib/,
          styles/, types.ts (mirrors engine/types.ts's JSON shape)
  package.json / tsconfig.json
```

`src/ui/` is a separate Vite package (own `package.json`, own
`tsconfig.json`) built with `npm run build:ui`, producing `src/ui/dist` —
the directory `httpServer.ts`'s `uiDir` points at. It is intentionally not
under the root `tsconfig.json` program (excluded there) since it uses
bundler module resolution and JSX, unlike the Node-ESM engine/CLI/MCP code.
Conventions: `.cursor/rules/diffmate-ui.mdc`.

One `bin` (`diffmate`) with subcommands (`review` default, `mcp`, `install`)
rather than multiple entries, so `.mcp.json` can just point at
`npx diffmate mcp`.

## Tech choices

Engine/CLI/MCP (root package):

- **TypeScript**, compiled with `esbuild`, targeting Node 18+.
- **One runtime dependency**: `@modelcontextprotocol/sdk` (verified on npm,
  currently v1.30.0) — hand-rolling MCP's JSON-RPC framing isn't worth it.
  Everything else is Node builtins: `node:http` (no Express — few enough
  routes for a manual switch), `node:child_process` (`execFile('git', …)`),
  `node:crypto` (ids/session token), `node:events` (the pub/sub bus shared
  by SSE and the MCP long-poll).
- **Git access via shelling out**, not a JS git library (`simple-git` etc.)
  — matches the reference tool, avoids a heavy dependency, and git is
  already a hard requirement for diffmate to exist at all.
- Dev-only: `typescript`, `esbuild`, `node:test` (no extra test-runner dep).

UI (`src/ui/`, its own package):

- **React 19 + TypeScript + styled-components 6**, built with **Vite**.
  Chosen to match the maintainer's other apps (e.g. DevTab) rather than the
  originally-planned "vanilla JS, no build step" approach — a deliberate
  tradeoff of the zero-build-step pitch for consistency with an existing,
  proven component/styling convention. Conventions (theme tokens, transient
  `$`-prop pattern, import groups, component/test layout):
  `.cursor/rules/diffmate-ui.mdc`.
- No router, no TanStack Query: single-screen app against one
  `ReviewSession`, so neither earns its keep here the way it does in a
  multi-route CRUD app.
- Dev-only: `vitest` + `@testing-library/react` for colocated `__test__/`
  component/hook tests; `eslint` (flat config, `typescript-eslint` +
  `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`).
- Talks to the engine purely over the REST/SSE contract `httpServer.ts`
  already exposes — no shared build step or type import between the two
  packages (`src/ui/src/types.ts` duplicates the wire shape as plain JSON
  types).

## Diff parsing

Never mutate git state (no `git add -N`, no touching the index).

- Default (uncommitted changes): `git --no-pager diff --no-color -U3 HEAD`
  (staged + unstaged) plus untracked files from
  `git ls-files --others --exclude-standard`, each synthesized into a
  pseudo-hunk (whole file read via `fs.readFileSync`, rendered as one
  "all lines added" hunk) rather than invoked through git.
- `--staged`: `git --no-pager diff --no-color -U3 --cached`.
- `--base <ref>`: `git --no-pager diff --no-color -U3 <ref>...` (triple-dot
  merge-base semantics, so a feature branch diffs correctly even if the
  base has moved on).

Always `execFile` (never `exec`), `cwd` resolved via
`git rev-parse --show-toplevel`, fail fast with a clear message outside a
repo or with nothing to review.

`parseDiff.ts`: split on `diff --git ` boundaries → per-file header parsing
(`--- a/`, `+++ b/`, rename/new/delete markers, `Binary files ... differ`)
into a `File` record with a `status`; split the body on
`@@ -l,s +l,s @@` into `Hunk`s. Unified diff hunks already interleave
removals-then-additions per change block, so side-by-side columns can be
built positionally — no LCS/alignment algorithm needed for v1. Submodules
and symlinks: flag and skip content rendering rather than diffing them.

## Session/state model

One `ReviewSession` per process, in memory only (no persistence — matches
the tool's ephemeral, local-first nature):

```
ReviewSession {
  id, mode: 'cli' | 'mcp', scope: { staged?, base? }
  files: File[]
    File { path, oldPath?, status, binary, hunks: Hunk[] }
      Hunk {
        id, header, lines: Line[],
        status: 'pending' | 'approved' | 'rejected',
        comment: string | null,
        questions: Question[]
      }
        Question { id, hunkId, text, askedAt, answer, answeredAt }
  bus: EventEmitter   // generic pub/sub, backs both SSE and MCP long-poll
  reviewComplete: boolean
}
```

Build the `bus` as a generic event queue from the start, even though phase 1
only ever emits one `review_complete` event — this is what lets phase 2's
`wait_for_activity` subscribe without reworking `session.ts` later.

## Phase 1 — one-shot CLI mode (harness-agnostic)

Flow: parse args → resolve diff scope → build `ReviewSession` (`mode:
'cli'`) → if no hunks, print "no changes to review" and exit 0 → start HTTP
server on `127.0.0.1:0` (ephemeral port, random session token in the URL as
defense-in-depth since there's no other auth) → open browser → block on a
promise resolved by `POST /api/submit` → build structured output → print to
stdout → exit.

UI: file list sidebar with per-file status badge (pending/approved/
rejected/mixed) and +/− stat; side-by-side before/after panes per hunk;
per-hunk toolbar (Approve / Reject / Reset) + comment textarea; file-level
bulk approve/reject. Keyboard shortcuts match the reference tool (⌘←/⌘→ hunk
nav, ⌘↑/⌘↓ file nav, ⌘↵ submit) plus new ones: `a` approve, `r` reject, `c`
focus comment box.

Structured output rules on submit (markdown by default, `--json` for a
machine-readable variant):
- Header: counts (approved / rejected / commented / pending).
- **Approved, no comment** → excluded entirely.
- **Approved, with comment** → included under "Approved (with notes)" so a
  comment is never silently dropped.
- **Rejected** → always included, even with no comment ("(no comment
  provided)"), under "Rejected".
- **Pending, with comment** → included under "Comments".
- **Pending, no comment** → omitted.
- Each entry: `### path/to/file.ts (@@ -12,6 +12,8 @@)` + quoted hunk +
  comment.

Phase 1 is a complete, standalone-valuable tool on its own — worth shipping
as v0.1 before starting phase 2.

## Phase 2 — MCP server mode (Claude Code only)

Transport: **stdio**, registered per-project in `.mcp.json`. Claude Code
spawns stdio MCP servers tied to that session's lifetime, so one MCP process
= one active `ReviewSession`, no daemon or multi-session handling needed for
v1 (a second `start_review` while one is active errors clearly).

Tools:
- **`start_review`** `{ base?, staged?, title? }` → builds the session
  (`mode: 'mcp'`), starts the server, opens the browser, returns
  immediately (non-blocking) with `{ sessionId, url, fileCount, hunkCount }`.
- **`wait_for_activity`** `{ sessionId, timeoutSeconds? (~20-25 default) }`
  → long-poll on the session's bus. Returns `{ type: 'no_activity' }` (agent
  calls again immediately — this is the poll/wait loop, not busy-polling,
  since the block happens server-side), `{ type: 'question', questionId,
  hunkId, filePath, hunkHeader, questionText }` (drained one at a time), or
  `{ type: 'review_complete', decisions: {...}, summaryMarkdown }`
  (terminal — agent stops looping).
- **`answer_question`** `{ sessionId, questionId, answer }` → stores the
  answer, pushes it down to the right browser tab via SSE keyed by
  `questionId`, returns `{ ok: true }`.
- **`end_review`** `{ sessionId, reason? }` → not required for process
  cleanup (closing the stdio pipe already tears the process down), but
  worth having: sends a final SSE event so the browser shows "review ended,
  agent is acting on this now" instead of sitting in a stale waiting state.

Correlation is two independent one-directional channels on the same
in-memory session, keyed by `questionId`: browser → agent is
`POST /api/questions` (returns `202` immediately, doesn't block on an
answer, just enqueues for the next `wait_for_activity`); agent → browser is
`answer_question` writing to session state and emitting on the bus, picked
up by the browser's open `GET /api/events` SSE connection. A
`GET /api/session` endpoint reports `mode: 'cli' | 'mcp'` so the UI can
show/hide the "ask the agent" box without a separate build.

Installation (`diffmate install`):
1. Merge a `diffmate` entry into project-root `.mcp.json`
   (`{ "command": "npx", "args": ["diffmate", "mcp"] }`), creating it if
   absent.
2. Write `.claude/commands/diffmate-review.md` as a **project-local** slash
   command (deliberately not global like the reference tool's
   `~/.claude/commands/` — the MCP registration is project-scoped, so a
   global command would break in repos without it). It instructs the exact
   loop: `start_review` → loop `wait_for_activity` → on `question`, answer
   from the agent's own knowledge of why it made that change, call
   `answer_question`, loop again; on `no_activity`, loop again without
   narrating; on `review_complete`, stop, leave approved hunks untouched,
   address every rejected hunk (comment = the requested change), factor in
   comments on pending hunks, call `end_review`, summarize what changed.

## Build order

- **M0** scaffold (package.json/tsconfig/build script). **Done.**
- **M1** `git.ts` (scope resolution, untracked files) — independent. **Done.**
- **M2** `parseDiff.ts` + `types.ts`, tested against canned diff fixtures —
  independent of M1, can run in parallel. **Done.**
- **M3** `session.ts` (`ReviewSession` + the generic event bus) — depends on
  M2. **Done.**
- **M4** `httpServer.ts` (REST + static UI serving) — depends on M3.
  **Done.**
- **M5** UI — React + TypeScript + styled-components (Vite), its own
  package under `src/ui/` (file list, side-by-side hunks, approve/reject,
  comments, shortcuts). Talks to the REST/SSE contract M4 exposes; can
  start in parallel against a mock. Largest single chunk of work. **Done**,
  built with `npm run build:ui` (output: `src/ui/dist`).
- **M6** `output.ts` (feedback builder per phase-1 rules) — depends on M3.
- **M7** `cli/index.ts` (wire it all together) — **phase 1 shippable here,
  recommend publishing v0.1**.
- **M8** MCP server + four tools, reusing the engine unchanged (should
  require no rework if M3's bus was built generically) — depends on M3/M4.
- **M9** UI additions for Q&A (ask box, threaded display, SSE client, mode
  detection) — depends on M8.
- **M10** `diffmate install` (`.mcp.json` merge + slash command).
- **M11** docs, real end-to-end test against an actual Claude Code session,
  publish v0.2.

## Risks / open questions to watch

- **Claude Code's MCP tool-call timeout is an unverified constraint** that
  directly bounds how long `wait_for_activity` can safely block. Start
  conservative (~20-25s) and verify empirically against a real Claude Code
  session before relying on a number.
- **Tool-approval prompt fatigue** — if `wait_for_activity` isn't
  allowlisted, Claude Code may prompt for approval every ~20s. `diffmate
  install` should document (or attempt to configure) auto-approval for
  diffmate's tools.
- **Browser tab closed mid-review** — no reliable close signal. Detect SSE
  disconnect but don't auto-complete the review on it (that would make
  `wait_for_activity` loop `no_activity` forever with no exit); add an idle
  ceiling that emits `review_abandoned` after N minutes of no activity.
- **Concurrent sessions are explicitly out of scope for v1** — one session
  per process, ephemeral ports (`listen(0)`) to avoid collisions.
- **Semantics clarity** — "reject" is a signal only; diffmate never mutates
  files or runs git commands beyond reading diffs. Make this explicit in UI
  copy so it's never mistaken for an auto-revert.
- **`@modelcontextprotocol/sdk` version churn** — MCP is still evolving; pin
  a version, expect to revisit compatibility later.

## Verification

- **Phase 1**: `npm link`, run `diffmate` inside a repo with uncommitted
  changes, confirm side-by-side rendering, approve/reject/comment a few
  hunks, submit, and check the printed markdown matches the rules above
  (approved-no-comment excluded, rejected always shown, etc). Test
  `--staged` and `--base <ref>` scopes, and an untracked-file case.
- **Phase 2**: register the MCP server against a real Claude Code session
  in a scratch repo, run `/diffmate-review`, ask a question from the
  browser mid-review, confirm the answer round-trips back to the correct
  hunk's thread, submit, and confirm the agent's loop terminates on
  `review_complete` and acts only on rejected/commented hunks.
