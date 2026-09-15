import styled from 'styled-components'

// Utils
import { tokenStyle, type HighlightToken } from '../lib/highlight'

interface HighlightedContentProps {
  tokens: HighlightToken[] | null
  fallback: string
}

// Renders one line of Shiki tokens. Token colors are runtime values from
// the active theme, so they use the inline style prop (same exception as
// the resizable column width). Falls back to plain text until tokens are
// ready — keeps tests and first paint readable without waiting on Shiki.
export function HighlightedContent({
  tokens,
  fallback,
}: HighlightedContentProps) {
  if (tokens == null) {
    return <Content>{fallback}</Content>
  }

  return (
    <Content data-highlighted="">
      {tokens.map((token, index) => (
        <Token key={index} style={tokenStyle(token)}>
          {token.content}
        </Token>
      ))}
    </Content>
  )
}

// Style Overrides
const Content = styled.span`
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

const Token = styled.span``
