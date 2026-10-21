import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

// Components
import { Panel } from '../Panel'

// Utils
import { renderWithTheme } from '../../../test/render'

function renderPanel() {
  return renderWithTheme(
    <Panel title="Diff" name="diff" expandable>
      <textarea aria-label="content" defaultValue="" />
    </Panel>,
  )
}

describe('Panel', () => {
  it('collapses its body without unmounting it, and expands it again', async () => {
    const user = userEvent.setup()
    renderPanel()
    const content = screen.getByLabelText('content')
    await user.type(content, 'kept')

    await user.click(screen.getByRole('button', { name: 'Collapse diff' }))
    expect(content).not.toBeVisible()
    expect(screen.getByRole('button', { name: 'Expand diff' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Expand diff' }))
    expect(screen.getByLabelText('content')).toBe(content)
    expect(content).toBeVisible()
    expect(content).toHaveValue('kept')
  })

  it('opens the same element as a larger modal view, keeping its content', async () => {
    const user = userEvent.setup()
    renderPanel()
    const content = screen.getByLabelText('content')
    await user.type(content, 'kept')

    await user.click(
      screen.getByRole('button', { name: 'Open diff in a larger view' }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Diff' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toContainElement(content)
    expect(content).toHaveValue('kept')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close larger diff view' }),
    )
    expect(screen.queryByRole('button', { name: 'Collapse diff' })).toBeNull()
  })

  it('closes the larger view with Escape, the close button, or the backdrop', async () => {
    const user = userEvent.setup()
    renderPanel()
    const open = () =>
      user.click(
        screen.getByRole('button', { name: 'Open diff in a larger view' }),
      )

    await open()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Open diff in a larger view' }),
    )

    await open()
    await user.click(
      screen.getByRole('button', { name: 'Close larger diff view' }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    await open()
    await user.click(screen.getByTestId('panel-backdrop'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opening the larger view un-collapses the panel', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Collapse diff' }))

    await user.click(
      screen.getByRole('button', { name: 'Open diff in a larger view' }),
    )

    expect(screen.getByLabelText('content')).toBeVisible()
  })

  it('shows a badge, and omits buttons it has no use for', () => {
    renderWithTheme(
      <Panel tone="agent" badge="agent" title="Title only" name="summary" />,
    )

    expect(
      screen.getByRole('region', { name: 'agent Title only' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Collapse summary' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Open summary in a larger view' }),
    ).toBeNull()
  })

  it('only offers the larger view when expandable', () => {
    renderWithTheme(
      <Panel title="Explanation" name="explanation">
        <p>text</p>
      </Panel>,
    )

    expect(
      screen.getByRole('button', { name: 'Collapse explanation' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: 'Open explanation in a larger view',
      }),
    ).toBeNull()
  })
})
