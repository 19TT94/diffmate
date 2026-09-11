// Types
import type { DiffLine } from '../types'

export interface SideBySideRow {
  left: DiffLine | null
  right: DiffLine | null
}

// Unified diff hunks already interleave removals then additions per change
// block, so before/after lines pair up positionally — no LCS/alignment pass
// needed to build the two columns (matches engine/parseDiff.ts's approach).
export function buildSideBySideRows(lines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.type === 'context') {
      rows.push({ left: line, right: line })
      i++
      continue
    }

    const dels: DiffLine[] = []
    while (i < lines.length && lines[i]!.type === 'del') {
      dels.push(lines[i]!)
      i++
    }
    const adds: DiffLine[] = []
    while (i < lines.length && lines[i]!.type === 'add') {
      adds.push(lines[i]!)
      i++
    }

    const max = Math.max(dels.length, adds.length)
    for (let j = 0; j < max; j++) {
      rows.push({ left: dels[j] ?? null, right: adds[j] ?? null })
    }
  }
  return rows
}
