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

## Usage

Not yet implemented — usage instructions will be added once phase 1
(`docs/PLAN.md`, milestone M7) ships.
