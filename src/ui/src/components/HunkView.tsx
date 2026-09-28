import type { MouseEvent as ReactMouseEvent } from 'react'
import styled, { css } from 'styled-components'

// Components
import { Button } from './ui/Button'
import { ViewModeToggle } from './ui/ViewModeToggle'
import { DiffSide } from './DiffSide'
import { FileEditor } from './FileEditor'
import { SideBySideDiff } from './SideBySideDiff'

// Types
import type { DiffLayout, Hunk, HunkStatus } from '../types'

const MIN_OLD_WIDTH = 120
const MAX_OLD_WIDTH = 600

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
  oldColumnWidth: number
  onOldColumnWidthChange: (width: number) => void
  layout: DiffLayout
  onLayoutChange: (layout: DiffLayout) => void
}

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
  oldColumnWidth,
  onOldColumnWidthChange,
  layout,
  onLayoutChange,
}: HunkViewProps) {
  function handleResizeStart(event: ReactMouseEvent): void {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = oldColumnWidth

    function handleMouseMove(moveEvent: MouseEvent): void {
      const next = startWidth + (moveEvent.clientX - startX)
      onOldColumnWidthChange(
        Math.min(Math.max(next, MIN_OLD_WIDTH), MAX_OLD_WIDTH),
      )
    }
    function handleMouseUp(): void {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

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
      <Toolbar>
        <Header>{hunk.header}</Header>
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
        <ViewModeToggle layout={layout} onLayoutChange={onLayoutChange} />
      </Toolbar>

      {hunk.summary !== null && (
        <Summary>
          <SummaryLabel>Summary</SummaryLabel>
          <SummaryText>{hunk.summary}</SummaryText>
        </Summary>
      )}

      <Rows
        $stacked={layout === 'stacked'}
        style={
          layout === 'stacked'
            ? undefined
            : { gridTemplateColumns: `${oldColumnWidth}px 6px 1fr` }
        }
      >
        {layout === 'stacked' ? (
          <>
            <DiffPane>
              <SideBySideDiff hunk={hunk} filePath={filePath} />
            </DiffPane>
            <NewSide>{newSide}</NewSide>
          </>
        ) : (
          <>
            <OldSide>
              <DiffSide hunk={hunk} filePath={filePath} />
            </OldSide>
            <Resizer onMouseDown={handleResizeStart} />
            <NewSide>{newSide}</NewSide>
          </>
        )}
      </Rows>
    </Container>
  )
}

// Style Overrides
const Container = styled.div<{ $focused: boolean }>`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
  outline: ${({ $focused, theme }) => ($focused ? `2px solid ${theme.colors.primary}` : 'none')};
  outline-offset: -1px;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const Header = styled.span`
  color: ${({ theme }) => theme.colors.muted};
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Summary = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
  padding: ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.tertiary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const SummaryLabel = styled.span`
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.muted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`

const SummaryText = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.secondary};
  white-space: pre-wrap;
`

// Stacked puts a side-by-side hunk comparison across the top with the file
// below; side-by-side puts the old strip and the file in columns split by a
// draggable gutter. grid-template-rows uses minmax(0, 1fr) so a row can
// actually shrink instead of growing to fit content.
const Rows = styled.div<{ $stacked: boolean }>`
  flex: 1;
  min-height: 0;
  display: grid;
  ${({ $stacked }) =>
    $stacked
      ? css`
          grid-template-rows: minmax(0, 40%) 1fr;
        `
      : css`
          grid-template-rows: minmax(0, 1fr);
        `}
`

const OldSide = styled.div`
  min-height: 0;
  overflow: hidden;
`

const DiffPane = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const Resizer = styled.div`
  cursor: col-resize;
  background: ${({ theme }) => theme.colors.border};

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
  }
`

const NewSide = styled.div`
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

const Placeholder = styled.div`
  flex: 1;
  height: 100%;
  min-height: 0;
  padding: ${({ theme }) => theme.spacing[4]};
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`
