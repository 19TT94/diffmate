import styled from 'styled-components'

// Components
import { CodeEditor } from './CodeEditor'

// Utils
import { HIGHLIGHT_EDITOR_BG } from '../lib/cmTheme'
import { buildSideBySideRows, sideBySideColumn } from '../lib/diff'

// Types
import type { DiffLayout, Hunk } from '../types'

interface HunkDiffProps {
  hunk: Hunk
  filePath: string
  layout: DiffLayout
}

// The hunk's diff, either as old/new columns or as one inline diff.
// Side by side, both columns share one row model (deletions on the old side,
// additions reprinted on the new side, aligned line by line) and grow inside
// one scroll container, so a single scrollbar moves them together. Inline is
// a single pane of the hunk's own lines, interleaved with +/- gutter marks
// and add/del tints, like a unified diff.
export function HunkDiff({ hunk, filePath, layout }: HunkDiffProps) {
  if (layout === 'inline') {
    return (
      <Scroll data-testid="diff-scroll" data-layout="inline">
        <CodeEditor
          key={`${hunk.id}:inline`}
          mode="diff"
          filePath={filePath}
          hunk={hunk}
        />
      </Scroll>
    )
  }

  const rows = buildSideBySideRows(hunk.lines)
  return (
    <Scroll data-testid="diff-scroll" data-layout="side-by-side">
      <Columns>
        <CodeEditor
          key={`${hunk.id}:old`}
          mode="diff"
          filePath={filePath}
          hunk={hunk}
          diffLines={sideBySideColumn(rows, 'old')}
          diffNumberSide="old"
        />
        <Divider />
        <CodeEditor
          key={`${hunk.id}:new`}
          mode="diff"
          filePath={filePath}
          hunk={hunk}
          diffLines={sideBySideColumn(rows, 'new')}
          diffNumberSide="new"
        />
      </Columns>
    </Scroll>
  )
}

// Style Overrides
// The pane color fills any space below short diffs (e.g. in the larger
// view), so it reads as one continuous code area.
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: ${HIGHLIGHT_EDITOR_BG};
`

const Columns = styled.div`
  min-height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
`

const Divider = styled.div`
  background: ${({ theme }) => theme.colors.border};
`
