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
    renderWithTheme(<SideBySideDiff hunk={fixtureHunk()} filePath="a.ts" />)

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
})
