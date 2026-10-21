import styled from 'styled-components'

// Components
import { Panel, PanelText } from './ui/Panel'

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
    <Wrap>
      <Panel
        tone="agent"
        badge="agent"
        name="summary"
        title={title ?? 'Summary'}
      >
        {summary && <PanelText>{summary}</PanelText>}
      </Panel>
    </Wrap>
  )
}

// Style Overrides
// Sits at the top of the diff column, above the hunk.
const Wrap = styled.div`
  flex: none;
  margin-bottom: ${({ theme }) => theme.spacing[3]};
`
