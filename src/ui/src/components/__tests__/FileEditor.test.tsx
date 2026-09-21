import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Components
import { FileEditor } from '../FileEditor'

// Utils
import { renderWithTheme } from '../../test/render'

// Types
import type { Hunk } from '../../types'

function fixtureHunk(overrides: Partial<Hunk> = {}): Hunk {
  return {
    id: 'a.txt@@hunk1',
    header: '@@ -1,2 +1,2 @@',
    oldStart: 1,
    oldLines: 2,
    newStart: 1,
    newLines: 2,
    lines: [
      { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'add', content: 'b', oldLineNumber: null, newLineNumber: 2 },
    ],
    status: 'pending',
    summary: null,
    comment: null,
    editedContent: null,
    questions: [],
    ...overrides,
  }
}

async function findEditor(): Promise<HTMLElement> {
  const element = document.querySelector('.cm-content')
  await waitFor(() => expect(element).not.toBeNull())
  return element as HTMLElement
}

describe('FileEditor', () => {
  it('renders the whole file, not just the hunk', async () => {
    renderWithTheme(
      <FileEditor
        content="one\ntwo\nthree"
        filePath="a.txt"
        hunk={fixtureHunk()}
        onDocChanged={() => {}}
      />,
    )

    const editor = await findEditor()
    expect(editor.textContent).toContain('one')
    expect(editor.textContent).toContain('two')
    expect(editor.textContent).toContain('three')
  })

  it('shows line numbers', async () => {
    renderWithTheme(
      <FileEditor
        content="one\ntwo"
        filePath="a.txt"
        hunk={fixtureHunk()}
        onDocChanged={() => {}}
      />,
    )

    await findEditor()
    await waitFor(() => {
      expect(document.querySelector('.cm-lineNumbers')).not.toBeNull()
    })
  })

  it('reports document changes', async () => {
    const user = userEvent.setup()
    const onDocChanged = vi.fn()
    renderWithTheme(
      <FileEditor
        content="one\ntwo"
        filePath="a.txt"
        hunk={fixtureHunk()}
        onDocChanged={onDocChanged}
      />,
    )

    const editor = await findEditor()
    await user.click(editor)
    await user.keyboard('x')

    await waitFor(() => {
      expect(onDocChanged).toHaveBeenCalled()
    })
    expect(onDocChanged).toHaveBeenCalledWith(expect.stringContaining('x'))
  })

  it('keeps edits when the focused hunk span changes', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithTheme(
      <FileEditor
        content="one\ntwo\nthree"
        filePath="a.txt"
        hunk={fixtureHunk()}
        onDocChanged={() => {}}
      />,
    )

    const editor = await findEditor()
    await user.click(editor)
    await user.keyboard('x')

    rerender(
      <FileEditor
        content="one\ntwo\nthree"
        filePath="a.txt"
        hunk={fixtureHunk({ id: 'a.txt@@hunk2', newStart: 3, newLines: 1 })}
        onDocChanged={() => {}}
      />,
    )

    await waitFor(() => {
      expect(document.querySelector('.cm-content')!.textContent).toContain('x')
    })
  })
})
