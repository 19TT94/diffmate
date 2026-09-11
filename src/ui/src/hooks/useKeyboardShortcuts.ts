import { useEffect } from 'react'

// Types
import type { HunkStatus } from '../types'

interface UseKeyboardShortcutsOptions {
  // One array of hunk ids per file, in file order — lets hunk-nav flatten
  // across files while file-nav can jump to a file's first hunk.
  hunkIdsByFile: string[][]
  focusedHunkId: string | null
  onFocusHunk: (hunkId: string) => void
  onSetStatus: (hunkId: string, status: HunkStatus) => void
  onFocusComment: (hunkId: string) => void
  onSubmit: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function useKeyboardShortcuts({
  hunkIdsByFile,
  focusedHunkId,
  onFocusHunk,
  onSetStatus,
  onFocusComment,
  onSubmit,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const flatIds = hunkIdsByFile.flat()

    function stepHunk(delta: number): void {
      if (flatIds.length === 0) return
      const index = focusedHunkId ? flatIds.indexOf(focusedHunkId) : -1
      const next = clamp(
        (index === -1 ? 0 : index) + delta,
        0,
        flatIds.length - 1,
      )
      onFocusHunk(flatIds[next]!)
    }

    function stepFile(delta: number): void {
      if (hunkIdsByFile.length === 0) return
      const index = hunkIdsByFile.findIndex((ids) =>
        ids.includes(focusedHunkId ?? ''),
      )
      const next = clamp(
        (index === -1 ? 0 : index) + delta,
        0,
        hunkIdsByFile.length - 1,
      )
      const firstHunk = hunkIdsByFile[next]?.[0]
      if (firstHunk) onFocusHunk(firstHunk)
    }

    function handleKeyDown(event: KeyboardEvent): void {
      const editing =
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLInputElement
      const mod = event.metaKey || event.ctrlKey

      if (mod && event.key === 'Enter') {
        event.preventDefault()
        onSubmit()
        return
      }
      if (mod && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault()
        stepHunk(event.key === 'ArrowRight' ? 1 : -1)
        return
      }
      if (mod && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault()
        stepFile(event.key === 'ArrowDown' ? 1 : -1)
        return
      }
      if (editing || !focusedHunkId) return

      if (event.key === 'a') {
        onSetStatus(focusedHunkId, 'approved')
      } else if (event.key === 'r') {
        onSetStatus(focusedHunkId, 'rejected')
      } else if (event.key === 'c') {
        event.preventDefault()
        onFocusComment(focusedHunkId)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    hunkIdsByFile,
    focusedHunkId,
    onFocusHunk,
    onSetStatus,
    onFocusComment,
    onSubmit,
  ])
}
