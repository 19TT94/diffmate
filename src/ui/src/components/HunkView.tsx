import styled from 'styled-components'

// Components
import { Button } from './ui/Button'
import { Panel, PanelText } from './ui/Panel'
import { ViewModeToggle } from './ui/ViewModeToggle'
import { FileEditor } from './FileEditor'
import { HunkDiff } from './HunkDiff'

// Utils
import { splitPath } from '../lib/summary'

// Types
import type { DiffLayout, Hunk, HunkStatus } from '../types'

interface HunkViewProps {
  hunk: Hunk
  filePath: string
  isFocused: boolean
  onFocus: () => void
  onSetStatus: (status: HunkStatus) => void
  onFileChange: (content: string) => void
  fileContent: string | null
  fileContentError: string | null
  fileContentLoading: boolean
  // Side-by-side columns or one inline diff.
  layout: DiffLayout
  onLayoutChange: (layout: DiffLayout) => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
  // Zero-based position of this hunk within its file.
  position: { index: number; total: number }
}

// A borderless toolbar over the hunk's summary, then two separate bordered
// panels: the diff (old vs new, one scrollbar) and the whole-file editor.
export function HunkView({
  hunk,
  filePath,
  isFocused,
  onFocus,
  onSetStatus,
  onFileChange,
  fileContent,
  fileContentError,
  fileContentLoading,
  layout,
  onLayoutChange,
  onPrev,
  onNext,
  position,
}: HunkViewProps) {
  const newSide = fileContentLoading ? (
    <Placeholder>Loading file…</Placeholder>
  ) : fileContentError ? (
    <Placeholder>{fileContentError}</Placeholder>
  ) : fileContent === null ? (
    <Placeholder>No content available.</Placeholder>
  ) : (
    <FileEditor
      content={fileContent}
      filePath={filePath}
      hunk={hunk}
      onDocChanged={onFileChange}
    />
  )

  return (
    <Container id={`hunk-${hunk.id}`} $focused={isFocused} onClick={onFocus}>
      <Toolbar role="toolbar" aria-label="Hunk actions">
        <FileName title={filePath}>{splitPath(filePath).name}</FileName>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Previous hunk"
          title="Previous hunk"
          disabled={!onPrev}
          onClick={() => onPrev?.()}
        >
          ‹
        </Button>
        <Position>
          {position.index + 1} of {position.total}
        </Position>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Next hunk"
          title="Next hunk"
          disabled={!onNext}
          onClick={() => onNext?.()}
        >
          ›
        </Button>
        <Button
          size="sm"
          variant="primary"
          active={hunk.status === 'approved'}
          onClick={() => onSetStatus('approved')}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          active={hunk.status === 'rejected'}
          onClick={() => onSetStatus('rejected')}
        >
          Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onSetStatus('pending')}
        >
          Reset
        </Button>
      </Toolbar>

      {hunk.summary !== null && (
        <Panel
          tone="agent"
          badge="agent"
          name="explanation"
          title="Explanation"
        >
          <PanelText>{hunk.summary}</PanelText>
        </Panel>
      )}

      <DiffPanel
        title="Diff"
        name="diff"
        expandable
        actions={
          <ViewModeToggle layout={layout} onLayoutChange={onLayoutChange} />
        }
      >
        <HunkDiff hunk={hunk} filePath={filePath} layout={layout} />
      </DiffPanel>

      <EditorPanel title="File" name="file" expandable>
        {newSide}
      </EditorPanel>
    </Container>
  )
}

// Style Overrides
const Container = styled.div<{ $focused: boolean }>`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  outline: ${({ $focused, theme }) => ($focused ? `2px solid ${theme.colors.primary}` : 'none')};
  outline-offset: 2px;
`

// No border or fill: it spans the column and reads as the hunk's header.
const Toolbar = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const FileName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.secondary};
`

const Position = styled.span`
  flex: none;
  color: ${({ theme }) => theme.colors.muted};
  white-space: nowrap;
`

// Sized to its content up to 45% of the column; the editor takes the rest.
const DiffPanel = styled(Panel)`
  flex: 0 1 auto;
  max-height: 45%;
`

const EditorPanel = styled(Panel)`
  flex: 1;
  min-height: 8rem;
`

const Placeholder = styled.div`
  flex: 1;
  height: 100%;
  min-height: 0;
  padding: ${({ theme }) => theme.spacing[4]};
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`
