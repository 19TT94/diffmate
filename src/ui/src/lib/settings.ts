// Types
import type { Settings, SettingsColors, SettingsPatch } from '../types'

// Same merge as engine/settings.ts mergeSettings, so the UI can apply a
// change before the server confirms it: patch fields replace, null removes.
export function mergeSettings(
  current: Settings,
  patch: SettingsPatch,
): Settings {
  const next: Settings = { ...current }

  if (patch.colors === null) {
    delete next.colors
  } else if (patch.colors) {
    const colors: SettingsColors = { ...current.colors }
    // Keys come from a typed patch, so they are SettingsColors keys.
    for (const key of Object.keys(patch.colors) as (keyof SettingsColors)[]) {
      const value = patch.colors[key]
      if (value === null) delete colors[key]
      else if (value !== undefined) Object.assign(colors, { [key]: value })
    }
    if (Object.keys(colors).length > 0) next.colors = colors
    else delete next.colors
  }

  if (patch.fileListWidth === null) delete next.fileListWidth
  else if (patch.fileListWidth !== undefined) {
    next.fileListWidth = patch.fileListWidth
  }
  return next
}
