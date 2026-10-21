import userEvent from '@testing-library/user-event'
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

  it('collapses the summary and keeps the title visible, then expands again', async () => {
    const user = userEvent.setup()
    const { getByRole, getByText } = renderWithTheme(
      <AgentContext mode="mcp" title="My change" summary="Why it exists." />,
    )

    const toggle = getByRole('button', { name: 'Collapse summary' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(getByText('Why it exists.')).not.toBeVisible()
    expect(getByText('My change')).toBeTruthy()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(getByRole('button', { name: 'Expand summary' }))
    expect(getByText('Why it exists.')).toBeVisible()
  })

  it('has no collapse toggle when there is only a title', () => {
    const { queryByRole } = renderWithTheme(
      <AgentContext mode="mcp" title="Only a title" summary={null} />,
    )

    expect(queryByRole('button')).toBeNull()
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
