import { describe, expect, it } from 'vitest'

// Utils
import { editableGutters, newSideGutters, oldSideGutter } from '../gutter'

// Types
import type { DiffLine, Hunk } from '../../types'

function line(overrides: Partial<DiffLine>): DiffLine {
  return {
    type: 'context',
    content: '',
    oldLineNumber: 1,
    newLineNumber: 1,
    ...overrides,
  }
}

function hunk(lines: DiffLine[]): Hunk {
  return {
    id: 'f@@h',
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: lines.filter((entry) => entry.type !== 'del').length,
    lines,
    status: 'pending',
    summary: null,
    comment: null,
    editedContent: null,
    questions: [],
  }
}

describe('oldSideGutter', () => {
  it('uses + for additions and - for deletions', () => {
    expect(
      oldSideGutter(
        line({ type: 'add', oldLineNumber: null, newLineNumber: 1 }),
      ),
    ).toEqual({ label: '+', kind: 'add' })
    expect(
      oldSideGutter(
        line({ type: 'del', oldLineNumber: 4, newLineNumber: null }),
      ),
    ).toEqual({ label: '-', kind: 'del' })
  })

  it('keeps the old line number for context', () => {
    expect(
      oldSideGutter(line({ oldLineNumber: 12, newLineNumber: 12 })),
    ).toEqual({ label: '12', kind: 'context' })
  })
})

describe('newSideGutters', () => {
  it('marks a del+add pair as a modification with -', () => {
    expect(
      newSideGutters(
        hunk([
          line({
            type: 'del',
            content: 'old',
            oldLineNumber: 1,
            newLineNumber: null,
          }),
          line({
            type: 'add',
            content: 'new',
            oldLineNumber: null,
            newLineNumber: 1,
          }),
        ]),
      ),
    ).toEqual([{ label: '-', kind: 'del' }])
  })

  it('marks leftover adds as +', () => {
    expect(
      newSideGutters(
        hunk([
          line({ type: 'add', oldLineNumber: null, newLineNumber: 1 }),
          line({ type: 'add', oldLineNumber: null, newLineNumber: 2 }),
        ]),
      ),
    ).toEqual([
      { label: '+', kind: 'add' },
      { label: '+', kind: 'add' },
    ])
  })

  it('keeps new line numbers for context', () => {
    expect(
      newSideGutters(
        hunk([line({ type: 'context', oldLineNumber: 3, newLineNumber: 3 })]),
      ),
    ).toEqual([{ label: '3', kind: 'context' }])
  })
})

describe('editableGutters', () => {
  it('pads extra draft lines as additions', () => {
    const marks = editableGutters(
      hunk([line({ type: 'add', oldLineNumber: null, newLineNumber: 1 })]),
      3,
    )
    expect(marks.map((mark) => mark.label)).toEqual(['+', '+', '+'])
  })
})
