import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Components
import { HunkStepper } from '../HunkStepper'

// Utils
import { renderWithTheme } from '../../test/render'

// Types
import type { Hunk, ReviewFile } from '../../types'

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
        onSetComment={() => {}}
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
        onSetComment={() => {}}
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
        onSetComment={() => {}}
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
        onSetComment={() => {}}
      />,
    )

    expect(findButton('‹ Prev')).toBeDisabled()
    expect(findButton('Next ›')).toBeDisabled()
  })

  it('does not carry a stale comment draft over when the hunk changes', () => {
    const { rerender } = renderWithTheme(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk({ id: 'h1', comment: 'leftover from hunk 1' })}
        index={0}
        total={2}
        onPrev={null}
        onNext={() => {}}
        onSetStatus={() => {}}
        onSetComment={() => {}}
      />,
    )
    expect(document.querySelector('textarea')).toHaveValue(
      'leftover from hunk 1',
    )

    rerender(
      <HunkStepper
        file={fixtureFile()}
        hunk={fixtureHunk({ id: 'h2', comment: null })}
        index={1}
        total={2}
        onPrev={() => {}}
        onNext={null}
        onSetStatus={() => {}}
        onSetComment={() => {}}
      />,
    )

    expect(document.querySelector('textarea')).toHaveValue('')
  })
})
