import { CodeEditor } from './CodeEditor'

// Types
import type { Hunk } from '../types'

interface DiffSideProps {
  hunk: Hunk
  filePath: string
}

// Read-only old-side strip for a hunk: the hunk's own lines with the
// pre-pivot +/- gutter and add/del row tints. Keyed by hunk id so the
// CodeMirror instance (and its scroll position) resets on every step.
export function DiffSide({ hunk, filePath }: DiffSideProps) {
  return (
    <CodeEditor key={hunk.id} mode="diff" hunk={hunk} filePath={filePath} />
  )
}
