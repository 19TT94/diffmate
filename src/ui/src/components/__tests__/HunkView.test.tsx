import { fireEvent, waitFor } from '@testing-library/react'
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
    summary: null,
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
      filePath="a.ts"
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

  it('renders + in the gutter for additions and - for deletions', () => {
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
    expect(spans).toContain('removed')
    expect(spans).toContain('added')
    expect(spans).toContain('kept')
    expect(spans).toContain('+')
    expect(spans).toContain('-')
    expect(spans).toContain('2')
  })

  it('passes fileContent through to the full-file column', () => {
    renderHunkView({ fileContent: 'one\ntwo\nthree' })

    expect(document.body.textContent).toContain('one')
    expect(document.body.textContent).toContain('three')
  })

  it('renders the hunk summary when present', () => {
    renderHunkView({
      hunk: fixtureHunk({
        summary:
          'Added size prop so toolbar buttons can stay compact without a one-off override.',
      }),
    })

    expect(document.body.textContent).toContain('Summary')
    expect(document.body.textContent).toContain(
      'Added size prop so toolbar buttons can stay compact without a one-off override.',
    )
  })

  it('hides the summary block when summary is null', () => {
    renderHunkView({ hunk: fixtureHunk({ summary: null }) })

    expect(document.body.textContent).not.toContain('Summary')
  })

  it('highlights read-only old-side lines for known languages', async () => {
    renderHunkView({
      filePath: 'example.ts',
      hunk: fixtureHunk({
        lines: [
          {
            type: 'add',
            content: 'const answer = 42',
            oldLineNumber: null,
            newLineNumber: 1,
          },
        ],
      }),
    })

    await waitFor(() => {
      expect(document.querySelector('[data-highlighted]')).not.toBeNull()
    })
    expect(document.querySelector('[data-highlighted]')!.textContent).toContain(
      'const answer = 42',
    )
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
