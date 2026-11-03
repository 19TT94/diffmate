import type { MouseEvent as ReactMouseEvent } from 'react'

interface DragResizeOptions {
  startWidth: number
  min: number
  max: number
  onChange: (width: number) => void
  // Called once on mouseup with the final width, e.g. to persist it.
  onEnd?: (width: number) => void
  // Which edge the handle sits on; a left-edge handle grows as it moves left.
  edge?: 'left' | 'right'
}

export function clampWidth(width: number, min: number, max: number): number {
  return Math.min(Math.max(width, min), max)
}

// Tracks a horizontal drag from a resize handle's mousedown until mouseup,
// reporting the clamped width as the pointer moves.
export function startDragResize(
  event: ReactMouseEvent,
  { startWidth, min, max, onChange, onEnd, edge = 'right' }: DragResizeOptions,
): void {
  event.preventDefault()
  const startX = event.clientX
  let width = startWidth

  function handleMouseMove(moveEvent: MouseEvent): void {
    const delta = moveEvent.clientX - startX
    width = clampWidth(
      startWidth + (edge === 'left' ? -delta : delta),
      min,
      max,
    )
    onChange(width)
  }
  function handleMouseUp(): void {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    onEnd?.(width)
  }
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}
