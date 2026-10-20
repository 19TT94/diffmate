import { describe, expect, it } from 'vitest'

// Utils
import { adjacentHunkIds, findNextPendingHunkId } from '../hunkNav'

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
    summary: null,
    comment: null,
    editedContent: null,
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

describe('adjacentHunkIds', () => {
  const flat = [
    hunk('a1', 'pending'),
    hunk('a2', 'pending'),
    hunk('b1', 'pending'),
  ]

  it('crosses file boundaries in review order', () => {
    expect(adjacentHunkIds(flat, 'a2')).toEqual({ prev: 'a1', next: 'b1' })
  })

  it('has no prev at the start or next at the end of the review', () => {
    expect(adjacentHunkIds(flat, 'a1')).toEqual({ prev: null, next: 'a2' })
    expect(adjacentHunkIds(flat, 'b1')).toEqual({ prev: 'a2', next: null })
  })

  it('has neither for an unknown hunk', () => {
    expect(adjacentHunkIds(flat, 'nope')).toEqual({ prev: null, next: null })
  })
})
