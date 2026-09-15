import { CodeEditor } from './CodeEditor'

// Utils
import { reviewSpanForHunk } from '../lib/cmReview'

// Types
import type { Hunk } from '../types'

interface FileEditorProps {
  content: string
  filePath: string
  hunk: Hunk
  onDocChanged: (content: string) => void
}

// The whole-file editable editor (right review pane). Keyed by file path at
// its mount site so it survives hunk stepping; the focused hunk's span is
// pushed in reactively, moving the soft band and scrolling the hunk into
// view without remounting (and thus without losing edits/cursor).
export function FileEditor({
  content,
  filePath,
  hunk,
  onDocChanged,
}: FileEditorProps) {
  return (
    <CodeEditor
      mode="editable"
      filePath={filePath}
      content={content}
      hunkSpan={reviewSpanForHunk(hunk)}
      onDocChanged={onDocChanged}
    />
  )
}
