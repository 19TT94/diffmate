import { useContext } from 'react'

// Contexts
import { SettingsContext } from '../contexts/settings'
import type { SettingsContextValue } from '../contexts/settings'

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used in SettingsProvider')
  return value
}
