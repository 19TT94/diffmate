import { describe, expect, it } from 'vitest'

// Components
import { AgentContext } from '../AgentContext'

// Utils
import { renderWithTheme } from '../../test/render'

describe('AgentContext', () => {
  it('renders the agent badge, title, and summary for MCP sessions', () => {
    const { getByText } = renderWithTheme(
      <AgentContext
        mode="mcp"
        title="Add size variants to Button"
        summary="Claude added an optional sm/md size to Button."
      />,
    )

    expect(getByText('agent')).toBeTruthy()
    expect(getByText('Add size variants to Button')).toBeTruthy()
    expect(
      getByText('Claude added an optional sm/md size to Button.'),
    ).toBeTruthy()
  })

  it('renders the summary alone when the title is missing', () => {
    const { getByText, queryByText } = renderWithTheme(
      <AgentContext mode="mcp" title={null} summary="Just a summary." />,
    )

    expect(getByText('Just a summary.')).toBeTruthy()
    expect(queryByText('agent')).toBeTruthy()
  })

  it('hides entirely for CLI sessions', () => {
    const { container } = renderWithTheme(
      <AgentContext mode="cli" title="Nope" summary="Nope" />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('hides for MCP sessions without title or summary', () => {
    const { container } = renderWithTheme(
      <AgentContext mode="mcp" title={null} summary={null} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
