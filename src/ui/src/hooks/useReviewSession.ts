import { useCallback, useEffect, useState } from 'react'

// Utils
import {
  connectEvents,
  fetchSession,
  setHunkComment as apiSetHunkComment,
  setHunkEditedContent as apiSetHunkEditedContent,
  setHunkStatus as apiSetHunkStatus,
  submitReview as apiSubmitReview,
} from '../lib/api'

// Types
import type {
  Hunk,
  HunkStatus,
  ReviewFile,
  ReviewSessionSummary,
} from '../types'

export interface FlatHunk {
  file: ReviewFile
  hunk: Hunk
}

export function flattenHunks(session: ReviewSessionSummary | null): FlatHunk[] {
  if (!session) return []
  return session.files.flatMap((file) =>
    file.hunks.map((hunk) => ({ file, hunk })),
  )
}

export function useReviewSession() {
  const [session, setSession] = useState<ReviewSessionSummary | null>(null)
  const [focusedHunkId, setFocusedHunkId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await fetchSession()
    setSession(next)
    setFocusedHunkId((current) => {
      const flat = flattenHunks(next)
      if (current && flat.some((entry) => entry.hunk.id === current)) {
        return current
      }
      return flat[0]?.hunk.id ?? null
    })
  }, [])

  useEffect(() => {
    // Intentional: fetch on mount, then re-fetch on every SSE bus event.
    // There's no data-fetching library in play here (diffmate skips
    // react-query to stay dependency-light for a small local tool), so the
    // initial load is a direct call rather than a `.then`-wrapped one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const source = connectEvents(() => refresh())
    return () => source.close()
  }, [refresh])

  const setHunkStatus = useCallback(
    async (hunkId: string, status: HunkStatus) => {
      await apiSetHunkStatus(hunkId, status)
      await refresh()
    },
    [refresh],
  )

  const setHunkComment = useCallback(
    async (hunkId: string, comment: string | null) => {
      await apiSetHunkComment(hunkId, comment)
      await refresh()
    },
    [refresh],
  )

  const setHunkEditedContent = useCallback(
    async (hunkId: string, editedContent: string | null) => {
      await apiSetHunkEditedContent(hunkId, editedContent)
      await refresh()
    },
    [refresh],
  )

  const submitReview = useCallback(async () => {
    await apiSubmitReview()
    await refresh()
  }, [refresh])

  return {
    session,
    focusedHunkId,
    setFocusedHunkId,
    setHunkStatus,
    setHunkComment,
    setHunkEditedContent,
    submitReview,
  }
}
