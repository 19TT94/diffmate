import assert from 'node:assert/strict'
import { test } from 'node:test'

// Engine
import { ReviewSession } from '../session.js'

// Types
import type { ParsedFile } from '../types.js'

function fixtureFiles(): ParsedFile[] {
  return [
    {
      path: 'a.txt',
      oldPath: null,
      status: 'modified',
      binary: false,
      hunks: [
        {
          id: 'a.txt@@hunk1',
          header: '@@ -1,1 +1,1 @@',
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [],
        },
      ],
    },
  ]
}

test('wraps parsed files with pending status and no summary/comment', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())

  assert.equal(session.mode, 'cli')
  assert.equal(session.reviewComplete, false)
  assert.equal(session.files.length, 1)

  const [hunk] = session.files[0]!.hunks
  assert.equal(hunk!.status, 'pending')
  assert.equal(hunk!.summary, null)
  assert.equal(hunk!.comment, null)
  assert.equal(hunk!.editedContent, null)
  assert.equal('questions' in hunk!, false)
  assert.deepEqual(session.questions, [])
})

test('setFileNotes stores out-of-hunk edits without an event', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  const events: unknown[] = []
  session.bus.on('hunk_updated', (payload) => events.push(payload))

  session.setFileNotes('a.txt', '@@ -1,1 +1,1 @@\n-line one\n+line uno')

  assert.equal(session.files[0]!.notes, '@@ -1,1 +1,1 @@\n-line one\n+line uno')
  assert.deepEqual(events, [])
})

test('setFileNotes throws for an unknown file', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  assert.throws(() => session.setFileNotes('nope.txt', 'notes'))
})

test('setHunkStatus updates status and emits hunk_updated', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  const events: unknown[] = []
  session.bus.on('hunk_updated', (payload) => events.push(payload))

  session.setHunkStatus('a.txt@@hunk1', 'approved')

  assert.equal(session.files[0]!.hunks[0]!.status, 'approved')
  assert.deepEqual(events, [{ hunkId: 'a.txt@@hunk1', status: 'approved' }])
})

test('setHunkStatus throws for an unknown hunk id', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  assert.throws(() => session.setHunkStatus('nope', 'approved'))
})

test('setHunkComment updates comment and emits hunk_updated', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  const events: unknown[] = []
  session.bus.on('hunk_updated', (payload) => events.push(payload))

  session.setHunkComment('a.txt@@hunk1', 'looks off')

  assert.equal(session.files[0]!.hunks[0]!.comment, 'looks off')
  assert.deepEqual(events, [{ hunkId: 'a.txt@@hunk1', comment: 'looks off' }])
})

test('setHunkEditedContent updates editedContent and emits hunk_updated', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  const events: unknown[] = []
  session.bus.on('hunk_updated', (payload) => events.push(payload))

  session.setHunkEditedContent('a.txt@@hunk1', 'const x = 1')

  assert.equal(session.files[0]!.hunks[0]!.editedContent, 'const x = 1')
  assert.deepEqual(events, [
    { hunkId: 'a.txt@@hunk1', editedContent: 'const x = 1' },
  ])
})

test('askQuestion adds a hunk question to the review-wide list and emits question_asked', () => {
  const session = new ReviewSession('mcp', {}, fixtureFiles())
  const events: unknown[] = []
  session.bus.on('question_asked', (payload) => events.push(payload))

  const question = session.askQuestion('a.txt@@hunk1', 'why this change?')

  assert.equal(question.hunkId, 'a.txt@@hunk1')
  assert.equal(question.answer, null)
  assert.deepEqual(session.questions, [question])
  assert.deepEqual(events, [question])
})

test('questions keep the order they were asked across hunks and the review', () => {
  const session = new ReviewSession('mcp', {}, fixtureFiles())

  const first = session.askQuestion('a.txt@@hunk1', 'first')
  const second = session.askQuestion(null, 'about the whole review')
  const third = session.askQuestion('a.txt@@hunk1', 'third')

  assert.deepEqual(session.questions, [first, second, third])
  assert.equal(second.hunkId, null)
})

test('askQuestion still rejects an unknown hunk', () => {
  const session = new ReviewSession('mcp', {}, fixtureFiles())

  assert.throws(() => session.askQuestion('nope', 'why?'), /Unknown hunk/)
  assert.deepEqual(session.questions, [])
})

test('answerQuestion stores the answer and emits question_answered', () => {
  const session = new ReviewSession('mcp', {}, fixtureFiles())
  const question = session.askQuestion('a.txt@@hunk1', 'why this change?')
  const events: unknown[] = []
  session.bus.on('question_answered', (payload) => events.push(payload))

  const answered = session.answerQuestion(question.id, 'because reasons')

  assert.equal(answered.answer, 'because reasons')
  assert.ok(answered.answeredAt !== null)
  assert.deepEqual(events, [answered])
})

test('answerQuestion throws for an unknown question id', () => {
  const session = new ReviewSession('mcp', {}, fixtureFiles())
  assert.throws(() => session.answerQuestion('nope', 'answer'))
})

test('complete marks the session done and emits review_complete once', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  const events: unknown[] = []
  session.bus.on('review_complete', (payload) => events.push(payload))

  session.complete()

  assert.equal(session.reviewComplete, true)
  assert.deepEqual(events, [{ sessionId: session.id }])
})

test('defaults agent context to null title and summary', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())
  assert.equal(session.title, null)
  assert.equal(session.summary, null)
})

test('stores agent title and summary for MCP sessions', () => {
  const session = new ReviewSession('mcp', {}, fixtureFiles(), {
    title: 'Add size variants to Button',
    summary: 'Claude added an optional sm/md size to Button.',
  })

  assert.equal(session.title, 'Add size variants to Button')
  assert.equal(
    session.summary,
    'Claude added an optional sm/md size to Button.',
  )
})

function twoFiles(): ParsedFile[] {
  const hunk = (id: string) => ({
    id,
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [],
  })
  return [
    {
      path: 'src/a.ts',
      oldPath: null,
      status: 'modified',
      binary: false,
      hunks: [hunk('a1'), hunk('a2')],
    },
    {
      path: 'new.txt',
      oldPath: null,
      status: 'added',
      binary: false,
      hunks: [hunk('n1')],
    },
  ]
}

test('hunk summaries land on the hunk at that 1-based position in the file', () => {
  const session = new ReviewSession('mcp', {}, twoFiles(), {
    title: null,
    summary: null,
    hunkSummaries: [
      { path: 'src/a.ts', hunk: 2, summary: 'Second change, because.' },
      { path: 'new.txt', hunk: 1, summary: 'New file, because.' },
    ],
  })

  const [a, added] = session.files
  assert.equal(a!.hunks[0]!.summary, null)
  assert.equal(a!.hunks[1]!.summary, 'Second change, because.')
  assert.equal(added!.hunks[0]!.summary, 'New file, because.')
  assert.deepEqual(session.unmatchedSummaries, [])
})

test('hunk summaries that match no hunk are skipped and reported', () => {
  const missingFile = { path: 'gone.ts', hunk: 1, summary: 'x' }
  const pastEnd = { path: 'src/a.ts', hunk: 3, summary: 'y' }
  const session = new ReviewSession('mcp', {}, twoFiles(), {
    title: null,
    summary: null,
    hunkSummaries: [
      missingFile,
      { path: 'src/a.ts', hunk: 1, summary: 'kept' },
      pastEnd,
    ],
  })

  assert.equal(session.files[0]!.hunks[0]!.summary, 'kept')
  assert.deepEqual(session.unmatchedSummaries, [missingFile, pastEnd])
})
