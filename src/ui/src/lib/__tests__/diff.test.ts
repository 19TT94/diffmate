import { describe, expect, it } from 'vitest'

// Utils
import { buildSideBySideRows, sideBySideColumn } from '../diff'

// Types
import type { DiffLine } from '../../types'

function line(
  type: DiffLine['type'],
  content: string,
  oldLineNumber: number | null,
  newLineNumber: number | null,
): DiffLine {
  return { type, content, oldLineNumber, newLineNumber }
}

describe('buildSideBySideRows', () => {
  it('keeps context lines on both sides', () => {
    const rows = buildSideBySideRows([line('context', 'same', 1, 1)])

    expect(rows).toEqual([
      {
        old: line('context', 'same', 1, 1),
        new: line('context', 'same', 1, 1),
      },
    ])
  })

  it('pairs a removed line with its replacement addition', () => {
    const rows = buildSideBySideRows([
      line('del', 'old code', 2, null),
      line('add', 'new code', null, 2),
    ])

    expect(rows[0]).toEqual({
      old: line('del', 'old code', 2, null),
      new: line('add', 'new code', null, 2),
    })
  })

  it('pairs multiple deletions with additions positionally', () => {
    const rows = buildSideBySideRows([
      line('del', 'a', 1, null),
      line('del', 'b', 2, null),
      line('add', 'x', null, 1),
      line('add', 'y', null, 2),
    ])

    expect(rows).toEqual([
      { old: line('del', 'a', 1, null), new: line('add', 'x', null, 1) },
      { old: line('del', 'b', 2, null), new: line('add', 'y', null, 2) },
    ])
  })

  it('keeps a pure addition on the new side only', () => {
    const rows = buildSideBySideRows([line('add', 'brand new', null, 5)])

    expect(rows).toEqual([
      { old: null, new: line('add', 'brand new', null, 5) },
    ])
  })

  it('keeps a pure deletion on the old side only', () => {
    const rows = buildSideBySideRows([line('del', 'gone', 4, null)])

    expect(rows).toEqual([{ old: line('del', 'gone', 4, null), new: null }])
  })

  it('builds a column of one line per aligned row, blanking missing cells', () => {
    const rows = buildSideBySideRows([
      line('context', 'same', 1, 1),
      line('add', 'fresh', null, 2),
    ])

    expect(sideBySideColumn(rows, 'old').map((l) => l.content)).toEqual([
      'same',
      '',
    ])
    expect(sideBySideColumn(rows, 'new').map((l) => l.content)).toEqual([
      'same',
      'fresh',
    ])
    expect(sideBySideColumn(rows, 'old').length).toBe(rows.length)
    expect(sideBySideColumn(rows, 'new').length).toBe(rows.length)
  })
})
