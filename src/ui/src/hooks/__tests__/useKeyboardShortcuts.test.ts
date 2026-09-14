import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Hooks
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

function fireKeydown(init: KeyboardEventInit): void {
  document.dispatchEvent(new KeyboardEvent('keydown', init))
}

describe('useKeyboardShortcuts', () => {
  it('steps to the next hunk across files on ⌘→', () => {
    const onFocusHunk = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        hunkIdsByFile: [['a1', 'a2'], ['b1']],
        focusedHunkId: 'a2',
        onFocusHunk,
        onSetStatus: vi.fn(),
        onFocusComment: vi.fn(),
        onSubmit: vi.fn(),
      }),
    )

    fireKeydown({ key: 'ArrowRight', metaKey: true })

    expect(onFocusHunk).toHaveBeenCalledWith('b1')
  })

  it('jumps to the next file’s first hunk on ⌘↓', () => {
    const onFocusHunk = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        hunkIdsByFile: [
          ['a1', 'a2'],
          ['b1', 'b2'],
        ],
        focusedHunkId: 'a1',
        onFocusHunk,
        onSetStatus: vi.fn(),
        onFocusComment: vi.fn(),
        onSubmit: vi.fn(),
      }),
    )

    fireKeydown({ key: 'ArrowDown', metaKey: true })

    expect(onFocusHunk).toHaveBeenCalledWith('b1')
  })

  it('approves the focused hunk on "a"', () => {
    const onSetStatus = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        hunkIdsByFile: [['a1']],
        focusedHunkId: 'a1',
        onFocusHunk: vi.fn(),
        onSetStatus,
        onFocusComment: vi.fn(),
        onSubmit: vi.fn(),
      }),
    )

    fireKeydown({ key: 'a' })

    expect(onSetStatus).toHaveBeenCalledWith('a1', 'approved')
  })

  it('submits on ⌘↵', () => {
    const onSubmit = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        hunkIdsByFile: [['a1']],
        focusedHunkId: 'a1',
        onFocusHunk: vi.fn(),
        onSetStatus: vi.fn(),
        onFocusComment: vi.fn(),
        onSubmit,
      }),
    )

    fireKeydown({ key: 'Enter', metaKey: true })

    expect(onSubmit).toHaveBeenCalled()
  })

  it('ignores "a"/"r" while typing in an editable field', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    const onSetStatus = vi.fn()

    renderHook(() =>
      useKeyboardShortcuts({
        hunkIdsByFile: [['a1']],
        focusedHunkId: 'a1',
        onFocusHunk: vi.fn(),
        onSetStatus,
        onFocusComment: vi.fn(),
        onSubmit: vi.fn(),
      }),
    )

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
    )

    expect(onSetStatus).not.toHaveBeenCalled()
    textarea.remove()
  })
})
