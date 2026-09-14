import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Components
import { HunkStepper } from '../HunkStepper'

// Utils
import { renderWithTheme } from '../../test/render'

// Types
import type { Hunk, ReviewFile } from '../../types'

// HunkStepper's own useFileContent call is exercised by
// hooks/__tests__/useFileContent.test.ts — stub it here so these tests don't
// make a real network request and stay focused on HunkStepper's wiring.
vi.mock('../../hooks/useFileContent', () => ({
  useFileContent: () => ({ content: null, error: null, loading: false }),
}))

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

function fixtureFile(overrides: Partial<ReviewFile> = {}): ReviewFile {
  return {
    path: 'a.txt',
    oldPath: null,
    status: 'modified',
    binary: false,
    hunks: [],
    ...overrides,
  }
}

function findButton(text: string): HTMLElement {
  return Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent === text,
  )!
}

describe('HunkStepper', () => {
  it('renders the file path and progress readout', () => {
    renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk()}
        index={2}
        total={5}
        onPrev={null}
        onNext={null}
        onSetStatus={() => {}}
        onSetEditedContent={() => {}}
      />,
    )

    expect(document.body.textContent).toContain('a.txt')
    expect(document.body.textContent).toContain('3 of 5')
  })

  it('calls onSetStatus with the hunk id when Approve is clicked', async () => {
    const user = userEvent.setup()
    const onSetStatus = vi.fn()
    renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk({ id: 'h1' })}
        index={0}
        total={1}
        onPrev={null}
        onNext={null}
        onSetStatus={onSetStatus}
        onSetEditedContent={() => {}}
      />,
    )

    await user.click(findButton('Approve'))

    expect(onSetStatus).toHaveBeenCalledWith('h1', 'approved')
  })

  it('disables Prev/Next when their handlers are null, and calls them when set', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    const onNext = vi.fn()
    renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk()}
        index={0}
        total={1}
        onPrev={onPrev}
        onNext={onNext}
        onSetStatus={() => {}}
        onSetEditedContent={() => {}}
      />,
    )

    await user.click(findButton('‹ Prev'))
    await user.click(findButton('Next ›'))

    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('disables Prev/Next buttons when handlers are null', () => {
    renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk()}
        index={0}
        total={1}
        onPrev={null}
        onNext={null}
        onSetStatus={() => {}}
        onSetEditedContent={() => {}}
      />,
    )

    expect(findButton('‹ Prev')).toBeDisabled()
    expect(findButton('Next ›')).toBeDisabled()
  })

  it('keeps a resized old-column width when stepping to a different hunk', () => {
    const { container, rerender } = renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk({ id: 'h1' })}
        index={0}
        total={2}
        onPrev={null}
        onNext={() => {}}
        onSetStatus={() => {}}
        onSetEditedContent={() => {}}
      />,
    )

    const resizer = container.querySelector('[style*="grid-template-columns"]')!
      .children[1] as HTMLElement
    fireEvent.mouseDown(resizer, { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 200 })

    const rowsBefore = container.querySelector(
      '[style*="grid-template-columns"]',
    )!
    expect(rowsBefore.getAttribute('style')).toContain('320px')

    rerender(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk({ id: 'h2' })}
        index={1}
        total={2}
        onPrev={() => {}}
        onNext={null}
        onSetStatus={() => {}}
        onSetEditedContent={() => {}}
      />,
    )

    const rowsAfter = container.querySelector(
      '[style*="grid-template-columns"]',
    )!
    expect(rowsAfter.getAttribute('style')).toContain('320px')
  })
})
