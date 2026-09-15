import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Components
import { FullFileColumn } from '../FullFileColumn'

// Utils
import { renderWithTheme } from '../../test/render'

// Types
import type { Hunk } from '../../types'

function fixtureHunk(overrides: Partial<Hunk> = {}): Hunk {
  return {
    id: 'a.txt@@hunk1',
    header: '@@ -1,1 +2,2 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 2,
    newLines: 2,
    lines: [],
    status: 'pending',
    summary: null,
    comment: null,
    editedContent: null,
    questions: [],
    ...overrides,
  }
}

function renderColumn(
  overrides: Partial<Parameters<typeof FullFileColumn>[0]> = {},
) {
  return renderWithTheme(
    <FullFileColumn
      content={null}
      error={null}
      loading={false}
      filePath="a.ts"
      hunk={fixtureHunk()}
      editedContent={null}
      onSetEditedContent={() => {}}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('FullFileColumn', () => {
  it('shows a loading placeholder', () => {
    renderColumn({ loading: true })
    expect(document.body.textContent).toContain('Loading file')
  })

  it('shows the error message on failure', () => {
    renderColumn({ error: 'Unknown file: a.txt' })
    expect(document.body.textContent).toContain('Unknown file: a.txt')
  })

  it('renders every line of the file with line numbers', () => {
    renderColumn({
      content: 'one\ntwo\nthree\nfour',
      hunk: fixtureHunk({ newStart: 2, newLines: 2 }),
    })
    expect(document.body.textContent).toContain('one')
    expect(document.body.textContent).toContain('four')
  })

  it('seeds the editable range with the current hunk lines', () => {
    renderColumn({
      content: 'one\ntwo\nthree\nfour',
      hunk: fixtureHunk({ id: 'x1', newStart: 2, newLines: 2 }),
    })
    const range = document.getElementById('filerange-x1') as HTMLTextAreaElement
    expect(range.value).toBe('two\nthree')
  })

  it('keeps the editable hunk range as a plain textarea', async () => {
    const { findByLabelText } = renderColumn({
      content: 'const a = 1\nconst b = 2\nconst c = 3',
      filePath: 'example.ts',
      hunk: fixtureHunk({ id: 'x1', newStart: 2, newLines: 1 }),
    })

    const range = (await findByLabelText(
      'Suggested rewrite for this hunk',
    )) as HTMLTextAreaElement
    expect(range.tagName).toBe('TEXTAREA')
    expect(range.querySelector('[data-highlighted]')).toBeNull()
  })

  it('prefers already-saved editedContent over the original lines', () => {
    renderColumn({
      content: 'one\ntwo\nthree\nfour',
      hunk: fixtureHunk({ id: 'x1', newStart: 2, newLines: 2 }),
      editedContent: 'already edited',
    })
    const range = document.getElementById('filerange-x1') as HTMLTextAreaElement
    expect(range.value).toBe('already edited')
  })

  it('saves an edit on blur when it differs from the original range', async () => {
    const user = userEvent.setup()
    const onSetEditedContent = vi.fn()
    renderColumn({
      content: 'one\ntwo\nthree\nfour',
      hunk: fixtureHunk({ id: 'x1', newStart: 2, newLines: 2 }),
      onSetEditedContent,
    })

    const range = document.getElementById('filerange-x1')!
    await user.click(range)
    await user.type(range, ' plus more')
    await user.tab()

    expect(onSetEditedContent).toHaveBeenCalledWith('two\nthree plus more')
  })

  it('reverts to null when edited back to the original range', async () => {
    const user = userEvent.setup()
    const onSetEditedContent = vi.fn()
    renderColumn({
      content: 'one\ntwo\nthree\nfour',
      hunk: fixtureHunk({ id: 'x1', newStart: 2, newLines: 2 }),
      editedContent: 'two\nthree edited',
      onSetEditedContent,
    })

    const range = document.getElementById('filerange-x1')!
    await user.clear(range)
    await user.type(range, 'two\nthree')
    await user.tab()

    expect(onSetEditedContent).toHaveBeenCalledWith(null)
  })

  it('does not carry a stale draft over when the hunk changes', () => {
    const { rerender } = renderColumn({
      content: 'one\ntwo\nthree',
      hunk: fixtureHunk({ id: 'h1', newStart: 1, newLines: 1 }),
      editedContent: 'leftover from hunk 1',
    })
    expect(document.getElementById('filerange-h1')).toHaveValue(
      'leftover from hunk 1',
    )

    rerender(
      <FullFileColumn
        content={'one\ntwo\nthree'}
        error={null}
        loading={false}
        filePath="a.ts"
        hunk={fixtureHunk({ id: 'h2', newStart: 2, newLines: 1 })}
        editedContent={null}
        onSetEditedContent={() => {}}
      />,
    )

    expect(document.getElementById('filerange-h2')).toHaveValue('two')
  })

  it('handles a pure-deletion hunk with an empty range', () => {
    renderColumn({
      content: 'one\ntwo',
      hunk: fixtureHunk({ id: 'x1', newStart: 1, newLines: 0 }),
    })
    expect(document.getElementById('filerange-x1')).toHaveValue('')
  })

  it('shows + for added hunk lines and keeps file line numbers around them', () => {
    renderColumn({
      content: 'one\ntwo\nthree\nfour',
      hunk: fixtureHunk({
        id: 'x1',
        newStart: 2,
        newLines: 2,
        lines: [
          {
            type: 'add',
            content: 'two',
            oldLineNumber: null,
            newLineNumber: 2,
          },
          {
            type: 'add',
            content: 'three',
            oldLineNumber: null,
            newLineNumber: 3,
          },
        ],
      }),
    })

    const range = document.getElementById('filerange-x1')!
    const gutter = range.previousElementSibling!
    const marks = Array.from(gutter.children).map((el) => el.textContent)
    expect(marks).toEqual(['+', '+'])
    expect(document.body.textContent).toMatch(/1.*one/s)
    expect(document.body.textContent).toMatch(/4.*four/s)
  })

  it('shows - in the editable gutter for a modified line', () => {
    renderColumn({
      content: 'one\ntwo\nthree',
      hunk: fixtureHunk({
        id: 'x1',
        newStart: 2,
        newLines: 1,
        lines: [
          {
            type: 'del',
            content: 'old two',
            oldLineNumber: 2,
            newLineNumber: null,
          },
          {
            type: 'add',
            content: 'two',
            oldLineNumber: null,
            newLineNumber: 2,
          },
        ],
      }),
    })

    const range = document.getElementById('filerange-x1')!
    const gutter = range.previousElementSibling!
    expect(Array.from(gutter.children).map((el) => el.textContent)).toEqual([
      '-',
    ])
  })

  it('grows the dash gutter as edited lines are added', async () => {
    const user = userEvent.setup()
    renderColumn({
      content: 'one\ntwo\nthree',
      hunk: fixtureHunk({ id: 'x1', newStart: 2, newLines: 1 }),
    })

    const range = document.getElementById('filerange-x1')!
    await user.click(range)
    await user.type(range, '{Enter}more')

    const gutter = range.previousElementSibling!
    expect(gutter.children).toHaveLength(2)
  })
})
