import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it } from 'vitest'

// Components
import { CodeEditor } from '../CodeEditor'

// Styles
import { theme } from '../../styles/theme'

// Types
import type { DiffLine } from '../../types'

const lines: DiffLine[] = [
  { type: 'del', content: 'old', oldLineNumber: 1, newLineNumber: null },
  { type: 'add', content: 'new', oldLineNumber: null, newLineNumber: 1 },
]

// CodeMirror mounts its theme rules as <style> text in jsdom.
function injectedCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n')
}

describe('CodeEditor', () => {
  it('recolors diff rows when the theme diff colors change, without remounting', () => {
    const withColors = (diffAddBg: string, diffDelBg: string) => (
      <ThemeProvider
        theme={{ ...theme, colors: { ...theme.colors, diffAddBg, diffDelBg } }}
      >
        <CodeEditor
          filePath="a.ts"
          mode="diff"
          diffLines={lines}
          diffNumberSide="old"
        />
      </ThemeProvider>
    )
    const { container, rerender } = render(withColors('#aaffaa', '#ffaaaa'))
    const editor = container.querySelector('.cm-editor')

    rerender(withColors('#123456', '#654321'))

    expect(container.querySelector('.cm-editor')).toBe(editor)
    expect(injectedCss()).toContain('#123456')
    expect(injectedCss()).toContain('#654321')
  })
})
