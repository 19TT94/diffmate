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
    summary: null,
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
    notes: null,
    ...overrides,
  }
}

function findButton(text: string): HTMLElement {
  return Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent === text,
  )!
}

function findLabeled(label: string): HTMLElement {
  return document.querySelector(`button[aria-label="${label}"]`)!
}

describe('HunkStepper', () => {
  it('shows no separate full-path header', () => {
    renderWithTheme(
      <HunkStepper
        file={fixtureFile({ path: 'src/a.txt' })}
        hunk={fixtureHunk()}
        onPrev={null}
        onNext={null}
        onSetStatus={() => {}}
        layout="side-by-side"
        onLayoutChange={() => {}}
      />,
    )

    expect(document.body.textContent).not.toContain('src/a.txt')
  })

  it('puts Prev/Next in the hunk toolbar with Approve, and drops the bottom nav', () => {
    renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk()}
        onPrev={() => {}}
        onNext={() => {}}
        onSetStatus={() => {}}
        layout="side-by-side"
        onLayoutChange={() => {}}
      />,
    )

    const toolbar = document.querySelector('[role="toolbar"]')!
    expect(toolbar.contains(findLabeled('Previous hunk'))).toBe(true)
    expect(toolbar.contains(findLabeled('Next hunk'))).toBe(true)
    expect(toolbar.contains(findButton('Approve'))).toBe(true)
    expect(document.querySelectorAll('[aria-label="Next hunk"]')).toHaveLength(
      1,
    )
  })

  it("shows the hunk's position within its file between Prev and Next", () => {
    const h1 = fixtureHunk({ id: 'h1' })
    const h2 = fixtureHunk({ id: 'h2' })
    renderWithTheme(
      <HunkStepper
        file={fixtureFile({ hunks: [h1, h2] })}
        hunk={h2}
        onPrev={() => {}}
        onNext={null}
        onSetStatus={() => {}}
        layout="side-by-side"
        onLayoutChange={() => {}}
      />,
    )

    const position = findLabeled('Previous hunk').nextElementSibling
    expect(position?.textContent).toBe('2 of 2')
    expect(position?.nextElementSibling).toBe(findLabeled('Next hunk'))
  })

  it('calls onSetStatus with the hunk id when Approve is clicked', async () => {
    const user = userEvent.setup()
    const onSetStatus = vi.fn()
    renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk({ id: 'h1' })}
        onPrev={null}
        onNext={null}
        onSetStatus={onSetStatus}
        layout="side-by-side"
        onLayoutChange={() => {}}
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
        onPrev={onPrev}
        onNext={onNext}
        onSetStatus={() => {}}
        layout="side-by-side"
        onLayoutChange={() => {}}
      />,
    )

    await user.click(findLabeled('Previous hunk'))
    await user.click(findLabeled('Next hunk'))

    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('disables Prev/Next buttons when handlers are null', () => {
    renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk()}
        onPrev={null}
        onNext={null}
        onSetStatus={() => {}}
        layout="side-by-side"
        onLayoutChange={() => {}}
      />,
    )

    expect(findLabeled('Previous hunk')).toBeDisabled()
    expect(findLabeled('Next hunk')).toBeDisabled()
  })
})
