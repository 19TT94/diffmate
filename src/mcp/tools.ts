// Engine
import { readUntrackedFile, resolveDiff } from '../engine/git.js'
import type { DiffScope } from '../engine/git.js'
import { startReviewServer } from '../engine/httpServer.js'
import type { ReviewServer } from '../engine/httpServer.js'
import { buildReport, renderMarkdown } from '../engine/output.js'
import type { Report } from '../engine/output.js'
import { parseDiff, parseUntrackedFile } from '../engine/parseDiff.js'
import { ReviewSession } from '../engine/session.js'
import type { SessionAgentContext } from '../engine/session.js'

// Types
import type { Question } from '../engine/types.js'

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

export interface WaitForActivityArgs {
  sessionId: string
  timeoutSeconds?: number
}

export type Activity =
  | {
      type: 'no_activity'
      pending: number
      decided: number
      // Seconds since the reviewer last did anything (or since start).
      idleSeconds: number
    }
  | {
      type: 'question'
      questionId: string
      hunkId: string
      filePath: string
      hunkHeader: string
      questionText: string
    }
  | { type: 'review_complete'; decisions: Report; summaryMarkdown: string }

export interface AnswerQuestionArgs {
  sessionId: string
  questionId: string
  answer: string
}

export interface EndReviewArgs {
  sessionId: string
  reason?: string
}

const DEFAULT_TIMEOUT_SECONDS = 20
// 25s held up in a live Claude Code session, but the real MCP tool-call
// timeout hasn't been measured (docs/PLAN.md Risks), so stay well under the
// commonly cited ~60s.
const MAX_TIMEOUT_SECONDS = 25

export function clampTimeoutSeconds(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TIMEOUT_SECONDS
  return Math.min(Math.max(value, 0), MAX_TIMEOUT_SECONDS)
}

interface ActiveReview {
  session: ReviewSession
  server: ReviewServer
  // Questions the agent hasn't been handed yet. Lives here rather than in
  // the session so the engine's bus stays generic.
  undelivered: Question[]
  lastActivityAt: number
  unsubscribe: () => void
}

// Browser-side events that count as the reviewer being active.
const REVIEWER_EVENTS = ['hunk_updated', 'question_asked'] as const

export interface SessionControllerOptions {
  now?: () => number
}

// One MCP process = one active review (PLAN.md). A review stays live after
// the user submits — the agent still has to collect review_complete through
// wait_for_activity, and end_review still has a browser to notify — until
// end_review, a replacing start_review, or process exit.
export class SessionController {
  private current: ActiveReview | null = null
  // Claimed synchronously so concurrent start_review calls can't both pass
  // the active check while the first is still awaiting git.
  private starting = false
  private readonly now: () => number

  constructor(options: SessionControllerOptions = {}) {
    this.now = options.now ?? Date.now
  }

  async start(
    args: StartReviewArgs,
    deps: McpDeps,
  ): Promise<StartReviewResult> {
    if (
      this.starting ||
      (this.current && !this.current.session.reviewComplete)
    ) {
      throw new Error(
        'A review is already active — submit it or let it finish before starting another.',
      )
    }
    this.starting = true
    try {
      return await this.startUnlocked(args, deps)
    } finally {
      this.starting = false
    }
  }

  private async startUnlocked(
    args: StartReviewArgs,
    deps: McpDeps,
  ): Promise<StartReviewResult> {
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

    // A submitted review the agent never ended is replaced, not leaked.
    await this.close()

    const agent: SessionAgentContext = {
      title: args.title ?? null,
      summary: args.summary ?? null,
    }
    const session = new ReviewSession('mcp', scope, files, agent)
    const server = await startReviewServer(session, deps.uiDir, raw.repoRoot)
    const queue = (question: Question): void => {
      review.undelivered.push(question)
    }
    const touch = (): void => {
      review.lastActivityAt = this.now()
    }
    const review: ActiveReview = {
      session,
      server,
      undelivered: [],
      lastActivityAt: this.now(),
      unsubscribe: () => {
        session.bus.off('question_asked', queue)
        for (const event of REVIEWER_EVENTS) session.bus.off(event, touch)
      },
    }
    session.bus.on('question_asked', queue)
    for (const event of REVIEWER_EVENTS) session.bus.on(event, touch)
    this.current = review

    deps.openBrowser(server.url)
    return {
      sessionId: session.id,
      url: server.url,
      fileCount: files.length,
      hunkCount,
    }
  }

  // Long-poll: resolves with the next piece of activity, or no_activity once
  // the timeout passes. review_complete wins over undelivered questions —
  // after submit there's nobody waiting on an answer.
  async waitForActivity(args: WaitForActivityArgs): Promise<Activity> {
    const review = this.requireReview(args.sessionId)
    const immediate = nextActivity(review)
    if (immediate) return immediate

    const { bus } = review.session
    return new Promise<Activity>((resolve) => {
      const finish = (activity: Activity): void => {
        clearTimeout(timer)
        bus.off('question_asked', onActivity)
        bus.off('review_complete', onActivity)
        resolve(activity)
      }
      const onActivity = (): void => {
        const activity = nextActivity(review)
        if (activity) finish(activity)
      }
      const timer = setTimeout(
        () => finish(this.noActivity(review)),
        clampTimeoutSeconds(args.timeoutSeconds) * 1000,
      )
      // Registered after the controller's own question_asked listener, so
      // the question is already queued when this runs.
      bus.on('question_asked', onActivity)
      bus.on('review_complete', onActivity)
    })
  }

  answerQuestion(args: AnswerQuestionArgs): { ok: true } {
    const review = this.requireReview(args.sessionId)
    review.session.answerQuestion(args.questionId, args.answer)
    return { ok: true }
  }

  async endReview(args: EndReviewArgs): Promise<{ ok: true }> {
    const review = this.requireReview(args.sessionId)
    review.session.end(args.reason ?? null)
    await this.close()
    return { ok: true }
  }

  // Frees the current review's server, if any. Also used on process exit.
  async close(): Promise<void> {
    const review = this.current
    if (!review) return
    this.current = null
    review.unsubscribe()
    await review.server.close().catch(() => {})
  }

  private noActivity(review: ActiveReview): Activity {
    const hunks = review.session.files.flatMap((file) => file.hunks)
    const pending = hunks.filter((hunk) => hunk.status === 'pending').length
    return {
      type: 'no_activity',
      pending,
      decided: hunks.length - pending,
      idleSeconds: Math.floor((this.now() - review.lastActivityAt) / 1000),
    }
  }

  private requireReview(sessionId: string): ActiveReview {
    if (!this.current || this.current.session.id !== sessionId) {
      throw new Error(`Unknown session: ${sessionId}`)
    }
    return this.current
  }
}

function nextActivity(review: ActiveReview): Activity | null {
  const { session } = review
  if (session.reviewComplete) {
    const decisions = buildReport(session)
    return {
      type: 'review_complete',
      decisions,
      summaryMarkdown: renderMarkdown(decisions),
    }
  }
  const question = review.undelivered.shift()
  if (!question) return null
  const file = session.files.find((candidate) =>
    candidate.hunks.some((hunk) => hunk.id === question.hunkId),
  )
  const hunk = file?.hunks.find((candidate) => candidate.id === question.hunkId)
  return {
    type: 'question',
    questionId: question.id,
    hunkId: question.hunkId,
    filePath: file?.path ?? '',
    hunkHeader: hunk?.header ?? '',
    questionText: question.text,
  }
}
