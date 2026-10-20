import { createContext } from 'react'

// Types
import type { Settings, SettingsPatch } from '../types'

export interface SettingsContextValue {
  settings: Settings
  // Applies and saves.
  updateSettings: (patch: SettingsPatch) => void
  // Applies without saving, for live feedback mid-drag; follow with
  // updateSettings to keep the change.
  previewSettings: (patch: SettingsPatch) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)
