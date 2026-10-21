import { describe, expect, it } from 'vitest'

// Utils
import { contrastRatio, readableTextOn } from '../color'
import {
  applySettings,
  DEFAULT_DIFF_INTENSITY,
  diffTint,
} from '../settingsTheme'

// Styles
import { theme } from '../../styles/theme'

// Parses "rgba(r, g, b, a)".
function rgba(color: string): { rgb: number[]; alpha: number } {
  const match = color.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/)
  if (!match) throw new Error(`not an rgba() color: ${color}`)
  return { rgb: match.slice(1, 4).map(Number), alpha: Number(match[4]) }
}

describe('applySettings', () => {
  it('leaves the theme exactly as-is with no saved settings', () => {
    expect(applySettings(theme, {})).toEqual(theme)
  })

  it('derives the default text-on-fill colors from the default fills', () => {
    expect(theme.colors.onAgent).toBe(readableTextOn(theme.colors.agent))
    expect(theme.colors.onPrimary).toBe(readableTextOn(theme.colors.primary))
  })

  it('applies saved agent and primary colors with matching text colors', () => {
    const next = applySettings(theme, {
      colors: { agent: '#222244', primary: '#ffd33d' },
    })

    expect(next.colors.agent).toBe('#222244')
    expect(next.colors.onAgent).toBe('#ffffff')
    expect(next.colors.primary).toBe('#ffd33d')
    expect(next.colors.onPrimary).toBe('#1f2328')
    expect(next.colors.accent).toBe(theme.colors.accent)
  })

  it('keeps agent-colored text on white readable for any agent color', () => {
    for (const agent of ['#f06543', '#ffd33d', '#222244', '#0969da']) {
      const { agentOnWhite } = applySettings(theme, {
        colors: { agent },
      }).colors
      expect(contrastRatio(agentOnWhite, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    }
    expect(
      applySettings(theme, { colors: { agent: '#222244' } }).colors
        .agentOnWhite,
    ).toBe('#222244')
  })

  it('turns saved diff intensities into add/delete backgrounds', () => {
    const next = applySettings(theme, {
      colors: { diffAddIntensity: 0.5, diffDelIntensity: 1 },
    })

    expect(next.colors.diffAddBg).toBe(diffTint('add', 0.5))
    expect(next.colors.diffDelBg).toBe(diffTint('del', 1))
  })
})

describe('diffTint', () => {
  it('is translucent, getting more opaque as intensity rises', () => {
    for (const kind of ['add', 'del'] as const) {
      const [low, mid, high] = [0, 0.5, 1].map(
        (i) => rgba(diffTint(kind, i)).alpha,
      )
      expect(low).toBeGreaterThan(0)
      expect(mid).toBeGreaterThan(low!)
      expect(high).toBeGreaterThan(mid!)
      expect(high).toBeLessThan(1)
    }
  })

  it('keeps one green and one red hue at every intensity', () => {
    const addHues = new Set<string>()
    const delHues = new Set<string>()
    for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
      const add = rgba(diffTint('add', intensity)).rgb
      expect(add[1]).toBeGreaterThan(add[0]!)
      expect(add[1]).toBeGreaterThan(add[2]!)
      addHues.add(add.join())
      const del = rgba(diffTint('del', intensity)).rgb
      expect(del[0]).toBeGreaterThan(del[1]!)
      expect(del[0]).toBeGreaterThan(del[2]!)
      delHues.add(del.join())
    }
    expect(addHues.size).toBe(1)
    expect(delHues.size).toBe(1)
  })

  it('backs the default diff colors when no intensity is saved', () => {
    expect(theme.colors.diffAddBg).toBe(diffTint('add', DEFAULT_DIFF_INTENSITY))
    expect(theme.colors.diffDelBg).toBe(diffTint('del', DEFAULT_DIFF_INTENSITY))
  })
})
