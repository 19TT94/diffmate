import styled from 'styled-components'

// Marks a hunk or file row that has a question still waiting on the agent.
export function QuestionMarker() {
  return <Marker title="Waiting on an answer from the agent">?</Marker>
}

// Style Overrides
const Marker = styled.span`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: ${({ theme }) => theme.radii.full};
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.agentOnWhite};
  background: color-mix(in srgb, currentColor 16%, transparent);
`
