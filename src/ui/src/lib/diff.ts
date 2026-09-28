// Types
import type { DiffLine } from '../types'

export interface SideBySideRow {
  old: DiffLine | null
  new: DiffLine | null
}

// Unified diffs interleave the removed lines (old) then their replacements
// (new) per change block, so before/after lines pair up positionally — no
// LCS/alignment needed. A null cell means that side has no line at this
// visual row (pure deletion / pure insertion).
export function buildSideBySideRows(lines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let pendingDeletions: DiffLine[] = []

  function flushPendingDeletions(): void {
    if (pendingDeletions.length === 0) return
    for (const del of pendingDeletions) rows.push({ old: del, new: null })
    pendingDeletions = []
  }

  for (const line of lines) {
    if (line.type === 'del') {
      pendingDeletions.push(line)
      continue
    }
    if (line.type === 'add') {
      const paired = pendingDeletions.shift()
      rows.push(paired ? { old: paired, new: line } : { old: null, new: line })
      continue
    }
    flushPendingDeletions()
    rows.push({ old: line, new: line })
  }
  flushPendingDeletions()
  return rows
}

// One column's worth of rows, one DiffLine per aligned visual row. Missing
// cells become blank context lines so both editors have identical line
// counts and their rows line up.
export function sideBySideColumn(
  rows: SideBySideRow[],
  side: 'old' | 'new',
): DiffLine[] {
  const blank: DiffLine = {
    type: 'context',
    content: '',
    oldLineNumber: null,
    newLineNumber: null,
  }
  return rows.map((row) => (side === 'old' ? row.old : row.new) ?? blank)
}
