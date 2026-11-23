import { afterEach, describe, expect, it, vi } from 'vitest'

// Utils
import { askQuestion, connectEvents } from '../api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api', () => {
  it('posts a hunk question, or a whole-review one without a hunkId', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ questionId: 'q1' }), { status: 202 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await askQuestion('a.ts@@1', 'Why?')
    await askQuestion(null, 'Overall?')

    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse((call as unknown as [string, RequestInit])[1].body as string),
    )
    expect(bodies).toEqual([
      { hunkId: 'a.ts@@1', text: 'Why?' },
      { text: 'Overall?' },
    ])
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(
      /^\/api\/questions\?token=/,
    )
  })

  it('refreshes when the agent ends the review', () => {
    const types: string[] = []
    vi.stubGlobal(
      'EventSource',
      class {
        addEventListener(type: string) {
          types.push(type)
        }
      },
    )

    connectEvents(() => {})

    expect(types).toContain('review_ended')
  })
})
