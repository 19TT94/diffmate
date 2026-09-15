export type LineType = 'context' | 'add' | 'del'

export interface Line {
  type: LineType
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

// A contiguous block of changed lines within a file's diff (one `@@ ... @@`
// section). This is the unit of review: decisions are per-hunk, not per-file.
export interface Hunk {
  id: string
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: Line[]
}

export type FileStatus =
  'modified' | 'added' | 'deleted' | 'renamed' | 'unsupported'

export interface ParsedFile {
  path: string
  oldPath: string | null
  status: FileStatus
  binary: boolean
  hunks: Hunk[]
}

export type HunkStatus = 'pending' | 'approved' | 'rejected'

export interface Question {
  id: string
  hunkId: string
  text: string
  askedAt: number
  answer: string | null
  answeredAt: number | null
}

// Review state attaches to the hunk, not the file, so a file with mixed
// approved/rejected hunks is representable without a separate diffing pass.
export interface ReviewHunk extends Hunk {
  status: HunkStatus
  // Agent-authored rationale for this hunk: relevant context and the
  // decision that led to the change. Distinct from `comment`, which is
  // reviewer feedback for the agent.
  // TODO: populate when the agent (or CLI) supplies per-hunk summaries —
  // currently always null at session creation.
  summary: string | null
  comment: string | null
  // A user-proposed rewrite of the hunk's new-side code, attached as review
  // feedback for the agent to read and apply itself — never written to
  // disk, same as `comment`.
  editedContent: string | null
  questions: Question[]
}

export interface ReviewFile {
  path: string
  oldPath: string | null
  status: FileStatus
  binary: boolean
  hunks: ReviewHunk[]
}

export type SessionMode = 'cli' | 'mcp'
