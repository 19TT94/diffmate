import styled from 'styled-components'

// Components
import { Button } from './ui/Button'

// Types
import type { FlatHunk } from '../hooks/useReviewSession'

interface TopBarProps {
  hunks: FlatHunk[]
  reviewComplete: boolean
  onSubmit: () => void
}

export function TopBar({ hunks, reviewComplete, onSubmit }: TopBarProps) {
  const approved = hunks.filter(
    (entry) => entry.hunk.status === 'approved',
  ).length
  const rejected = hunks.filter(
    (entry) => entry.hunk.status === 'rejected',
  ).length
  const pending = hunks.filter(
    (entry) => entry.hunk.status === 'pending',
  ).length
  const commented = hunks.filter((entry) => entry.hunk.comment).length

  return (
    <Bar>
      <Brand>diffmate</Brand>
      <Counts>
        <Count $tone="success">{approved} approved</Count>
        <Count $tone="danger">{rejected} rejected</Count>
        <Count $tone="accent">{pending} pending</Count>
        {commented > 0 && <Count>{commented} commented</Count>}
      </Counts>
      <Button variant="primary" disabled={reviewComplete} onClick={onSubmit}>
        Submit review (⌘↵)
      </Button>
    </Bar>
  )
}

// Style Overrides
const Bar = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.background};
`

const Brand = styled.div`
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`

const Counts = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.muted};
  flex: 1;
`

const Count = styled.span<{ $tone?: 'success' | 'danger' | 'accent' }>`
  color: ${({ theme, $tone }) => ($tone ? theme.colors[$tone] : 'inherit')};
`
