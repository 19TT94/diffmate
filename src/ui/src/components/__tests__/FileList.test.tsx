import { fireEvent } from '@testing-library/react'
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
    hunks: [fixtureHunk()],
    notes: null,
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
        onWidthChange={() => {}}
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
    const { getByText } = renderWithTheme(
      <FileList
        files={[fixtureFile()]}
        currentPath={null}
        onSelectFile={onSelectFile}
        onBulkSetStatus={() => {}}
        onWidthChange={() => {}}
      />,
    )

    await user.click(getByText('a.txt'))

    expect(onSelectFile).toHaveBeenCalledWith(0)
  })

  it('omits bulk actions for a file with no hunks', () => {
    renderWithTheme(
      <FileList
        files={[fixtureFile({ hunks: [] })]}
        currentPath={null}
        onSelectFile={() => {}}
        onBulkSetStatus={() => {}}
        onWidthChange={() => {}}
      />,
    )

    expect(
      document.querySelector('button[title="Approve all hunks in this file"]'),
    ).toBeNull()
  })

  it('hides the file rows when collapsed, and shows them again when expanded', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <FileList
        files={[fixtureFile()]}
        currentPath={null}
        onSelectFile={() => {}}
        onBulkSetStatus={() => {}}
        onWidthChange={() => {}}
      />,
    )

    expect(document.body.textContent).toContain('a.txt')

    await user.click(
      document.querySelector('button[title="Hide changed files"]')!,
    )
    expect(document.body.textContent).not.toContain('a.txt')

    await user.click(
      document.querySelector('button[title="Show changed files"]')!,
    )
    expect(document.body.textContent).toContain('a.txt')
  })

  it('shows no reviewed-total heading', () => {
    renderWithTheme(
      <FileList
        files={[fixtureFile()]}
        currentPath={null}
        onSelectFile={() => {}}
        onBulkSetStatus={() => {}}
        onWidthChange={() => {}}
      />,
    )

    expect(document.body.textContent).not.toContain('hunks reviewed')
  })

  it('shows reviewed-of-total inside the badge of a mixed file', () => {
    renderWithTheme(
      <FileList
        files={[
          fixtureFile({
            hunks: [
              fixtureHunk({ id: 'a1', status: 'approved' }),
              fixtureHunk({ id: 'a2' }),
            ],
          }),
        ]}
        currentPath={null}
        onSelectFile={() => {}}
        onBulkSetStatus={() => {}}
        onWidthChange={() => {}}
      />,
    )

    const badge = Array.from(document.querySelectorAll('span')).find((el) =>
      el.textContent?.startsWith('mixed'),
    )
    expect(badge?.textContent).toBe('mixed (1 of 2)')
  })

  it.each<[string, Hunk['status'][]]>([
    ['all pending', ['pending', 'pending']],
    ['all approved', ['approved', 'approved']],
    ['all rejected', ['rejected', 'rejected']],
    ['no hunks', []],
  ])('shows no reviewed count for a file with %s', (_label, statuses) => {
    renderWithTheme(
      <FileList
        files={[
          fixtureFile({
            hunks: statuses.map((status, i) =>
              fixtureHunk({ id: `a${i}`, status }),
            ),
          }),
        ]}
        currentPath={null}
        onSelectFile={() => {}}
        onBulkSetStatus={() => {}}
        onWidthChange={() => {}}
      />,
    )

    expect(document.body.textContent).not.toMatch(/\(\d+ of \d+\)/)
  })

  it('shows the file name in full and resolves the full path on hover', () => {
    renderWithTheme(
      <FileList
        files={[fixtureFile({ path: 'src/ui/components/FileList.tsx' })]}
        currentPath={null}
        onSelectFile={() => {}}
        onBulkSetStatus={() => {}}
        onWidthChange={() => {}}
      />,
    )

    expect(document.body.textContent).toContain('FileList.tsx')
    expect(
      document.querySelector('[title="src/ui/components/FileList.tsx"]'),
    ).not.toBeNull()
  })

  describe('resizing', () => {
    function renderList(
      props: { width?: number; onWidthChange?: (width: number) => void } = {},
    ) {
      return renderWithTheme(
        <FileList
          files={[fixtureFile()]}
          currentPath={null}
          onSelectFile={() => {}}
          onBulkSetStatus={() => {}}
          onWidthChange={() => {}}
          {...props}
        />,
      )
    }

    function nav(): HTMLElement {
      return document.querySelector('nav')!
    }

    function handle(): HTMLElement | null {
      return document.querySelector(
        '[role="separator"][aria-label="Resize file list"]',
      )
    }

    function drag(from: number, to: number): void {
      fireEvent.mouseDown(handle()!, { clientX: from })
      fireEvent.mouseMove(document, { clientX: to })
      fireEvent.mouseUp(document)
    }

    it('uses 280px when no width is saved', () => {
      renderList()
      expect(nav().style.width).toBe('280px')
    })

    it('uses the saved width, clamped to 220–480px', () => {
      const { rerender } = renderList({ width: 400 })
      expect(nav().style.width).toBe('400px')

      const props = {
        files: [fixtureFile()],
        currentPath: null,
        onSelectFile: () => {},
        onBulkSetStatus: () => {},
        onWidthChange: () => {},
      }
      rerender(<FileList {...props} width={9999} />)
      expect(nav().style.width).toBe('480px')
      rerender(<FileList {...props} width={10} />)
      expect(nav().style.width).toBe('220px')
    })

    it('widens and narrows by dragging its edge, clamped to 220–480px', () => {
      renderList()

      drag(100, 160)
      expect(nav().style.width).toBe('340px')

      drag(500, 0)
      expect(nav().style.width).toBe('220px')

      drag(0, 1000)
      expect(nav().style.width).toBe('480px')
    })

    it('saves the width once, when the drag ends', () => {
      const onWidthChange = vi.fn()
      renderList({ onWidthChange })

      fireEvent.mouseDown(handle()!, { clientX: 100 })
      fireEvent.mouseMove(document, { clientX: 130 })
      fireEvent.mouseMove(document, { clientX: 160 })
      expect(onWidthChange).not.toHaveBeenCalled()

      fireEvent.mouseUp(document)
      expect(onWidthChange).toHaveBeenCalledTimes(1)
      expect(onWidthChange).toHaveBeenCalledWith(340)
    })

    it('hides the handle while collapsed and keeps the width on expand', async () => {
      const user = userEvent.setup()
      renderList({ width: 360 })

      await user.click(
        document.querySelector('button[title="Hide changed files"]')!,
      )
      expect(handle()).toBeNull()

      await user.click(
        document.querySelector('button[title="Show changed files"]')!,
      )
      expect(nav().style.width).toBe('360px')
    })

    it('no longer touches localStorage', () => {
      const realStorage = globalThis.localStorage
      const getItem = vi.fn()
      const setItem = vi.fn()
      vi.stubGlobal('localStorage', { getItem, setItem })
      renderList()
      drag(100, 160)
      expect(getItem).not.toHaveBeenCalled()
      expect(setItem).not.toHaveBeenCalled()
      vi.stubGlobal('localStorage', realStorage)
    })
  })
})
