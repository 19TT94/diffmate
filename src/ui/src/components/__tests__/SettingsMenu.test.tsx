import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Contexts
import { SettingsProvider } from '../../contexts/SettingsContext'

// Components
import { SettingsMenu } from '../SettingsMenu'

// Utils
import * as api from '../../lib/api'
import { diffTint } from '../../lib/settingsTheme'

// Styles
import { theme } from '../../styles/theme'

// Types
import type { Settings } from '../../types'

vi.mock('../../lib/api', () => ({
  fetchSettings: vi.fn(),
  patchSettings: vi.fn(),
}))

function ThemeProbe() {
  const { colors } = useTheme()
  return (
    <output data-testid="probe">
      {colors.agent}|{colors.primary}|{colors.diffAddBg}
    </output>
  )
}

async function renderMenu(saved: Settings = {}) {
  vi.mocked(api.fetchSettings).mockResolvedValue(saved)
  render(
    <SettingsProvider>
      <button>outside</button>
      <SettingsMenu />
      <ThemeProbe />
    </SettingsProvider>,
  )
  await waitFor(() => expect(api.fetchSettings).toHaveBeenCalled())
  // Let the fetched settings land.
  await act(async () => {})
}

function cog(): HTMLElement {
  return screen.getByRole('button', { name: 'Settings' })
}

function dialog(): HTMLElement | null {
  return screen.queryByRole('dialog', { name: 'Display settings' })
}

describe('SettingsMenu', () => {
  beforeEach(() => {
    vi.mocked(api.fetchSettings).mockReset()
    vi.mocked(api.patchSettings).mockReset()
    vi.mocked(api.patchSettings).mockImplementation(async () => ({}))
  })

  it('opens from the cog and closes on a second click, Escape, or an outside click', async () => {
    const user = userEvent.setup()
    await renderMenu()
    expect(dialog()).toBeNull()

    await user.click(cog())
    expect(dialog()).not.toBeNull()
    expect(cog()).toHaveAttribute('aria-expanded', 'true')
    await user.click(cog())
    expect(dialog()).toBeNull()

    await user.click(cog())
    await user.keyboard('{Escape}')
    expect(dialog()).toBeNull()

    await user.click(cog())
    await user.click(screen.getByText('outside'))
    expect(dialog()).toBeNull()
  })

  it('shows the current colors and recolors live, saving once when the picker closes', async () => {
    const user = userEvent.setup()
    await renderMenu({ colors: { primary: '#222244' } })
    await user.click(cog())

    const agent = screen.getByLabelText('Agent card') as HTMLInputElement
    const primary = screen.getByLabelText('Primary') as HTMLInputElement
    expect(agent.value).toBe(theme.colors.agent)
    expect(primary.value).toBe('#222244')

    fireEvent.input(agent, { target: { value: '#123456' } })
    expect(screen.getByTestId('probe').textContent).toContain('#123456')
    expect(api.patchSettings).not.toHaveBeenCalled()

    fireEvent.change(agent, { target: { value: '#123456' } })
    expect(api.patchSettings).toHaveBeenCalledTimes(1)
    expect(api.patchSettings).toHaveBeenCalledWith({
      colors: { agent: '#123456' },
    })
  })

  it('has intensity sliders that recolor live and save once on release', async () => {
    const user = userEvent.setup()
    await renderMenu({ colors: { diffDelIntensity: 0.8 } })
    await user.click(cog())

    const added = screen.getByLabelText('Added lines') as HTMLInputElement
    const removed = screen.getByLabelText('Removed lines') as HTMLInputElement
    expect(added.value).toBe('30')
    expect(removed.value).toBe('80')

    fireEvent.input(added, { target: { value: '60' } })
    fireEvent.input(added, { target: { value: '70' } })
    expect(screen.getByTestId('probe').textContent).toContain(
      diffTint('add', 0.7),
    )
    expect(api.patchSettings).not.toHaveBeenCalled()

    const preview = screen.getByTestId('Added lines preview')
    expect(preview).toHaveAttribute('aria-hidden', 'true')
    expect(
      (preview.firstElementChild as HTMLElement).style.backgroundColor,
    ).toBe(diffTint('add', 0.7))

    fireEvent.change(added, { target: { value: '70' } })
    expect(api.patchSettings).toHaveBeenCalledTimes(1)
    expect(api.patchSettings).toHaveBeenCalledWith({
      colors: { diffAddIntensity: 0.7 },
    })
  })

  it('resets every color in one save and leaves the sidebar width alone', async () => {
    const user = userEvent.setup()
    await renderMenu({
      colors: { agent: '#123456', diffAddIntensity: 0.9 },
      fileListWidth: 360,
    })
    await user.click(cog())

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))

    expect(api.patchSettings).toHaveBeenCalledTimes(1)
    expect(api.patchSettings).toHaveBeenCalledWith({ colors: null })
    expect(
      (screen.getByLabelText('Agent card') as HTMLInputElement).value,
    ).toBe(theme.colors.agent)
    expect(
      (screen.getByLabelText('Added lines') as HTMLInputElement).value,
    ).toBe('30')
  })

  it('moves focus into the popover on open and back to the cog on Escape', async () => {
    const user = userEvent.setup()
    await renderMenu()

    await user.click(cog())
    expect(document.activeElement).toBe(screen.getByLabelText('Agent card'))

    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(cog())
  })

  it('says the settings are saved for every review on this computer', async () => {
    const user = userEvent.setup()
    await renderMenu()
    await user.click(cog())

    expect(dialog()?.textContent).toMatch(
      /saved for every review on this computer/i,
    )
  })
})
