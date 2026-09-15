import {
  createHighlighterCore,
  getTokenStyleObject,
  type HighlighterCore,
  type ThemedToken,
} from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

// Utils
import type { HighlightLanguage } from './language'

// Interim default until #21 wires Tokyo Night Night.
export const DEFAULT_HIGHLIGHT_THEME = 'github-light'

export type HighlightToken = ThemedToken

export type HighlightLine = HighlightToken[]

let highlighterPromise: Promise<HighlighterCore> | null = null

function loadHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    // Explicit imports (not `import(\`...\${lang}\`)`) so Vite can resolve
    // and split each grammar. Matches the focused set in `language.ts`.
    highlighterPromise = createHighlighterCore({
      themes: [import('@shikijs/themes/github-light')],
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
