import { useEffect, useState } from 'react'

// Utils
import { fetchFileContent } from '../lib/api'

export interface FileContentState {
  content: string | null
  error: string | null
  loading: boolean
}

const IDLE: FileContentState = { content: null, error: null, loading: false }

// Re-fetches only when `path` changes, so stepping between hunks within the
// same file reuses what's already loaded instead of re-requesting it.
export function useFileContent(path: string | null): FileContentState {
  const [state, setState] = useState<FileContentState>(IDLE)

  useEffect(() => {
    // Intentional: kick off (or reset) the fetch synchronously on path
    // change, matching useReviewSession's fetch-on-mount pattern — no
    // data-fetching library in play here, so this is a direct call rather
    // than a `.then`-wrapped one.
    if (!path) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(IDLE)
      return
    }
    let cancelled = false
    setState({ content: null, error: null, loading: true })
    fetchFileContent(path)
      .then(({ content }) => {
        if (!cancelled) setState({ content, error: null, loading: false })
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ content: null, error: error.message, loading: false })
        }
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return state
}
