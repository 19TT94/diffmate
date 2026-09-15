import { useEffect, useState } from 'react'

// Utils
import { highlightLines, type HighlightLine } from '../lib/highlight'
import { languageFromPath } from '../lib/language'

// Highlights `code` for the language inferred from `filePath`. Returns
// null while the async highlighter is loading so callers can fall back to
// plain text (avoids a flash of empty content).
export function useHighlightedLines(
  code: string,
  filePath: string,
): HighlightLine[] | null {
  const [lines, setLines] = useState<HighlightLine[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const lang = languageFromPath(filePath)

    highlightLines(code, lang).then((result) => {
      if (!cancelled) setLines(result)
    })

    return () => {
      cancelled = true
    }
  }, [code, filePath])

  return lines
}
