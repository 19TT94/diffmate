import { describe, expect, it } from 'vitest'

// Utils
import { mergeSettings } from '../settings'

describe('mergeSettings', () => {
  it('sets and removes conversationWidth like fileListWidth', () => {
    const set = mergeSettings(
      { fileListWidth: 300 },
      { conversationWidth: 420 },
    )
    expect(set).toEqual({ fileListWidth: 300, conversationWidth: 420 })

    expect(mergeSettings(set, { conversationWidth: null })).toEqual({
      fileListWidth: 300,
    })
  })
})
