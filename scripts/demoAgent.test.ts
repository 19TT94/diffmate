import assert from 'node:assert/strict'
import { test } from 'node:test'

// MCP
import {
  connectLinked,
  isServerUp,
  reviewHelpers,
  withRepoChange,
} from '../src/mcp/__tests__/helpers.js'

// Demo
import { runDemoAgent } from './demoAgent.js'

async function waitFor<T>(
  check: () => Promise<T | undefined>,
  timeoutMs = 5000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await check()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error('waitFor timed out')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

test('the demo agent starts a review, answers questions, and ends on submit', async () => {
  await withRepoChange(async (_dir, uiDir) => {
    const linked = await connectLinked(uiDir)
    const logged: string[] = []
    try {
      const agent = runDemoAgent(linked.client, {
        title: 'Demo title',
        summary: 'Demo summary',
        timeoutSeconds: 0.1,
        log: (text) => logged.push(text),
      })

      const url = await waitFor(async () => linked.opened[0])
      const review = reviewHelpers(linked, { sessionId: '', url })
      const session = await (await review.api('/api/session')).json()
      assert.equal(session.title, 'Demo title')
      assert.equal(session.summary, 'Demo summary')

      await review.ask(await review.hunkId(), 'Why line two?')
      const answer = await waitFor(async () => {
        const body = await (await review.api('/api/session')).json()
        return (body.questions[0]?.answer ?? undefined) as string | undefined
      })
      assert.match(answer, /Why line two\?/)

      await review.submit()
      await agent

      assert.ok(logged.some((text) => text.includes('# diffmate review')))
      assert.equal(await isServerUp(review.origin), false)
    } finally {
      await linked.close()
    }
  })
})

test('the demo agent passes hunk summaries through to start_review', async () => {
  const calls: { name: string; arguments: Record<string, unknown> }[] = []
  const client = {
    callTool: async (request: {
      name: string
      arguments: Record<string, unknown>
    }) => {
      calls.push(request)
      const structuredContent =
        request.name === 'start_review'
          ? {
              sessionId: 's',
              url: 'u',
              fileCount: 1,
              hunkCount: 1,
              unmatchedSummaries: [],
            }
          : { type: 'review_ended' }
      return { content: [], structuredContent }
    },
  }
  const hunkSummaries = [{ path: 'a.py', hunk: 1, summary: 'Why.' }]

  // A stub with only callTool, which is all runDemoAgent uses.
  await runDemoAgent(client as unknown as Parameters<typeof runDemoAgent>[0], {
    title: null,
    summary: null,
    hunkSummaries,
    log: () => {},
  })

  assert.deepEqual(calls[0], {
    name: 'start_review',
    arguments: { hunkSummaries },
  })
})

test('the demo agent warns about each summary start_review could not place', async () => {
  const unmatchedSummaries = [
    { path: 'a.py', hunk: 3, summary: 'Past the end.' },
    { path: 'gone.py', hunk: 1, summary: 'No such file.' },
  ]
  const client = {
    callTool: async (request: { name: string }) => ({
      content: [],
      structuredContent:
        request.name === 'start_review'
          ? {
              sessionId: 's',
              url: 'u',
              fileCount: 1,
              hunkCount: 1,
              unmatchedSummaries,
            }
          : { type: 'review_ended' },
    }),
  }
  const logged: string[] = []

  // A stub with only callTool, which is all runDemoAgent uses.
  await runDemoAgent(client as unknown as Parameters<typeof runDemoAgent>[0], {
    title: null,
    summary: null,
    log: (text) => logged.push(text),
  })

  const warnings = logged.filter((text) => text.includes('skipped its summary'))
  assert.deepEqual(warnings, [
    'No hunk 3 in a.py; skipped its summary.',
    'No hunk 1 in gone.py; skipped its summary.',
  ])
})
