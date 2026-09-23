import styled from 'styled-components'

// Components
import { CodeEditor } from './CodeEditor'

// Utils
import { buildSideBySideRows, sideBySideColumn } from '../lib/diff'

// Types
import type { Hunk } from '../types'

interface SideBySideDiffProps {
  hunk: Hunk
  filePath: string
}

// Stacked layout's top panel: the hunk as old-vs-new columns sharing one
// row model, so deletions stay left and additions are reprinted on the
// right, aligned line by line.
export function SideBySideDiff({ hunk, filePath }: SideBySideDiffProps) {
  const rows = buildSideBySideRows(hunk.lines)
  const oldLines = sideBySideColumn(rows, 'old')
  const newLines = sideBySideColumn(rows, 'new')

  return (
    <Wrap>
      <CodeEditor
        key={`${hunk.id}:old`}
        mode="diff"
        filePath={filePath}
        hunk={hunk}
        diffLines={oldLines}
        diffNumberSide="old"
      />
      <Divider />
      <CodeEditor
        key={`${hunk.id}:new`}
        mode="diff"
        filePath={filePath}
        hunk={hunk}
        diffLines={newLines}
        diffNumberSide="new"
      />
    </Wrap>
  )
}

// Style Overrides
const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
`

const Divider = styled.div`
  background: ${({ theme }) => theme.colors.border};
`
