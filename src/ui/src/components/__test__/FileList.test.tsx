import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Components
import { FileList } from '../FileList'

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
    lines: [],
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
    hunks: [fixtureHunk()],
    ...overrides,
  }
}

describe('FileList', () => {
  it('calls onBulkSetStatus with the file when "approve all" is clicked, without selecting the file', async () => {
    const user = userEvent.setup()
    const onSelectFile = vi.fn()
    const onBulkSetStatus = vi.fn()
    const file = fixtureFile()
    renderWithTheme(
      <FileList
        files={[file]}
        currentPath={null}
        onSelectFile={onSelectFile}
        onBulkSetStatus={onBulkSetStatus}
      />,
    )

    await user.click(
      document.querySelector('button[title="Approve all hunks in this file"]')!,
    )

    expect(onBulkSetStatus).toHaveBeenCalledWith(file, 'approved')
    expect(onSelectFile).not.toHaveBeenCalled()
  })

  it('calls onSelectFile when a row is clicked outside the bulk actions', async () => {
    const user = userEvent.setup()
    const onSelectFile = vi.fn()
    renderWithTheme(
      <FileList
        files={[fixtureFile()]}
        currentPath={null}
        onSelectFile={onSelectFile}
        onBulkSetStatus={() => {}}
      />,
    )

    await user.click(document.querySelector('nav div')!)

    expect(onSelectFile).toHaveBeenCalledWith(0)
  })

  it('omits bulk actions for a file with no hunks', () => {
    renderWithTheme(
      <FileList
        files={[fixtureFile({ hunks: [] })]}
        currentPath={null}
        onSelectFile={() => {}}
        onBulkSetStatus={() => {}}
      />,
    )

    expect(
      document.querySelector('button[title="Approve all hunks in this file"]'),
    ).toBeNull()
  })
})
