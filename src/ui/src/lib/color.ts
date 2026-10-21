const WHITE = '#ffffff'
// Matches the theme's text color (secondary).
const NEAR_BLACK = '#1f2328'

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function linearChannel(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

// WCAG relative luminance.
function luminance(hex: string): number {
  const [r, g, b] = channels(hex)
  return (
    0.2126 * linearChannel(r) +
    0.7152 * linearChannel(g) +
    0.0722 * linearChannel(b)
  )
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Text color for content drawn on `fill`, so any user-picked color stays
// readable.
export function readableTextOn(fill: string): string {
  return contrastRatio(WHITE, fill) >= contrastRatio(NEAR_BLACK, fill)
    ? WHITE
    : NEAR_BLACK
}

// `color` itself when it reads as text on white (WCAG AA, 4.5:1), else
// near-black, e.g. for a white pill labeled in a user-picked color.
export function readableOnWhite(color: string): string {
  return contrastRatio(color, WHITE) >= 4.5 ? color : NEAR_BLACK
}

// `hex` at the given opacity, for tints laid over another background.
export function translucent(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`
}
