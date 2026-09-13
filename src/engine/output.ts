// Engine
import type { ReviewSession } from './session.js'

// Types
import type { HunkStatus, Line, ReviewHunk } from './types.js'

const LINE_PREFIX: Record<Line['type'], string> = {
  add: '+',
  del: '-',
  context: ' ',
}

const NO_COMMENT = '(no comment provided)'

export interface Counts {
  approved: number
  rejected: number
  commented: number
  pending: number
  total: number
}

export interface ReviewEntry {
  hunkId: string
  filePath: string
  hunkHeader: string
  status: HunkStatus
  comment: string | null
  // The hunk's lines rendered back as unified-diff text, so consumers
  // (the CLI's markdown, the MCP agent reading JSON) see the code itself
  // without needing the original diff text.
  diff: string
}

export interface Report {
  counts: Counts
  // Phase-1 rules partition hunks into these three sections. Approved
  // without a comment and pending without a comment are intentionally
  // omitted — the former carries no feedback, the latter none either.
  approvedWithNotes: ReviewEntry[]
  rejected: ReviewEntry[]
  comments: ReviewEntry[]
}

export function buildReport(session: ReviewSession): Report {
  const approvedWithNotes: ReviewEntry[] = []
  const rejected: ReviewEntry[] = []
  const comments: ReviewEntry[] = []

  let approved = 0
  let rejectedCount = 0
  let pending = 0
  let commented = 0

  for (const file of session.files) {
    for (const hunk of file.hunks) {
      if (hunk.status === 'approved') approved++
      else if (hunk.status === 'rejected') rejectedCount++
      else pending++
      if (hunk.comment !== null) commented++

      if (hunk.status === 'approved' && hunk.comment === null) continue

      const entry = toEntry(file.path, hunk)
      if (hunk.status === 'rejected') {
        rejected.push(entry)
      } else if (hunk.comment !== null) {
        if (hunk.status === 'approved') approvedWithNotes.push(entry)
        else comments.push(entry)
      }
    }
  }

  const total = approved + rejectedCount + pending
  return {
    counts: { approved, rejected: rejectedCount, commented, pending, total },
    approvedWithNotes,
    rejected,
    comments,
  }
}

function renderDiff(hunk: ReviewHunk): string {
  return hunk.lines
    .map((line) => `${LINE_PREFIX[line.type]}${line.content}`)
    .join('\n')
}

function toEntry(filePath: string, hunk: ReviewHunk): ReviewEntry {
  return {
    hunkId: hunk.id,
    filePath,
    hunkHeader: hunk.header,
    status: hunk.status,
    comment: hunk.comment,
    diff: renderDiff(hunk),
  }
}

function renderEntry(entry: ReviewEntry): string {
  return [
    `### ${entry.filePath} (${entry.hunkHeader})`,
    '',
    '```diff',
    entry.diff,
    '```',
    '',
    `> ${entry.comment ?? NO_COMMENT}`,
  ].join('\n')
}

function renderSection(
  parts: string[],
  title: string,
  entries: ReviewEntry[],
): void {
  if (entries.length === 0) return
  parts.push('', `## ${title}`, '')
  for (const entry of entries) parts.push(renderEntry(entry), '')
}

export function renderMarkdown(report: Report): string {
  const parts: string[] = [
    '# diffmate review',
    '',
    '## Summary',
    '',
    `- **Approved:** ${report.counts.approved}`,
    `- **Rejected:** ${report.counts.rejected}`,
    `- **Commented:** ${report.counts.commented}`,
    `- **Pending:** ${report.counts.pending}`,
  ]

  renderSection(parts, 'Approved (with notes)', report.approvedWithNotes)
  renderSection(parts, 'Rejected', report.rejected)
  renderSection(parts, 'Comments', report.comments)

  return `${parts.join('\n').trimEnd()}\n`
}

export function renderJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

export function buildMarkdown(session: ReviewSession): string {
  return renderMarkdown(buildReport(session))
}

export function buildJson(session: ReviewSession): string {
  return renderJson(buildReport(session))
}
