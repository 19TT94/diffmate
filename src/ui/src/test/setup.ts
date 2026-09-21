import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

class ResizeObserverMock implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// CodeMirror and the old inline textarea both scroll focused ranges into
// view; jsdom doesn't implement it, so keep a persistent no-op. It's
// re-installed after each restoreAllMocks, which would otherwise put the
// throwing jsdom default back.
function scrollIntoViewNoop(): void {}
Element.prototype.scrollIntoView = scrollIntoViewNoop

// CodeMirror's text-measure step (running on requestAnimationFrame after
// any edit) calls getClientRects/getBoundingClientRect on ranged texts,
// which jsdom leaves unimplemented. Cast through `unknown` because the DOM
// lib does not surface these on Text.
const emptyRectList = () => [] as unknown as DOMRectList
if (typeof Text !== 'undefined') {
  ;(
    Text.prototype as unknown as {
      getClientRects: () => DOMRectList
      getBoundingClientRect: () => DOMRect
    }
  ).getClientRects = emptyRectList
  ;(
    Text.prototype as unknown as { getBoundingClientRect: () => DOMRect }
  ).getBoundingClientRect = () => new DOMRect() as DOMRect
}
if (typeof Range !== 'undefined') {
  ;(
    Range.prototype as unknown as { getClientRects: () => DOMRectList }
  ).getClientRects = emptyRectList
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Element.prototype.scrollIntoView = scrollIntoViewNoop
})
