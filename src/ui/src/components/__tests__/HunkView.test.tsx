import { screen, waitFor } from '@testing-library/react'
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
      layout="side-by-side"
      onLayoutChange={() => {}}
      onPrev={null}
      onNext={null}
      position={{ index: 0, total: 1 }}
      {...overrides}
    />,
  )
}

describe('HunkView', () => {
  it('shows the file name in the toolbar with the full path on hover', () => {
    renderHunkView({ filePath: 'src/ui/src/components/ui/Button.tsx' })

    const name = document.querySelector(
      '[title="src/ui/src/components/ui/Button.tsx"]',
    )
    expect(name?.textContent).toBe('Button.tsx')
  })

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

  it('renders the diff panel with removed rows on the old side and added rows on the new', async () => {
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
      expect(document.querySelectorAll('.cm-content').length).toBe(2)
    })
    const [oldColumn, newColumn] = document.querySelectorAll('.cm-content')
    expect(oldColumn!.textContent).toContain('removed')
    expect(oldColumn!.textContent).not.toContain('added')
    expect(newColumn!.textContent).toContain('added')
    expect(newColumn!.textContent).not.toContain('removed')
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

  it('renders the hunk summary as the Explanation when present', () => {
    renderHunkView({
      hunk: fixtureHunk({
        summary:
          'Added size prop so toolbar buttons can stay compact without a one-off override.',
      }),
    })

    expect(document.body.textContent).toContain('Explanation')
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

  it('keeps the toolbar outside the separately bordered diff and file panels', () => {
    renderHunkView()

    const toolbar = document.querySelector('[role="toolbar"]')!
    const diff = screen.getByRole('region', { name: 'Diff' })
    const file = screen.getByRole('region', { name: 'File' })
    expect(diff.contains(toolbar)).toBe(false)
    expect(file.contains(diff)).toBe(false)
    expect(diff.contains(file)).toBe(false)
  })

  it('puts the side-by-side/inline toggle in the diff panel', () => {
    renderHunkView()

    const diff = screen.getByRole('region', { name: 'Diff' })
    expect(
      diff.querySelector('[role="group"][aria-label="Diff view"]'),
    ).not.toBeNull()
    expect(
      document
        .querySelector('[role="toolbar"]')!
        .querySelector('[aria-label="Diff view"]'),
    ).toBeNull()
  })

  it('scrolls both side-by-side columns together in one container', async () => {
    renderHunkView({ layout: 'side-by-side' })

    const scroll = screen.getByTestId('diff-scroll')
    await waitFor(() => {
      expect(scroll.querySelectorAll('.cm-editor')).toHaveLength(2)
    })
  })

  it('shows a single inline diff pane in the inline view', async () => {
    renderHunkView({ layout: 'inline' })

    const scroll = screen.getByTestId('diff-scroll')
    await waitFor(() => {
      expect(scroll.querySelectorAll('.cm-editor')).toHaveLength(1)
    })
  })

  it('reports layout changes from the view toggle', async () => {
    const user = userEvent.setup()
    const onLayoutChange = vi.fn()
    renderHunkView({ layout: 'inline', onLayoutChange })

    await user.click(
      document.querySelector('button[title="Show old and new side by side"]')!,
    )
    await user.click(
      document.querySelector('button[title="Show one inline diff"]')!,
    )

    expect(onLayoutChange).toHaveBeenNthCalledWith(1, 'side-by-side')
    expect(onLayoutChange).toHaveBeenNthCalledWith(2, 'inline')
  })

  it('gives the diff and file panels their own collapse and larger-view buttons', () => {
    renderHunkView()

    for (const name of ['diff', 'file']) {
      expect(
        screen.getByRole('button', { name: `Collapse ${name}` }),
      ).toBeTruthy()
      expect(
        screen.getByRole('button', { name: `Open ${name} in a larger view` }),
      ).toBeTruthy()
    }
  })
})
