import {
  createHighlighterCore,
  getTokenStyleObject,
  type HighlighterCore,
  type ThemedToken,
} from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

// Utils
import type { HighlightLanguage } from './language'

// Default Shiki theme: VS Code "Tokyo Night" (`tokyo-night`), the stock
// port closest to nvim `tokyonight-night` / WezTerm `tokyonight_night` in
// workspace-setup. Custom nvim `on_highlights` overrides are out of scope
// here (#23). Bg/fg match the theme's editor.* colors so code panes stay
// readable on the light app chrome.
export const DEFAULT_HIGHLIGHT_THEME = 'tokyo-night'
export const HIGHLIGHT_EDITOR_BG = '#1a1b26'
export const HIGHLIGHT_EDITOR_FG = '#a9b1d6'

export type HighlightToken = ThemedToken

export type HighlightLine = HighlightToken[]

let highlighterPromise: Promise<HighlighterCore> | null = null

function loadHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    // Explicit imports (not `import(\`...\${lang}\`)`) so Vite can resolve
    // and split each grammar. Matches the focused set in `language.ts`.
    highlighterPromise = createHighlighterCore({
      themes: [import('@shikijs/themes/tokyo-night')],
      langs: [
        () => import('@shikijs/langs/bash'),
        () => import('@shikijs/langs/css'),
        () => import('@shikijs/langs/dockerfile'),
        () => import('@shikijs/langs/go'),
        () => import('@shikijs/langs/html'),
        () => import('@shikijs/langs/javascript'),
        () => import('@shikijs/langs/json'),
        () => import('@shikijs/langs/lua'),
        () => import('@shikijs/langs/markdown'),
        () => import('@shikijs/langs/python'),
        () => import('@shikijs/langs/sql'),
        () => import('@shikijs/langs/terraform'),
        () => import('@shikijs/langs/toml'),
        () => import('@shikijs/langs/tsx'),
        () => import('@shikijs/langs/typescript'),
        () => import('@shikijs/langs/vue'),
        () => import('@shikijs/langs/yaml'),
      ],
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

function plainLines(code: string): HighlightLine[] {
  let offset = 0
  return code.split('\n').map((content) => {
    const token: HighlightToken = { content, offset }
    offset += content.length + 1
    return [token]
  })
}

// Tokenize `code` into per-line Shiki tokens. Falls back to plain-text
// tokens for unknown languages or if the highlighter fails to load.
export async function highlightLines(
  code: string,
  lang: HighlightLanguage,
): Promise<HighlightLine[]> {
  if (lang === 'text') return plainLines(code)

  try {
    const highlighter = await loadHighlighter()
    const { tokens } = highlighter.codeToTokens(code, {
      lang,
      theme: DEFAULT_HIGHLIGHT_THEME,
    })
    return tokens
  } catch {
    return plainLines(code)
  }
}

export function tokenStyle(
  token: HighlightToken,
): ReturnType<typeof getTokenStyleObject> | undefined {
  if (token.color == null && token.fontStyle == null) return undefined
  return getTokenStyleObject(token)
}
