import assert from 'node:assert/strict'
import { test } from 'node:test'

// MCP
import { SessionController, clampTimeoutSeconds } from '../tools.js'
import {
  callStructured,
  connectLinked,
  isServerUp,
  listenForEvent,
  reviewHelpers,
  withRepoChange,
  withStartedReview,
} from './helpers.js'

type Activity =
  | {
      type: 'no_activity'
      pending: number
      decided: number
      idleSeconds: number
    }
  | {
      type: 'question'
      questionId: string
      hunkId: string | null
      filePath: string | null
      hunkHeader: string | null
      questionText: string
    }
  | {
      type: 'review_complete'
      decisions: {
        counts: { rejected: number }
        rejected: { hunkId: string }[]
      }
      unansweredQuestions: {
        questionId: string
        questionText: string
        hunkId: string | null
        filePath: string | null
        hunkHeader: string | null
      }[]
      summaryMarkdown: string
    }
  | { type: 'review_ended' }

// Sequential: every test chdirs into its own temp repo.

test('concurrent start_review calls start exactly one review', async () => {
  await withRepoChange(async (_dir, uiDir) => {
    const linked = await connectLinked(uiDir)
    try {
      const results = await Promise.allSettled([
        linked.client.callTool({ name: 'start_review' }),
        linked.client.callTool({ name: 'start_review' }),
      ])
      const fulfilled = results.filter((r) => r.status === 'fulfilled')
      const rejected = results.filter((r) => r.status === 'rejected')
      assert.equal(fulfilled.length, 1)
      assert.equal(rejected.length, 1)
      assert.match(String(rejected[0]!.reason), /already active/)
      assert.equal(linked.opened.length, 1)
    } finally {
      await linked.close()
    }
  })
})

test('a submitted review keeps serving until end_review', async () => {
  await withStartedReview(async (review) => {
    await review.submit()
    const res = await review.api('/api/session')
    assert.equal(res.status, 200)
    const activity = await callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 1 },
    )
    assert.equal(activity.type, 'review_complete')
  })
})

test('start_review after an un-ended submitted review closes the old server', async () => {
  await withStartedReview(async (review) => {
    await review.submit()
    const next = await callStructured<{ sessionId: string; url: string }>(
      review.linked.client,
      'start_review',
    )
    assert.notEqual(next.sessionId, review.sessionId)
    assert.equal(await isServerUp(review.origin), false)
    assert.equal(await isServerUp(new URL(next.url).origin), true)
  })
})

test('wait_for_activity returns no_activity after the timeout', async () => {
  await withStartedReview(async (review) => {
    const activity = await callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 0.05 },
    )
    assert.deepEqual(activity, {
      type: 'no_activity',
      pending: 1,
      decided: 0,
      idleSeconds: 0,
    })
  })
})

test('no_activity counts decided hunks', async () => {
  await withStartedReview(async (review) => {
    await review.setStatus(await review.hunkId(), 'approved')
    const activity = await callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 0.05 },
    )
    assert.equal(activity.type, 'no_activity')
    if (activity.type !== 'no_activity') return
    assert.equal(activity.pending, 0)
    assert.equal(activity.decided, 1)
  })
})

test('no_activity idleSeconds resets on reviewer activity', async () => {
  let clock = 0
  const controller = new SessionController({ now: () => clock })
  await withStartedReview(async (review) => {
    const idle = async (): Promise<number> => {
      const activity = await callStructured<Activity>(
        review.linked.client,
        'wait_for_activity',
        { sessionId: review.sessionId, timeoutSeconds: 0.05 },
      )
      assert.equal(activity.type, 'no_activity')
      return activity.type === 'no_activity' ? activity.idleSeconds : -1
    }
    const hunkId = await review.hunkId()

    clock = 5_400
    assert.equal(await idle(), 5)
    await review.setStatus(hunkId, 'approved')
    assert.equal(await idle(), 0)

    clock = 9_000
    await review.api(`/api/hunks/${encodeURIComponent(hunkId)}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'nit' }),
    })
    clock = 10_000
    assert.equal(await idle(), 1)
  }, controller)
})

test('wait_for_activity returns a question asked before the call', async () => {
  await withStartedReview(async (review) => {
    const hunkId = await review.hunkId()
    const questionId = await review.ask(hunkId, 'Why this change?')
    const activity = await callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 1 },
    )
    assert.deepEqual(activity, {
      type: 'question',
      questionId,
      hunkId,
      filePath: 'tracked.txt',
      hunkHeader: '@@ -1,2 +1,2 @@',
      questionText: 'Why this change?',
    })
  })
})

test('wait_for_activity wakes as soon as a question is asked', async () => {
  await withStartedReview(async (review) => {
    const hunkId = await review.hunkId()
    const startedAt = Date.now()
    const pending = callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 5 },
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    await review.ask(hunkId, 'Asked mid-wait')
    const activity = await pending
    assert.equal(activity.type, 'question')
    assert.ok(Date.now() - startedAt < 2000)
  })
})

test('wait_for_activity drains queued questions one per call, in order', async () => {
  await withStartedReview(async (review) => {
    const hunkId = await review.hunkId()
    await review.ask(hunkId, 'first')
    await review.ask(hunkId, 'second')
    const texts: string[] = []
    for (let i = 0; i < 2; i++) {
      const activity = await callStructured<Activity>(
        review.linked.client,
        'wait_for_activity',
        { sessionId: review.sessionId, timeoutSeconds: 1 },
      )
      assert.equal(activity.type, 'question')
      if (activity.type === 'question') texts.push(activity.questionText)
    }
    assert.deepEqual(texts, ['first', 'second'])
  })
})

test('wait_for_activity returns review_complete with decisions, repeatedly', async () => {
  await withStartedReview(async (review) => {
    const hunkId = await review.hunkId()
    await review.setStatus(hunkId, 'rejected')
    await review.submit()
    for (let i = 0; i < 2; i++) {
      const activity = await callStructured<Activity>(
        review.linked.client,
        'wait_for_activity',
        { sessionId: review.sessionId, timeoutSeconds: 1 },
      )
      assert.equal(activity.type, 'review_complete')
      if (activity.type !== 'review_complete') return
      assert.equal(activity.decisions.counts.rejected, 1)
      assert.equal(activity.decisions.rejected[0]!.hunkId, hunkId)
      assert.match(activity.summaryMarkdown, /## Rejected/)
    }
  })
})

test('review_complete takes precedence over undelivered questions', async () => {
  await withStartedReview(async (review) => {
    await review.ask(await review.hunkId(), 'Too late?')
    await review.submit()
    const activity = await callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 1 },
    )
    assert.equal(activity.type, 'review_complete')
  })
})

test('wait_for_activity rejects an unknown session', async () => {
  await withStartedReview(async (review) => {
    await assert.rejects(
      () =>
        review.linked.client.callTool({
          name: 'wait_for_activity',
          arguments: { sessionId: 'nope', timeoutSeconds: 0.05 },
        }),
      /Unknown session/,
    )
  })
})

test('clampTimeoutSeconds defaults to 20 and caps at 25', () => {
  assert.equal(clampTimeoutSeconds(undefined), 20)
  assert.equal(clampTimeoutSeconds(100), 25)
  assert.equal(clampTimeoutSeconds(-1), 0)
  assert.equal(clampTimeoutSeconds(0.5), 0.5)
})

test('answer_question stores the answer and pushes it to the browser', async () => {
  await withStartedReview(async (review) => {
    const questionId = await review.ask(await review.hunkId(), 'Why?')
    const sse = await listenForEvent(review, 'question_answered')
    try {
      const result = await callStructured<{ ok: boolean }>(
        review.linked.client,
        'answer_question',
        { sessionId: review.sessionId, questionId, answer: 'Because.' },
      )
      assert.deepEqual(result, { ok: true })
      const pushed = (await sse.next) as { id: string; answer: string }
      assert.equal(pushed.id, questionId)
      assert.equal(pushed.answer, 'Because.')
    } finally {
      sse.stop()
    }
    const body = await (await review.api('/api/session')).json()
    assert.equal(body.questions[0].answer, 'Because.')
  })
})

test('answer_question rejects unknown sessions and questions', async () => {
  await withStartedReview(async (review) => {
    await assert.rejects(
      () =>
        review.linked.client.callTool({
          name: 'answer_question',
          arguments: { sessionId: 'nope', questionId: 'q', answer: 'a' },
        }),
      /Unknown session/,
    )
    await assert.rejects(
      () =>
        review.linked.client.callTool({
          name: 'answer_question',
          arguments: {
            sessionId: review.sessionId,
            questionId: 'nope',
            answer: 'a',
          },
        }),
      /Unknown question/,
    )
  })
})

test('end_review notifies the browser, closes the server, and frees the slot', async () => {
  await withStartedReview(async (review) => {
    await review.submit()
    const sse = await listenForEvent(review, 'review_ended')
    try {
      const result = await callStructured<{ ok: boolean }>(
        review.linked.client,
        'end_review',
        { sessionId: review.sessionId, reason: 'Applying your feedback' },
      )
      assert.deepEqual(result, { ok: true })
      const pushed = (await sse.next) as { reason: string | null }
      assert.equal(pushed.reason, 'Applying your feedback')
    } finally {
      sse.stop()
    }
    assert.equal(await isServerUp(review.origin), false)
    const next = await callStructured<{ sessionId: string; url: string }>(
      review.linked.client,
      'start_review',
    )
    assert.ok(next.sessionId)
  })
})

test('end_review can abort a review that was never submitted', async () => {
  await withStartedReview(async (review) => {
    const result = await callStructured<{ ok: boolean }>(
      review.linked.client,
      'end_review',
      { sessionId: review.sessionId },
    )
    assert.deepEqual(result, { ok: true })
    assert.equal(await isServerUp(review.origin), false)
    const next = await callStructured<{ sessionId: string; url: string }>(
      review.linked.client,
      'start_review',
    )
    // The replacement review is live and independent of the ended one.
    const nextReview = reviewHelpers(review.linked, next)
    assert.equal((await nextReview.api('/api/session')).status, 200)
  })
})

test('wait_for_activity hands over a review-level question with null hunk fields', async () => {
  await withStartedReview(async (review) => {
    const res = await review.api('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Why this approach overall?' }),
    })
    const { questionId } = await res.json()

    const activity = await callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 1 },
    )
    assert.deepEqual(activity, {
      type: 'question',
      questionId,
      hunkId: null,
      filePath: null,
      hunkHeader: null,
      questionText: 'Why this approach overall?',
    })
  })
})

test('review_complete carries unanswered questions and lists them in the markdown', async () => {
  await withStartedReview(async (review) => {
    const hunkId = await review.hunkId()
    const answeredId = await review.ask(hunkId, 'Answered one')
    await callStructured(review.linked.client, 'answer_question', {
      sessionId: review.sessionId,
      questionId: answeredId,
      answer: 'Done.',
    })
    const openId = await review.ask(hunkId, 'Too late?')
    await review.submit()

    const activity = await callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 1 },
    )
    assert.equal(activity.type, 'review_complete')
    if (activity.type !== 'review_complete') return
    assert.deepEqual(activity.unansweredQuestions, [
      {
        questionId: openId,
        questionText: 'Too late?',
        hunkId,
        filePath: 'tracked.txt',
        hunkHeader: '@@ -1,2 +1,2 @@',
      },
    ])
    assert.match(activity.summaryMarkdown, /## Unanswered questions/)
    assert.match(activity.summaryMarkdown, /Too late\?/)
  })
})

test('review_complete has an empty unansweredQuestions list when all were answered', async () => {
  await withStartedReview(async (review) => {
    await review.submit()
    const activity = await callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 1 },
    )
    assert.equal(activity.type, 'review_complete')
    if (activity.type !== 'review_complete') return
    assert.deepEqual(activity.unansweredQuestions, [])
    assert.doesNotMatch(activity.summaryMarkdown, /Unanswered questions/)
  })
})

test('a pending wait_for_activity returns review_ended as soon as end_review runs', async () => {
  await withStartedReview(async (review) => {
    const startedAt = Date.now()
    const pending = callStructured<Activity>(
      review.linked.client,
      'wait_for_activity',
      { sessionId: review.sessionId, timeoutSeconds: 10 },
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    await callStructured(review.linked.client, 'end_review', {
      sessionId: review.sessionId,
    })

    assert.deepEqual(await pending, { type: 'review_ended' })
    assert.ok(Date.now() - startedAt < 2000)
  })
})
