// Types
import type { DiffLine, Hunk } from '../types'

export type GutterKind = 'add' | 'del' | 'context'

export interface GutterMark {
  label: string
  kind: GutterKind
}

export function oldSideGutter(line: DiffLine): GutterMark {
  if (line.type === 'add') return { label: '+', kind: 'add' }
  if (line.type === 'del') return { label: '-', kind: 'del' }
  return {
    label: line.oldLineNumber === null ? '' : String(line.oldLineNumber),
    kind: 'context',
  }
}

// New-side marks follow unified-diff grouping (dels, then adds). A del+add
// pair is a modification and uses '-' like a deletion; leftover adds are '+'.
export function newSideGutters(hunk: Hunk): GutterMark[] {
  const marks: GutterMark[] = []
  const { lines } = hunk
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!
    if (line.type === 'context') {
      marks.push({
        label: line.newLineNumber === null ? '' : String(line.newLineNumber),
        kind: 'context',
      })
      i++
      continue
    }

    let dels = 0
    const adds: DiffLine[] = []
    while (i < lines.length && lines[i]!.type === 'del') {
      dels++
      i++
    }
    while (i < lines.length && lines[i]!.type === 'add') {
      adds.push(lines[i]!)
      i++
    }

    const paired = Math.min(dels, adds.length)
    for (let p = 0; p < paired; p++) {
      marks.push({ label: '-', kind: 'del' })
    }
    for (let p = paired; p < adds.length; p++) {
      marks.push({ label: '+', kind: 'add' })
    }
  }

  return marks
}

export function editableGutters(
  hunk: Hunk,
  draftLineCount: number,
): GutterMark[] {
  const marks = newSideGutters(hunk)
  if (draftLineCount <= marks.length) {
    return marks.slice(0, Math.max(draftLineCount, 0))
  }
  const extra = Array.from(
    { length: draftLineCount - marks.length },
    (): GutterMark => ({ label: '+', kind: 'add' }),
  )
  return [...marks, ...extra]
}
