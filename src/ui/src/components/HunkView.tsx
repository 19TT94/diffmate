import type { MouseEvent as ReactMouseEvent } from 'react'
import styled from 'styled-components'

// Hooks
import { useHighlightedLines } from '../hooks/useHighlightedLines'

// Components
import { Button } from './ui/Button'
import { FullFileColumn } from './FullFileColumn'
import { HighlightedContent } from './HighlightedContent'

// Utils
import { oldSideGutter } from '../lib/gutter'
import { HIGHLIGHT_EDITOR_BG, type HighlightToken } from '../lib/highlight'

// Types
import type { DiffLine, Hunk, HunkStatus } from '../types'

const MIN_OLD_WIDTH = 120
const MAX_OLD_WIDTH = 600

interface HunkViewProps {
  hunk: Hunk
  filePath: string
  isFocused: boolean
  onFocus: () => void
  onSetStatus: (status: HunkStatus) => void
  onSetEditedContent: (editedContent: string | null) => void
  fileContent: string | null
  fileContentError: string | null
  fileContentLoading: boolean
  oldColumnWidth: number
  onOldColumnWidthChange: (width: number) => void
}

export function HunkView({
  hunk,
  filePath,
  isFocused,
  onFocus,
  onSetStatus,
  onSetEditedContent,
  fileContent,
  fileContentError,
  fileContentLoading,
  oldColumnWidth,
  onOldColumnWidthChange,
}: HunkViewProps) {
  const oldCode = hunk.lines.map((line) => line.content).join('\n')
  const oldTokenLines = useHighlightedLines(oldCode, filePath)

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
      </Toolbar>

      {hunk.summary !== null && (
        <Summary>
          <SummaryLabel>Summary</SummaryLabel>
          <SummaryText>{hunk.summary}</SummaryText>
        </Summary>
      )}

      <Rows style={{ gridTemplateColumns: `${oldColumnWidth}px 6px 1fr` }}>
        <OldSide>
          {hunk.lines.map((line, index) => (
            <Line
              key={index}
              line={line}
              tokens={oldTokenLines?.[index] ?? null}
            />
          ))}
        </OldSide>
        <Resizer onMouseDown={handleResizeStart} />
        <NewSide>
          <FullFileColumn
            content={fileContent}
            error={fileContentError}
            loading={fileContentLoading}
            filePath={filePath}
            hunk={hunk}
            editedContent={hunk.editedContent}
            onSetEditedContent={onSetEditedContent}
          />
        </NewSide>
      </Rows>
    </Container>
  )
}

function Line({
  line,
  tokens,
}: {
  line: DiffLine
  tokens: HighlightToken[] | null
}) {
  const mark = oldSideGutter(line)
  return (
    <LineRow $type={line.type}>
      <LineNo $kind={mark.kind}>{mark.label}</LineNo>
      <HighlightedContent tokens={tokens} fallback={line.content} />
    </LineRow>
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

// Old (before) and new (after) are no longer row-aligned: the new side now
// shows the whole file, not just this hunk's lines, so a narrow, resizable
// reference strip on the left and a wide, prioritized pane on the right
// replace the old equal-width paired columns. Column width is a genuinely
// dynamic runtime value (live drag position), so it's set via inline style
// rather than a styled-components prop. grid-template-rows uses minmax(0,
// 1fr) rather than 1fr alone so the row can actually shrink to the
// container's height instead of growing to fit content — the grid
// equivalent of flexbox's min-height:0 gotcha.
const Rows = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const OldSide = styled.div`
  min-height: 0;
  overflow: auto;
  background: ${HIGHLIGHT_EDITOR_BG};
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
  background: ${HIGHLIGHT_EDITOR_BG};
`

const LineRow = styled.div<{ $type: DiffLine['type'] }>`
  display: flex;
  align-items: flex-start;
  padding: 0 ${({ theme }) => theme.spacing[2]};
  background: ${({ $type, theme }) => {
    if ($type === 'add') return theme.colors.diffAddBg
    if ($type === 'del') return theme.colors.diffDelBg
    return 'transparent'
  }};
`

const LineNo = styled.span<{ $kind: 'add' | 'del' | 'context' }>`
  width: 36px;
  flex: none;
  text-align: right;
  padding-right: ${({ theme }) => theme.spacing[2]};
  color: ${({ $kind, theme }) => {
    if ($kind === 'add') return theme.colors.success
    if ($kind === 'del') return theme.colors.danger
    return theme.colors.muted
  }};
  user-select: none;
`
