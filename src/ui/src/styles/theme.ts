// Utils
import { readableOnWhite, readableTextOn } from '../lib/color'
import { DEFAULT_DIFF_INTENSITY, diffTint } from '../lib/settingsTheme'

const slate = '#f6f8fa'
const black = '#1f2328'
const white = '#ffffff'
const green = '#1a7f37'
const red = '#cf222e'
const blue = '#0969da'
const amber = '#9a6700'
const coral = '#f06543'
const mutedGray = '#59636e'
const borderGray = '#d0d7de'

export const theme = {
  colors: {
    background: slate,
    primary: blue,
    // Text drawn on primary/agent fills; recomputed when a user picks a fill.
    onPrimary: readableTextOn(blue),
    secondary: black,
    tertiary: white,
    muted: mutedGray,
    border: borderGray,
    success: green,
    danger: red,
    accent: amber,
    agent: coral,
    onAgent: readableTextOn(coral),
    // Agent-colored text on a white pill (the AGENT badge).
    agentOnWhite: readableOnWhite(coral),
    diffAddBg: diffTint('add', DEFAULT_DIFF_INTENSITY),
    diffDelBg: diffTint('del', DEFAULT_DIFF_INTENSITY),
  },
  fonts: {
    body: 'system-ui, -apple-system, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.8125rem',
    base: '1rem',
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  radii: {
    sm: '2px',
    md: '0.375rem',
    lg: '0.5rem',
    full: '9999px',
  },
  spacing: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
  },
} as const

// Widened from the literal `as const` values so user settings can swap in
// any color at runtime.
type Widen<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends number
      ? number
      : Widen<T[K]>
}

export type AppTheme = Widen<typeof theme>
