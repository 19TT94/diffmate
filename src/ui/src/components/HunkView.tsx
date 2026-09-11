import { useState } from 'react'
import styled from 'styled-components'

// Components
import { Button } from './ui/Button'

// Utils
import { buildSideBySideRows } from '../lib/diff'

// Types
import type { DiffLine, Hunk, HunkStatus } from '../types'

interface HunkViewProps {
  hunk: Hunk
  isFocused: boolean
  onFocus: () => void
  onSetStatus: (status: HunkStatus) => void
  onSetComment: (comment: string | null) => void
}

export function HunkView({
  hunk,
  isFocused,
  onFocus,
  onSetStatus,
  onSetComment,
}: HunkViewProps) {
  const [draft, setDraft] = useState(hunk.comment ?? '')
  const rows = buildSideBySideRows(hunk.lines)

  function handleBlur(): void {
    const trimmed = draft.trim()
    if (trimmed !== (hunk.comment ?? '')) {
      onSetComment(trimmed === '' ? null : trimmed)
    }
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

      <Rows>
        <Side $side="left">
          {rows.map((row, index) => (
            <Line key={index} line={row.left} side="old" />
          ))}
        </Side>
        <Side $side="right">
          {rows.map((row, index) => (
            <Line key={index} line={row.right} side="new" />
          ))}
        </Side>
      </Rows>

      <CommentWrap>
        <textarea
          id={`comment-${hunk.id}`}
          placeholder="Leave a comment on this hunk…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
        />
      </CommentWrap>
    </Container>
  )
}

function Line({ line, side }: { line: DiffLine | null; side: 'old' | 'new' }) {
  if (!line) return <LineRow $type="empty" />
  const num = side === 'old' ? line.oldLineNumber : line.newLineNumber
  return (
    <LineRow $type={line.type}>
      <LineNo>{num === null ? '' : num}</LineNo>
      <span>{line.content}</span>
    </LineRow>
  )
}

// Style Overrides
const Container = styled.div<{ $focused: boolean }>`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  margin-bottom: ${({ theme }) => theme.spacing[3]};
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

const Rows = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const Side = styled.div<{ $side: 'left' | 'right' }>`
  overflow-x: auto;
  border-right: ${({ $side, theme }) => ($side === 'left' ? `1px solid ${theme.colors.border}` : 'none')};
`

const LineRow = styled.div<{ $type: DiffLine['type'] | 'empty' }>`
  display: flex;
  white-space: pre;
  padding: 0 ${({ theme }) => theme.spacing[2]};
  background: ${({ $type, theme }) => {
    if ($type === 'add') return theme.colors.diffAddBg
    if ($type === 'del') return theme.colors.diffDelBg
    if ($type === 'empty') return theme.colors.background
    return 'transparent'
  }};
`

const LineNo = styled.span`
  width: 36px;
  flex: none;
  text-align: right;
  padding-right: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.muted};
  user-select: none;
`

const CommentWrap = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};

  textarea {
    width: 100%;
    min-height: 44px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    padding: ${({ theme }) => theme.spacing[1]}
      ${({ theme }) => theme.spacing[2]};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.md};
    resize: vertical;
  }
`
