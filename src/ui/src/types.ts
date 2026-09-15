// Mirrors the JSON shape served by engine/httpServer.ts (engine/types.ts on
// the server side). Duplicated rather than imported: the UI is a separate
// Vite package from the Node engine and only ever sees this data as JSON.

export type LineType = 'context' | 'add' | 'del'

export interface DiffLine {
  type: LineType
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
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

export interface Hunk {
  id: string
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
  status: HunkStatus
  // Agent-authored rationale for this hunk (context + decision). Distinct
  // from `comment` (reviewer feedback).
  // TODO: wire generation/population from the agent or CLI session.
  summary: string | null
  comment: string | null
  editedContent: string | null
  questions: Question[]
}

export type FileStatus =
  'modified' | 'added' | 'deleted' | 'renamed' | 'unsupported'

export interface ReviewFile {
  path: string
  oldPath: string | null
  status: FileStatus
  binary: boolean
  hunks: Hunk[]
}

export type SessionMode = 'cli' | 'mcp'

export interface DiffScope {
  staged?: boolean
  base?: string
}

export interface ReviewSessionSummary {
  id: string
  mode: SessionMode
  scope: DiffScope
  files: ReviewFile[]
  reviewComplete: boolean
}
