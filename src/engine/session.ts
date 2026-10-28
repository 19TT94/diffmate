import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'

// Engine
import type { DiffScope } from './git.js'

// Types
import type {
  HunkStatus,
  ParsedFile,
  Question,
  ReviewFile,
  ReviewHunk,
  SessionMode,
} from './types.js'

export interface HunkLocation {
  file: ReviewFile
  hunk: ReviewHunk
}

// Attaches fresh review state to freshly-parsed diff data; every hunk starts
// pending with no summary/comment regardless of what a prior session did.
function toReviewFile(file: ParsedFile): ReviewFile {
  return {
    ...file,
    notes: null,
    hunks: file.hunks.map((hunk): ReviewHunk => ({
      ...hunk,
      status: 'pending',
      // Filled from the agent's hunkSummaries, if any, after construction.
      summary: null,
      comment: null,
      editedContent: null,
    })),
  }
}

// The agent's framing of the review, shown in the UI so the reviewer sees
// what the agent was doing and why before judging individual hunks. Only
// phase 2's MCP start_review supplies it; CLI reviews leave it null.
export interface SessionAgentContext {
  title: string | null
  summary: string | null
  // Per-hunk "why" from the agent, shown as each hunk's Explanation.
  hunkSummaries?: HunkSummaryInput[]
}

// Addresses a hunk the way an agent sees its own diff: by file path and the
// hunk's 1-based position within that file, in `git diff` order (a new
// untracked file is one hunk).
export interface HunkSummaryInput {
  path: string
  hunk: number
  summary: string
}

export class ReviewSession {
  readonly id: string
  readonly mode: SessionMode
  readonly scope: DiffScope
  readonly files: ReviewFile[]
  readonly title: string | null
  readonly summary: string | null
  // Generic pub/sub, not a single resolve-once promise: phase 1's CLI waits
  // on 'review_complete' the same way phase 2's MCP wait_for_activity will,
  // without this class needing to change shape between the two.
  readonly bus: EventEmitter
  reviewComplete: boolean
  // Hunk summaries that matched no hunk, kept so the agent can be told.
  readonly unmatchedSummaries: HunkSummaryInput[]
  // The review's one conversation, in the order questions were asked; each
  // is about a hunk or (hunkId null) the whole review.
  readonly questions: Question[]

  // Hunk/question ids are opaque strings, not array indices, because the
  // REST routes and MCP tools address them by id (a browser tab or the MCP
  // agent may only know the id, not where it lives in `files`).
  private readonly hunksById: Map<string, HunkLocation>
  private readonly questionsById: Map<string, Question>

  constructor(
    mode: SessionMode,
    scope: DiffScope,
    files: ParsedFile[],
    agent: SessionAgentContext = { title: null, summary: null },
  ) {
    this.id = randomUUID()
    this.mode = mode
    this.scope = scope
    const reviewFiles = files.map(toReviewFile)
    this.title = agent.title
    this.summary = agent.summary
    this.bus = new EventEmitter()
    this.reviewComplete = false
    this.questions = []
    this.unmatchedSummaries = []
    // The agent lists summaries in the order a reviewer should walk the
    // change, so files go in the order they're first matched; the rest
    // follow in git order. Hunks within a file keep git order.
    const walkthrough = new Set<ReviewFile>()
    for (const input of agent.hunkSummaries ?? []) {
      const file = reviewFiles.find(
        (candidate) => candidate.path === input.path,
      )
      const hunk = file?.hunks[input.hunk - 1]
      if (file && hunk) {
        hunk.summary = input.summary
        walkthrough.add(file)
      } else {
        this.unmatchedSummaries.push(input)
      }
    }
    this.files = [
      ...walkthrough,
      ...reviewFiles.filter((file) => !walkthrough.has(file)),
    ]

    this.hunksById = new Map()
    this.questionsById = new Map()
    for (const file of this.files) {
      for (const hunk of file.hunks) {
        this.hunksById.set(hunk.id, { file, hunk })
      }
    }
  }

  findHunk(hunkId: string): HunkLocation | null {
    return this.hunksById.get(hunkId) ?? null
  }

  private requireHunk(hunkId: string): HunkLocation {
    const location = this.hunksById.get(hunkId)
    if (!location) {
      throw new Error(`Unknown hunk: ${hunkId}`)
    }
    return location
  }

  setHunkStatus(hunkId: string, status: HunkStatus): void {
    const { hunk } = this.requireHunk(hunkId)
    hunk.status = status
    this.bus.emit('hunk_updated', { hunkId, status })
  }

  setHunkComment(hunkId: string, comment: string | null): void {
    const { hunk } = this.requireHunk(hunkId)
    hunk.comment = comment
    this.bus.emit('hunk_updated', { hunkId, comment })
  }

  setHunkEditedContent(hunkId: string, editedContent: string | null): void {
    const { hunk } = this.requireHunk(hunkId)
    hunk.editedContent = editedContent
    this.bus.emit('hunk_updated', { hunkId, editedContent })
  }

  // Out-of-hunk reviewer edits for a file. No bus emit: this is written
  // during the submit flush, and the report is built from session state
  // after the flush's POSTs complete.
  setFileNotes(filePath: string, notes: string | null): void {
    const file = this.files.find((candidate) => candidate.path === filePath)
    if (!file) {
      throw new Error(`Unknown file: ${filePath}`)
    }
    file.notes = notes
  }

  // A null hunkId asks about the whole review.
  askQuestion(hunkId: string | null, text: string): Question {
    if (hunkId !== null) this.requireHunk(hunkId)
    const question: Question = {
      id: randomUUID(),
      hunkId,
      text,
      askedAt: Date.now(),
      answer: null,
      answeredAt: null,
    }
    this.questions.push(question)
    this.questionsById.set(question.id, question)
    this.bus.emit('question_asked', question)
    return question
  }

  answerQuestion(questionId: string, answer: string): Question {
    const question = this.questionsById.get(questionId)
    if (!question) {
      throw new Error(`Unknown question: ${questionId}`)
    }
    question.answer = answer
    question.answeredAt = Date.now()
    this.bus.emit('question_answered', question)
    return question
  }

  complete(): void {
    this.reviewComplete = true
    this.bus.emit('review_complete', { sessionId: this.id })
  }

  // The agent is done with this review (phase 2's end_review), whether or
  // not it was submitted. Lets the browser stop waiting on a dead session.
  end(reason: string | null): void {
    this.bus.emit('review_ended', { sessionId: this.id, reason })
  }
}
