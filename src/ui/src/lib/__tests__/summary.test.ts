import { describe, expect, it } from 'vitest'

// Utils
import { fileBadgeStatus, fileLineStats } from '../summary'

// Types
import type { Hunk, ReviewFile } from '../../types'

function hunk(status: Hunk['status']): Hunk {
  return {
    id: `h-${status}-${Math.random()}`,
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [],
    status,
    summary: null,
    comment: null,
    editedContent: null,
    questions: [],
  }
}

function file(overrides: Partial<ReviewFile> = {}): ReviewFile {
  return {
    path: 'a.txt',
    oldPath: null,
    status: 'modified',
    binary: false,
    hunks: [],
    ...overrides,
  }
}

describe('fileBadgeStatus', () => {
  it('is binary for binary files regardless of hunks', () => {
    expect(fileBadgeStatus(file({ binary: true }))).toBe('binary')
  })

  it('is unsupported for submodule/symlink changes', () => {
    expect(fileBadgeStatus(file({ status: 'unsupported' }))).toBe('unsupported')
  })

  it('is pending when a file has no hunks', () => {
    expect(fileBadgeStatus(file())).toBe('pending')
  })

  it('reflects a single uniform status', () => {
    expect(
      fileBadgeStatus(file({ hunks: [hunk('approved'), hunk('approved')] })),
    ).toBe('approved')
  })

  it('is mixed when hunks disagree', () => {
    expect(
      fileBadgeStatus(file({ hunks: [hunk('approved'), hunk('rejected')] })),
    ).toBe('mixed')
  })
})

describe('fileLineStats', () => {
  it('counts add/del lines across all hunks', () => {
    const h = hunk('pending')
    h.lines = [
      { type: 'add', content: 'x', oldLineNumber: null, newLineNumber: 1 },
      { type: 'add', content: 'y', oldLineNumber: null, newLineNumber: 2 },
      { type: 'del', content: 'z', oldLineNumber: 1, newLineNumber: null },
      { type: 'context', content: 'w', oldLineNumber: 2, newLineNumber: 3 },
    ]
    expect(fileLineStats(file({ hunks: [h] }))).toEqual({ add: 2, del: 1 })
  })
})
