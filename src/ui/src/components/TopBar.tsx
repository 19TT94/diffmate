import styled from 'styled-components'

// Components
import { Button } from './ui/Button'
import { SettingsMenu } from './SettingsMenu'

// Types
import type { FlatHunk } from '../hooks/useReviewSession'

// The "?" button's state; MCP reviews only (a CLI review has no agent).
export interface ConversationToggle {
  open: boolean
  // Answers that arrived since the drawer was last open.
  unseen: number
  // Some question is still waiting on the agent.
  waiting: boolean
  onToggle: () => void
}

interface TopBarProps {
  hunks: FlatHunk[]
  reviewComplete: boolean
  onSubmit: () => void
  conversation: ConversationToggle | null
}

export function TopBar({
  hunks,
  reviewComplete,
  onSubmit,
  conversation,
}: TopBarProps) {
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
      {conversation && (
        <IconButton
          type="button"
          aria-label="Conversation"
          title="Ask the agent"
          aria-expanded={conversation.open}
          onClick={conversation.onToggle}
        >
          ?
          {conversation.unseen > 0 ? (
            <Unseen
              title={`${conversation.unseen} new ${
                conversation.unseen === 1 ? 'answer' : 'answers'
              }`}
            >
              {conversation.unseen}
            </Unseen>
          ) : (
            conversation.waiting && <Waiting title="Waiting for answers" />
          )}
        </IconButton>
      )}
      <SettingsMenu />
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

// Matches the settings cog beside it.
const IconButton = styled.button`
  position: relative;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.tertiary};
  color: ${({ theme }) => theme.colors.muted};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  cursor: pointer;

  &:hover,
  &[aria-expanded='true'] {
    color: ${({ theme }) => theme.colors.secondary};
    background: ${({ theme }) => theme.colors.background};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 1px;
  }
`

const Unseen = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 1rem;
  height: 1rem;
  padding: 0 3px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: 10px;
  line-height: 1rem;
  color: ${({ theme }) => theme.colors.onAgent};
  background: ${({ theme }) => theme.colors.agent};
`

const Waiting = styled.span`
  position: absolute;
  top: -3px;
  right: -3px;
  width: 8px;
  height: 8px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.agent};
`
