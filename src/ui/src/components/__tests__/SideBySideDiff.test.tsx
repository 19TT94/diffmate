import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

// Components
import { SideBySideDiff } from '../SideBySideDiff'

// Utils
import { renderWithTheme } from '../../test/render'

// Types
import type { Hunk } from '../../types'

function fixtureHunk(overrides: Partial<Hunk> = {}): Hunk {
  return {
    id: 'a.ts@@hunk1',
    header: '@@ -1,2 +1,2 @@',
    oldStart: 1,
    oldLines: 2,
    newStart: 1,
    newLines: 2,
    lines: [
      {
        type: 'del',
        content: 'removed line',
        oldLineNumber: 1,
        newLineNumber: null,
      },
      {
        type: 'add',
        content: 'added line',
        oldLineNumber: null,
        newLineNumber: 1,
      },
      {
        type: 'context',
        content: 'kept line',
        oldLineNumber: 2,
        newLineNumber: 2,
      },
    ],
    status: 'pending',
    summary: null,
    comment: null,
    editedContent: null,
    questions: [],
    ...overrides,
  }
}

describe('SideBySideDiff', () => {
  it('prints deletions in the left column and additions on the right', async () => {
    renderWithTheme(
      <SideBySideDiff
        hunk={fixtureHunk()}
        filePath="a.ts"
        layout="side-by-side"
      />,
    )

    await waitFor(() => {
      const columns = document.querySelectorAll('.cm-content')
      expect(columns.length).toBe(2)
    })

    const [oldColumn, newColumn] = document.querySelectorAll('.cm-content')

    expect(oldColumn!.textContent).toContain('removed line')
    expect(oldColumn!.textContent).not.toContain('added line')
    expect(newColumn!.textContent).toContain('added line')
    expect(newColumn!.textContent).not.toContain('removed line')
    expect(oldColumn!.textContent).toContain('kept line')
    expect(newColumn!.textContent).toContain('kept line')
  })

  it('pads the old column with blank rows to line up with additions', async () => {
    renderWithTheme(
      <SideBySideDiff
        hunk={fixtureHunk({
          lines: [
            {
              type: 'context',
              content: 'kept line',
              oldLineNumber: 1,
              newLineNumber: 1,
            },
            {
              type: 'add',
              content: 'first new',
              oldLineNumber: null,
              newLineNumber: 2,
            },
            {
              type: 'add',
              content: 'second new',
              oldLineNumber: null,
              newLineNumber: 3,
            },
          ],
        })}
        filePath="a.ts"
        layout="side-by-side"
      />,
    )

    await waitFor(() => {
      expect(document.querySelectorAll('.cm-content')).toHaveLength(2)
    })
    const [oldColumn, newColumn] = document.querySelectorAll('.cm-content')
    expect(oldColumn!.querySelectorAll('.cm-line')).toHaveLength(3)
    expect(newColumn!.querySelectorAll('.cm-line')).toHaveLength(3)
  })

  it('shows one inline pane with removed and added lines interleaved in order', async () => {
    renderWithTheme(
      <SideBySideDiff hunk={fixtureHunk()} filePath="a.ts" layout="inline" />,
    )

    await waitFor(() => {
      expect(document.querySelectorAll('.cm-content')).toHaveLength(1)
    })
    const lines = Array.from(
      document.querySelectorAll('.cm-content .cm-line'),
    ).map((line) => line.textContent)
    expect(lines).toEqual(['removed line', 'added line', 'kept line'])
    expect(document.querySelector('.cm-diff-row-del')?.textContent).toBe(
      'removed line',
    )
    expect(document.querySelector('.cm-diff-row-add')?.textContent).toBe(
      'added line',
    )
  })

  it('switches between columns and the inline pane on a mounted diff', async () => {
    const hunk = fixtureHunk()
    const { rerender } = renderWithTheme(
      <SideBySideDiff hunk={hunk} filePath="a.ts" layout="side-by-side" />,
    )
    await waitFor(() => {
      expect(document.querySelectorAll('.cm-content')).toHaveLength(2)
    })

    rerender(<SideBySideDiff hunk={hunk} filePath="a.ts" layout="inline" />)

    await waitFor(() => {
      expect(document.querySelectorAll('.cm-content')).toHaveLength(1)
    })
  })
})
