import { act, render, screen, waitFor } from '@testing-library/react'
import { useTheme } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Contexts
import { SettingsProvider } from '../SettingsContext'

// Hooks
import { useSettings } from '../../hooks/useSettings'

// Utils
import * as api from '../../lib/api'

// Styles
import { theme } from '../../styles/theme'

vi.mock('../../lib/api', () => ({
  fetchSettings: vi.fn(),
  patchSettings: vi.fn(),
}))

function Probe() {
  const { colors } = useTheme()
  const { settings, updateSettings } = useSettings()
  return (
    <div>
      <span data-testid="agent">{colors.agent}</span>
      <span data-testid="width">{settings.fileListWidth ?? 'none'}</span>
      <button onClick={() => updateSettings({ fileListWidth: 320 })}>
        widen
      </button>
    </div>
  )
}

describe('SettingsProvider', () => {
  beforeEach(() => {
    vi.mocked(api.fetchSettings).mockReset()
    vi.mocked(api.patchSettings).mockReset()
  })

  it('loads saved settings into the theme at startup', async () => {
    vi.mocked(api.fetchSettings).mockResolvedValue({
      colors: { agent: '#222244' },
    })
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('agent').textContent).toBe('#222244'),
    )
    expect(api.fetchSettings).toHaveBeenCalledTimes(1)
  })

  it('renders with default colors when loading settings fails', async () => {
    vi.mocked(api.fetchSettings).mockRejectedValue(new Error('offline'))
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )

    await waitFor(() => expect(api.fetchSettings).toHaveBeenCalled())
    expect(screen.getByTestId('agent').textContent).toBe(theme.colors.agent)
  })

  it('applies an update immediately and saves it in the background', async () => {
    vi.mocked(api.fetchSettings).mockResolvedValue({})
    let resolveSave: () => void = () => {}
    vi.mocked(api.patchSettings).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = () => resolve({ fileListWidth: 320 })
      }),
    )
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    await waitFor(() => expect(api.fetchSettings).toHaveBeenCalled())

    act(() => screen.getByText('widen').click())

    expect(screen.getByTestId('width').textContent).toBe('320')
    expect(api.patchSettings).toHaveBeenCalledWith({ fileListWidth: 320 })
    await act(async () => resolveSave())
  })

  it('keeps an update for this review when saving it fails', async () => {
    vi.mocked(api.fetchSettings).mockResolvedValue({})
    vi.mocked(api.patchSettings).mockRejectedValue(new Error('disk full'))
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    await waitFor(() => expect(api.fetchSettings).toHaveBeenCalled())

    await act(async () => screen.getByText('widen').click())

    expect(screen.getByTestId('width').textContent).toBe('320')
  })

  it('keeps a change made before the saved settings finish loading', async () => {
    let resolveLoad: (settings: object) => void = () => {}
    vi.mocked(api.fetchSettings).mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve
      }),
    )
    vi.mocked(api.patchSettings).mockResolvedValue({})
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )

    act(() => screen.getByText('widen').click())
    await act(async () =>
      resolveLoad({ fileListWidth: 280, colors: { agent: '#222244' } }),
    )

    expect(screen.getByTestId('width').textContent).toBe('320')
    expect(screen.getByTestId('agent').textContent).toBe('#222244')
  })
})
