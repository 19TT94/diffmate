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

interface HunkLocation {
  file: ReviewFile
  hunk: ReviewHunk
}

// Attaches fresh review state to freshly-parsed diff data; every hunk starts
// pending with no comment/questions regardless of what a prior session did.
function toReviewFile(file: ParsedFile): ReviewFile {
  return {
    ...file,
    hunks: file.hunks.map((hunk): ReviewHunk => ({
      ...hunk,
      status: 'pending',
      comment: null,
      questions: [],
    })),
  }
}

export class ReviewSession {
  readonly id: string
  readonly mode: SessionMode
  readonly scope: DiffScope
  readonly files: ReviewFile[]
  // Generic pub/sub, not a single resolve-once promise: phase 1's CLI waits
  // on 'review_complete' the same way phase 2's MCP wait_for_activity will,
  // without this class needing to change shape between the two.
  readonly bus: EventEmitter
  reviewComplete: boolean

  // Hunk/question ids are opaque strings, not array indices, because the
  // REST routes and MCP tools address them by id (a browser tab or the MCP
  // agent may only know the id, not where it lives in `files`).
  private readonly hunksById: Map<string, HunkLocation>
  private readonly questionsById: Map<string, Question>

  constructor(mode: SessionMode, scope: DiffScope, files: ParsedFile[]) {
    this.id = randomUUID()
    this.mode = mode
    this.scope = scope
    this.files = files.map(toReviewFile)
    this.bus = new EventEmitter()
    this.reviewComplete = false

    this.hunksById = new Map()
    this.questionsById = new Map()
    for (const file of this.files) {
      for (const hunk of file.hunks) {
        this.hunksById.set(hunk.id, { file, hunk })
      }
    }
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

  askQuestion(hunkId: string, text: string): Question {
    const { hunk } = this.requireHunk(hunkId)
    const question: Question = {
      id: randomUUID(),
      hunkId,
      text,
      askedAt: Date.now(),
      answer: null,
      answeredAt: null,
    }
    hunk.questions.push(question)
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
}
