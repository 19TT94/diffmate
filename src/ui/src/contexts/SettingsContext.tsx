import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'

// Contexts
import { SettingsContext } from './settings'
import type { SettingsContextValue } from './settings'

// Utils
import { fetchSettings, patchSettings } from '../lib/api'
import { mergeSettings } from '../lib/settings'
import { applySettings } from '../lib/settingsTheme'

// Styles
import { theme as baseTheme } from '../styles/theme'

// Types
import type { Settings, SettingsPatch } from '../types'

// Loads the user's saved settings once and themes the app with them.
// Updates apply immediately and save in the background; a failed save keeps
// the change for this review rather than snapping back.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({})
  // Changes made before the saved settings arrive; replayed over them on
  // load so an early drag or pick isn't snapped back.
  const earlyPatches = useRef<SettingsPatch[] | null>([])

  useEffect(() => {
    let cancelled = false
    fetchSettings()
      .then((saved) => {
        if (cancelled) return
        const patches = earlyPatches.current ?? []
        earlyPatches.current = null
        setSettings(patches.reduce(mergeSettings, saved))
      })
      .catch(() => {
        // Defaults are fine; the review must not depend on settings.
        earlyPatches.current = null
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      previewSettings: (patch) => {
        earlyPatches.current?.push(patch)
        setSettings((current) => mergeSettings(current, patch))
      },
      updateSettings: (patch) => {
        earlyPatches.current?.push(patch)
        setSettings((current) => mergeSettings(current, patch))
        patchSettings(patch).catch(() => {
          // Kept for this review; just not remembered next time.
        })
      },
    }),
    [settings],
  )
  const theme = useMemo(() => applySettings(baseTheme, settings), [settings])

  return (
    <SettingsContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </SettingsContext.Provider>
  )
}
