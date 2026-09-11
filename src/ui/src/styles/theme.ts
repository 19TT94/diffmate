const slate = '#f6f8fa'
const black = '#1f2328'
const white = '#ffffff'
const green = '#1a7f37'
const red = '#cf222e'
const blue = '#0969da'
const amber = '#9a6700'
const mutedGray = '#59636e'
const borderGray = '#d0d7de'
const addBg = '#e6ffec'
const delBg = '#ffebe9'

export const theme = {
  colors: {
    background: slate,
    primary: blue,
    secondary: black,
    tertiary: white,
    muted: mutedGray,
    border: borderGray,
    success: green,
    danger: red,
    accent: amber,
    diffAddBg: addBg,
    diffDelBg: delBg,
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

export type AppTheme = typeof theme
