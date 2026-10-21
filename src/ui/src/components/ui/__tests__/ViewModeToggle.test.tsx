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
      <ViewModeToggle layout="inline" onLayoutChange={onLayoutChange} />,
    )

    const inline = document.querySelector(
      'button[title="Show one inline diff"]',
    ) as HTMLButtonElement
    const sideBySide = document.querySelector(
      'button[title="Show old and new side by side"]',
    ) as HTMLButtonElement

    expect(inline.getAttribute('aria-pressed')).toBe('true')
    expect(sideBySide.getAttribute('aria-pressed')).toBe('false')

    await user.click(sideBySide)
    expect(onLayoutChange).toHaveBeenCalledWith('side-by-side')

    await user.click(inline)
    expect(onLayoutChange).toHaveBeenCalledWith('inline')
  })
})
