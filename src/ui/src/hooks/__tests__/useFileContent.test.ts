import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hooks
import { useFileContent } from '../useFileContent'

// Utils
import { fetchFileContent } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  fetchFileContent: vi.fn(),
}))

const mockFetchFileContent = vi.mocked(fetchFileContent)

// vi.restoreAllMocks() (in test/setup.ts's afterEach) only restores
// vi.spyOn spies, not a plain vi.fn() from a vi.mock() factory like this
// one — reset it explicitly so call counts don't leak between tests.
beforeEach(() => {
  mockFetchFileContent.mockReset()
})

describe('useFileContent', () => {
  it('starts idle when path is null', () => {
    const { result } = renderHook(() => useFileContent(null))
    expect(result.current).toEqual({
      content: null,
      error: null,
      loading: false,
    })
    expect(mockFetchFileContent).not.toHaveBeenCalled()
  })

  it('loads content for a path', async () => {
    mockFetchFileContent.mockResolvedValue({ content: 'hello\nworld' })
    const { result } = renderHook(() => useFileContent('a.txt'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.content).toBe('hello\nworld')
    expect(result.current.error).toBeNull()
    expect(mockFetchFileContent).toHaveBeenCalledWith('a.txt')
  })

  it('surfaces a fetch error', async () => {
    mockFetchFileContent.mockRejectedValue(new Error('Unknown file: a.txt'))
    const { result } = renderHook(() => useFileContent('a.txt'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.content).toBeNull()
    expect(result.current.error).toBe('Unknown file: a.txt')
  })

  it('re-fetches only when the path changes', async () => {
    mockFetchFileContent.mockResolvedValue({ content: 'v1' })
    const { rerender } = renderHook(({ path }) => useFileContent(path), {
      initialProps: { path: 'a.txt' },
    })
    await waitFor(() => expect(mockFetchFileContent).toHaveBeenCalledTimes(1))

    rerender({ path: 'a.txt' })
    expect(mockFetchFileContent).toHaveBeenCalledTimes(1)

    mockFetchFileContent.mockResolvedValue({ content: 'v2' })
    rerender({ path: 'b.txt' })
    await waitFor(() => expect(mockFetchFileContent).toHaveBeenCalledTimes(2))
  })
})
