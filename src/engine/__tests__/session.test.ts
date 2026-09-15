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

test('wraps parsed files with pending status and no summary/comment/questions', () => {
  const session = new ReviewSession('cli', {}, fixtureFiles())

  assert.equal(session.mode, 'cli')
  assert.equal(session.reviewComplete, false)
  assert.equal(session.files.length, 1)

  const [hunk] = session.files[0]!.hunks
  assert.equal(hunk!.status, 'pending')
  assert.equal(hunk!.summary, null)
  assert.equal(hunk!.comment, null)
  assert.equal(hunk!.editedContent, null)
  assert.deepEqual(hunk!.questions, [])
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

test('askQuestion attaches a question to the hunk and emits question_asked', () => {
  const session = new ReviewSession('mcp', {}, fixtureFiles())
  const events: unknown[] = []
  session.bus.on('question_asked', (payload) => events.push(payload))

  const question = session.askQuestion('a.txt@@hunk1', 'why this change?')

  assert.equal(question.hunkId, 'a.txt@@hunk1')
  assert.equal(question.answer, null)
  assert.deepEqual(session.files[0]!.hunks[0]!.questions, [question])
  assert.deepEqual(events, [question])
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
