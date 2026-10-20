// Types
import type { Hunk } from '../types'

// Searches `hunks` in order starting right after `afterId`, wrapping around
// the end of the list and skipping `afterId` itself, so deciding a hunk out
// of order still surfaces earlier pending work instead of stalling at the
// end of the list.
export function findNextPendingHunkId(
  hunks: Hunk[],
  afterId: string | null,
): string | null {
  if (hunks.length === 0) return null
  const startIndex = afterId
    ? hunks.findIndex((hunk) => hunk.id === afterId)
    : -1

  for (let offset = 1; offset <= hunks.length; offset++) {
    const hunk = hunks[(startIndex + offset) % hunks.length]!
    if (hunk.id !== afterId && hunk.status === 'pending') return hunk.id
  }
  return null
}

// Prev/Next in review order, crossing file boundaries; null at either end
// of the review.
export function adjacentHunkIds(
  hunks: Hunk[],
  currentId: string,
): { prev: string | null; next: string | null } {
  const index = hunks.findIndex((hunk) => hunk.id === currentId)
  if (index === -1) return { prev: null, next: null }
  return {
    prev: hunks[index - 1]?.id ?? null,
    next: hunks[index + 1]?.id ?? null,
  }
}
