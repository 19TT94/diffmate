import { describe, expect, it } from 'vitest'

// Utils
import { buildSideBySideRows } from '../diff'

// Types
import type { DiffLine } from '../../types'

function line(type: DiffLine['type'], content: string): DiffLine {
  return { type, content, oldLineNumber: null, newLineNumber: null }
}

describe('buildSideBySideRows', () => {
  it('pairs a context line on both sides', () => {
    const rows = buildSideBySideRows([line('context', 'same')])
    expect(rows).toEqual([{ left: rows[0]!.left, right: rows[0]!.right }])
    expect(rows[0]!.left).toBe(rows[0]!.right)
  })

  it('pairs equal-length del/add runs positionally', () => {
    const del = line('del', 'old')
    const add = line('add', 'new')
    const rows = buildSideBySideRows([del, add])
    expect(rows).toEqual([{ left: del, right: add }])
  })

  it('pads the shorter side with null when del/add counts differ', () => {
    const del1 = line('del', 'old1')
    const del2 = line('del', 'old2')
    const add1 = line('add', 'new1')
    const rows = buildSideBySideRows([del1, del2, add1])
    expect(rows).toEqual([
      { left: del1, right: add1 },
      { left: del2, right: null },
    ])
  })

  it('handles context, then a change block, then context', () => {
    const ctx1 = line('context', 'before')
    const del = line('del', 'old')
    const add = line('add', 'new')
    const ctx2 = line('context', 'after')
    const rows = buildSideBySideRows([ctx1, del, add, ctx2])
    expect(rows).toEqual([
      { left: ctx1, right: ctx1 },
      { left: del, right: add },
      { left: ctx2, right: ctx2 },
    ])
  })
})
