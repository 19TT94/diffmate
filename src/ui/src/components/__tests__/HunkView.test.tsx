import { fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

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
      onFileChange={() => {}}
      fileContent={null}
      fileContentError={null}
      fileContentLoading={false}
      oldColumnWidth={220}
      onOldColumnWidthChange={() => {}}
      {...overrides}
    />,
  )
}

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

  it('renders the old-side strip with add/del gutter marks', async () => {
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

    await waitFor(() => {
      expect(document.querySelector('.cm-content')).not.toBeNull()
    })
    expect(document.body.textContent).toContain('removed')
    expect(document.body.textContent).toContain('added')
    expect(document.querySelector('.cm-diff-gutter-add')).not.toBeNull()
    expect(document.querySelector('.cm-diff-gutter-del')).not.toBeNull()
  })

  it('passes fileContent through to the whole-file editor', async () => {
    renderHunkView({ fileContent: 'one\ntwo\nthree' })

    await waitFor(() => {
      expect(document.querySelector('.cm-content')).not.toBeNull()
    })
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

  it('reports whole-file document changes', async () => {
    const user = userEvent.setup()
    const onFileChange = vi.fn()
    renderHunkView({ fileContent: 'one', onFileChange })

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="cm-editable"]'),
      ).not.toBeNull()
    })

    const host = document.querySelector(
      '[data-testid="cm-editable"]',
    ) as HTMLElement
    await user.click(host.querySelector('.cm-content')!)
    await user.keyboard('x')
    await waitFor(() => {
      expect(onFileChange).toHaveBeenCalled()
    })
    expect(onFileChange).toHaveBeenCalledWith(expect.stringContaining('x'))
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
