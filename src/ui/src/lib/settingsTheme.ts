// Utils
import { readableOnWhite, readableTextOn, translucent } from './color'

// Styles
import type { AppTheme } from '../styles/theme'

// Types
import type { Settings } from '../types'

// Diff rows sit in the dark code pane, so each tint is a translucent wash of
// one fixed green or red over it; intensity only sets the opacity, which
// keeps the pane's light syntax colors readable.
const DIFF_HUES = { add: '#2ea043', del: '#f85149' } as const
const MIN_ALPHA = 0.1
const MAX_ALPHA = 0.5
export const DEFAULT_DIFF_INTENSITY = 0.3

export function diffTint(kind: 'add' | 'del', intensity: number): string {
  return translucent(
    DIFF_HUES[kind],
    MIN_ALPHA + intensity * (MAX_ALPHA - MIN_ALPHA),
  )
}

// Layers the user's saved settings over the base theme. Anything not saved
// keeps the base value, so empty settings reproduce the base theme.
export function applySettings(base: AppTheme, settings: Settings): AppTheme {
  const saved = settings.colors ?? {}
  const agent = saved.agent ?? base.colors.agent
  const primary = saved.primary ?? base.colors.primary
  return {
    ...base,
    colors: {
      ...base.colors,
      agent,
      onAgent: saved.agent ? readableTextOn(agent) : base.colors.onAgent,
      agentOnWhite: saved.agent
        ? readableOnWhite(agent)
        : base.colors.agentOnWhite,
      primary,
      onPrimary: saved.primary
        ? readableTextOn(primary)
        : base.colors.onPrimary,
      diffAddBg:
        saved.diffAddIntensity === undefined
          ? base.colors.diffAddBg
          : diffTint('add', saved.diffAddIntensity),
      diffDelBg:
        saved.diffDelIntensity === undefined
          ? base.colors.diffDelBg
          : diffTint('del', saved.diffDelIntensity),
    },
  }
}
