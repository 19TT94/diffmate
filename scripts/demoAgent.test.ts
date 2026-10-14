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
        return (body.files[0].hunks[0].questions[0]?.answer ?? undefined) as
          string | undefined
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
