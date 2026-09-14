import { describe, expect, it } from 'vitest'

// Utils
import { findNextPendingHunkId } from '../hunkNav'

// Types
import type { Hunk } from '../../types'

function hunk(id: string, status: Hunk['status']): Hunk {
  return {
    id,
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [],
    status,
    comment: null,
    questions: [],
  }
}

describe('findNextPendingHunkId', () => {
  it('returns null for an empty list', () => {
    expect(findNextPendingHunkId([], null)).toBeNull()
  })

  it('finds the next pending hunk after the given id', () => {
    const hunks = [
      hunk('a', 'approved'),
      hunk('b', 'pending'),
      hunk('c', 'pending'),
    ]
    expect(findNextPendingHunkId(hunks, 'a')).toBe('b')
  })

  it('wraps around past the end of the list', () => {
    const hunks = [
      hunk('a', 'pending'),
      hunk('b', 'approved'),
      hunk('c', 'approved'),
    ]
    expect(findNextPendingHunkId(hunks, 'c')).toBe('a')
  })

  it('excludes the just-decided hunk so a lone pending hunk reports nothing left', () => {
    const hunks = [hunk('a', 'approved'), hunk('b', 'pending')]
    expect(findNextPendingHunkId(hunks, 'b')).toBeNull()
  })

  it('returns null when no hunk is pending', () => {
    const hunks = [hunk('a', 'approved'), hunk('b', 'rejected')]
    expect(findNextPendingHunkId(hunks, 'a')).toBeNull()
  })

  it('searches from the start when afterId is null', () => {
    const hunks = [hunk('a', 'approved'), hunk('b', 'pending')]
    expect(findNextPendingHunkId(hunks, null)).toBe('b')
  })
})
