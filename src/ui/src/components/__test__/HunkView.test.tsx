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
    comment: null,
    questions: [],
    ...overrides,
  }
}

describe('HunkView', () => {
  it('calls onSetStatus when Approve is clicked', async () => {
    const user = userEvent.setup()
    const onSetStatus = vi.fn()
    renderWithTheme(
      <HunkView
        hunk={fixtureHunk()}
        isFocused={false}
        onFocus={() => {}}
        onSetStatus={onSetStatus}
        onSetComment={() => {}}
      />,
    )

    const approveBtn = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Approve',
    )!
    await user.click(approveBtn)

    expect(onSetStatus).toHaveBeenCalledWith('approved')
  })

  it('saves a trimmed comment on blur when it changed', async () => {
    const user = userEvent.setup()
    const onSetComment = vi.fn()
    renderWithTheme(
      <HunkView
        hunk={fixtureHunk()}
        isFocused={false}
        onFocus={() => {}}
        onSetStatus={() => {}}
        onSetComment={onSetComment}
      />,
    )

    const textarea = document.querySelector('textarea')!
    await user.type(textarea, '  looks off  ')
    await user.tab()

    expect(onSetComment).toHaveBeenCalledWith('looks off')
  })

  it('does not save on blur when the comment is unchanged', async () => {
    const user = userEvent.setup()
    const onSetComment = vi.fn()
    renderWithTheme(
      <HunkView
        hunk={fixtureHunk({ comment: 'already saved' })}
        isFocused={false}
        onFocus={() => {}}
        onSetStatus={() => {}}
        onSetComment={onSetComment}
      />,
    )

    const textarea = document.querySelector('textarea')!
    await user.click(textarea)
    await user.tab()

    expect(onSetComment).not.toHaveBeenCalled()
  })
})
