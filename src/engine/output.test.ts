import assert from 'node:assert/strict'
import { test } from 'node:test'

// Engine
import { buildMarkdown, buildReport, renderJson } from './output.js'
import { ReviewSession } from './session.js'

// Types
import type { Hunk, ParsedFile } from './types.js'

// Fixture: one approved-no-comment, one approved-with-comment, two rejected
// (one commented), one pending-no-comment, one pending-with-comment — every
// status/comment combination the phase-1 rules have to distinguish.
function fixtureFiles(): ParsedFile[] {
  const hunk = (id: string): Hunk => ({
    id,
    header: `@@ ${id} @@`,
    oldStart: 1,
    oldLines: 2,
    newStart: 1,
    newLines: 2,
    lines: [
      {
        type: 'context',
        content: 'alpha',
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      { type: 'add', content: 'beta', oldLineNumber: null, newLineNumber: 2 },
    ],
  })
  const file = (path: string, hunks: Hunk[]): ParsedFile => ({
    path,
    oldPath: null,
    status: 'modified',
    binary: false,
    hunks,
  })

  return [
    file('a.txt', [hunk('a1'), hunk('a2')]),
    file('b.ts', [hunk('b1'), hunk('b2')]),
    file('c.js', [hunk('c1'), hunk('c2')]),
  ]
}

function reviewedSession(): ReviewSession {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  session.setHunkStatus('a1', 'approved')
  session.setHunkStatus('a2', 'approved')
  session.setHunkComment('a2', 'keep')
  session.setHunkStatus('b1', 'rejected')
  session.setHunkStatus('b2', 'rejected')
  session.setHunkComment('b2', 'rework')
  session.setHunkComment('c2', 'clarify?')
  return session
}

test('buildReport counts every category across all hunks', () => {
  const report = buildReport(reviewedSession())

  assert.deepEqual(report.counts, {
    approved: 2,
    rejected: 2,
    commented: 3,
    pending: 2,
    total: 6,
  })
})

test('buildReport partitions hunks per the phase-1 rules', () => {
  const report = buildReport(reviewedSession())

  assert.deepEqual(
    report.approvedWithNotes.map((entry) => entry.hunkId),
    ['a2'],
  )
  assert.deepEqual(
    report.rejected.map((entry) => entry.hunkId),
    ['b1', 'b2'],
  )
  assert.deepEqual(
    report.comments.map((entry) => entry.hunkId),
    ['c2'],
  )
})

test('buildReport omits approved-no-comment and pending-no-comment hunks', () => {
  const report = buildReport(reviewedSession())

  const seen = report.approvedWithNotes
    .concat(report.rejected, report.comments)
    .map((entry) => entry.hunkId)
  assert.ok(!seen.includes('a1'))
  assert.ok(!seen.includes('c1'))
})

test('entries carry the rendered unified-diff body', () => {
  const report = buildReport(reviewedSession())
  const [entry] = report.approvedWithNotes

  assert.equal(entry!.filePath, 'a.txt')
  assert.equal(entry!.hunkHeader, '@@ a2 @@')
  assert.equal(entry!.comment, 'keep')
  assert.equal(entry!.diff, ' alpha\n+beta')
})

test('renderMarkdown emits the summary header with counts', () => {
  const markdown = buildMarkdown(reviewedSession())

  assert.ok(markdown.startsWith('# diffmate review\n'))
  assert.ok(markdown.includes('## Summary'))
  assert.ok(markdown.includes('- **Approved:** 2'))
  assert.ok(markdown.includes('- **Rejected:** 2'))
  assert.ok(markdown.includes('- **Commented:** 3'))
  assert.ok(markdown.includes('- **Pending:** 2'))
})

test('renderMarkdown renders a commented entry with its diff and quote', () => {
  const markdown = buildMarkdown(reviewedSession())

  assert.ok(markdown.includes('## Approved (with notes)'))
  assert.ok(markdown.includes('### a.txt (@@ a2 @@)'))
  assert.ok(markdown.includes('```diff\n alpha\n+beta\n```'))
  assert.ok(markdown.includes('> keep'))
  assert.ok(markdown.includes('## Comments'))
  assert.ok(markdown.includes('### c.js (@@ c2 @@)'))
})

test("renderMarkdown shows '(no comment provided)' for bare rejections", () => {
  const markdown = buildMarkdown(reviewedSession())

  assert.ok(markdown.includes('## Rejected'))
  assert.ok(markdown.includes('> (no comment provided)'))
  assert.ok(markdown.includes('> rework'))
})

test('renderMarkdown never leaks an omitted hunk', () => {
  const markdown = buildMarkdown(reviewedSession())

  assert.ok(!markdown.includes('@@ a1 @@'))
  assert.ok(!markdown.includes('@@ c1 @@'))
})

test('renderMarkdown handles a session with no hunks', () => {
  const session = new ReviewSession('cli', {}, [])
  const markdown = buildMarkdown(session)

  assert.ok(markdown.includes('## Summary'))
  assert.ok(markdown.includes('- **Pending:** 0'))
  assert.ok(!markdown.includes('## Approved'))
  assert.ok(!markdown.includes('## Rejected'))
  assert.ok(!markdown.includes('## Comments'))
})

test('renderJson emits counts and the same three sections', () => {
  const json = JSON.parse(renderJson(buildReport(reviewedSession()))) as {
    counts: unknown
    approvedWithNotes: { hunkId: string }[]
    rejected: { hunkId: string }[]
    comments: { hunkId: string }[]
  }

  assert.deepEqual(json.counts, {
    approved: 2,
    rejected: 2,
    commented: 3,
    pending: 2,
    total: 6,
  })
  assert.deepEqual(
    json.approvedWithNotes.map((entry) => entry.hunkId),
    ['a2'],
  )
  assert.deepEqual(
    json.rejected.map((entry) => entry.hunkId),
    ['b1', 'b2'],
  )
  assert.deepEqual(
    json.comments.map((entry) => entry.hunkId),
    ['c2'],
  )
})
