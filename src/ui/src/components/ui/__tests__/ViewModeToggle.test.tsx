import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Components
import { ViewModeToggle } from '../ViewModeToggle'

// Utils
import { renderWithTheme } from '../../../test/render'

describe('ViewModeToggle', () => {
  it('marks the active layout and reports switches', async () => {
    const user = userEvent.setup()
    const onLayoutChange = vi.fn()
    renderWithTheme(
      <ViewModeToggle layout="stacked" onLayoutChange={onLayoutChange} />,
    )

    const stacked = document.querySelector(
      'button[title="Stack the diff above the file"]',
    ) as HTMLButtonElement
    const sideBySide = document.querySelector(
      'button[title="Show the diff and file side by side"]',
    ) as HTMLButtonElement

    expect(stacked.getAttribute('aria-pressed')).toBe('true')
    expect(sideBySide.getAttribute('aria-pressed')).toBe('false')

    await user.click(sideBySide)
    expect(onLayoutChange).toHaveBeenCalledWith('side-by-side')

    await user.click(stacked)
    expect(onLayoutChange).toHaveBeenCalledWith('stacked')
  })
})
