import { describe, expect, it } from 'vitest'

// Utils
import { DEFAULT_HIGHLIGHT_THEME, highlightLines } from '../highlight'

describe('highlightLines', () => {
  it('defaults to the Tokyo Night theme', () => {
    expect(DEFAULT_HIGHLIGHT_THEME).toBe('tokyo-night')
  })

  it('returns plain tokens for the text language', async () => {
    const lines = await highlightLines('hello\nworld', 'text')
    expect(lines.map((line) => line.map((token) => token.content))).toEqual([
      ['hello'],
      ['world'],
    ])
  })

  it('tokenizes typescript with colored spans', async () => {
    const lines = await highlightLines('const x = 1', 'typescript')
    expect(lines).toHaveLength(1)
    const contents = lines[0]!.map((token) => token.content).join('')
    expect(contents).toBe('const x = 1')
    expect(lines[0]!.some((token) => token.color != null)).toBe(true)
  })
})
