import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Components
import { HunkView } from '../HunkView'

// Utils
import { renderWithTheme } from '../../test/render'

// Types
import type { Hunk } from '../../types'

function fixtureHunk(overrides: Partial<Hunk> = {}): Hunk {
  return {
    id: 'a.txt@@hunk1',
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [
      { type: 'context', content: 'same', oldLineNumber: 1, newLineNumber: 1 },
    ],
    status: 'pending',
    comment: null,
    editedContent: null,
    questions: [],
    ...overrides,
  }
}

function renderHunkView(
  overrides: Partial<Parameters<typeof HunkView>[0]> = {},
) {
  return renderWithTheme(
    <HunkView
      hunk={fixtureHunk()}
      isFocused={false}
      onFocus={() => {}}
      onSetStatus={() => {}}
      onSetEditedContent={() => {}}
      fileContent={null}
      fileContentError={null}
      fileContentLoading={false}
      oldColumnWidth={220}
      onOldColumnWidthChange={() => {}}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('HunkView', () => {
  it('calls onSetStatus when Approve is clicked', async () => {
    const user = userEvent.setup()
    const onSetStatus = vi.fn()
    renderHunkView({ onSetStatus })

    const approveBtn = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Approve',
    )!
    await user.click(approveBtn)

    expect(onSetStatus).toHaveBeenCalledWith('approved')
  })

  it('renders every hunk line in the left column, with a dash for lines with no old line number', () => {
    renderHunkView({
      hunk: fixtureHunk({
        lines: [
          {
            type: 'del',
            content: 'removed',
            oldLineNumber: 1,
            newLineNumber: null,
          },
          {
            type: 'add',
            content: 'added',
            oldLineNumber: null,
            newLineNumber: 1,
          },
          {
            type: 'context',
            content: 'kept',
            oldLineNumber: 2,
            newLineNumber: 2,
          },
        ],
      }),
    })

    const spans = Array.from(document.querySelectorAll('span')).map(
      (el) => el.textContent,
    )
    // All three lines appear in the gutter-style left column, like a
    // unified diff — an added line just gets a dash instead of an old
    // line number.
    expect(spans).toContain('removed')
    expect(spans).toContain('added')
    expect(spans).toContain('kept')
    expect(spans).toContain('-')
  })

  it('passes fileContent through to the full-file column', () => {
    renderHunkView({ fileContent: 'one\ntwo\nthree' })

    expect(document.body.textContent).toContain('one')
    expect(document.body.textContent).toContain('three')
  })

  it('resizes the old column by dragging the divider', () => {
    const onOldColumnWidthChange = vi.fn()
    const { container } = renderHunkView({
      oldColumnWidth: 220,
      onOldColumnWidthChange,
    })

    const resizer = container.querySelector('[style*="grid-template-columns"]')!
      .children[1] as HTMLElement

    fireEvent.mouseDown(resizer, { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 150 })

    expect(onOldColumnWidthChange).toHaveBeenCalledWith(270)
  })
})
