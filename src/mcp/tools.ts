// Engine
import { readUntrackedFile, resolveDiff } from '../engine/git.js'
import type { DiffScope } from '../engine/git.js'
import { startReviewServer } from '../engine/httpServer.js'
import type { ReviewServer } from '../engine/httpServer.js'
import { parseDiff, parseUntrackedFile } from '../engine/parseDiff.js'
import { ReviewSession } from '../engine/session.js'
import type { SessionAgentContext } from '../engine/session.js'

export interface McpDeps {
  uiDir: string
  openBrowser: (url: string) => void
}

export interface StartReviewArgs {
  base?: string
  staged?: boolean
  title?: string
  summary?: string
}

export interface StartReviewResult {
  sessionId: string
  url: string
  fileCount: number
  hunkCount: number
}

// One MCP process = one active review (PLAN.md). The controller enforces a
// single in-flight session: a second start_review while one is still running
// is a clear error, and completing a review frees the slot for a fresh one.
export class SessionController {
  private active: { session: ReviewSession; server: ReviewServer } | null = null

  async start(
    args: StartReviewArgs,
    deps: McpDeps,
  ): Promise<StartReviewResult> {
    if (this.active && !this.active.session.reviewComplete) {
      throw new Error(
        'A review is already active — submit it or let it finish before starting another.',
      )
    }

    const scope: DiffScope = args.staged
      ? { staged: true }
      : args.base
        ? { base: args.base }
        : {}
    const raw = await resolveDiff(scope)

    const files = parseDiff(raw.diffText)
    for (const relPath of raw.untrackedFiles) {
      const content = await readUntrackedFile(raw.repoRoot, relPath)
      files.push(parseUntrackedFile(relPath, content))
    }
    const hunkCount = files.reduce(
      (total, file) => total + file.hunks.length,
      0,
    )
    if (hunkCount === 0) {
      throw new Error(`No changes to review in ${raw.repoRoot}.`)
    }

    const agent: SessionAgentContext = {
      title: args.title ?? null,
      summary: args.summary ?? null,
    }
    const session = new ReviewSession('mcp', scope, files, agent)
    const server = await startReviewServer(session, deps.uiDir, raw.repoRoot)

    deps.openBrowser(server.url)
    this.active = { session, server }
    session.bus.once('review_complete', () => {
      this.active = null
      // Same lifecycle as the CLI: once the user submits, free the port.
      void server.close().catch(() => {})
    })

    return {
      sessionId: session.id,
      url: server.url,
      fileCount: files.length,
      hunkCount,
    }
  }
}
