import styled from 'styled-components'

// Types
import type { SessionMode } from '../types'

interface AgentContextProps {
  mode: SessionMode
  title: string | null
  summary: string | null
}

// The agent's framing of the review, supplied by MCP start_review and read
// from the session summary. Hidden for CLI reviews (mode 'cli').
export function AgentContext({ mode, title, summary }: AgentContextProps) {
  if (mode !== 'mcp' || (!title && !summary)) return null

  return (
    <Strip>
      <Badge>agent</Badge>
      <Text>
        {title && <Title>{title}</Title>}
        {summary && <Summary>{summary}</Summary>}
      </Text>
    </Strip>
  )
}

// Style Overrides
const Strip = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[4]};
  background: ${({ theme }) => theme.colors.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const Badge = styled.span`
  flex: none;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.accent};
`

const Text = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`

const Title = styled.p`
  margin: 0;
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`

const Summary = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`
