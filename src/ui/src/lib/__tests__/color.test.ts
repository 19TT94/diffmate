import { describe, expect, it } from 'vitest'

// Utils
import { contrastRatio, readableTextOn } from '../color'

describe('readableTextOn', () => {
  it('picks near-black on a light fill like coral', () => {
    expect(readableTextOn('#f06543')).toBe('#1f2328')
  })

  it('picks white on a dark fill like the default blue', () => {
    expect(readableTextOn('#0969da')).toBe('#ffffff')
  })

  it('always picks the higher-contrast option', () => {
    for (const fill of [
      '#000000',
      '#ffffff',
      '#777777',
      '#1a7f37',
      '#ffd33d',
    ]) {
      const picked = readableTextOn(fill)
      const other = picked === '#ffffff' ? '#1f2328' : '#ffffff'
      expect(contrastRatio(picked, fill)).toBeGreaterThanOrEqual(
        contrastRatio(other, fill),
      )
    }
  })
})
