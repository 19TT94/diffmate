import { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import type { RangeSet } from '@codemirror/state'
import type { GutterMarker } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

// Utils
import { buildSpanValue, diffGutterMarks, reviewSpanForHunk } from '../cmReview'

// Types
import type { DiffLine, Hunk } from '../../types'

function fixtureHunk(overrides: Partial<Hunk> = {}): Hunk {
  return {
    id: 'a.txt@@hunk1',
    header: '@@ -1,3 +1,3 @@',
    oldStart: 1,
    oldLines: 3,
    newStart: 1,
    newLines: 3,
    lines: [
      { type: 'context', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
    ],
    status: 'pending',
    summary: null,
    comment: null,
    editedContent: null,
    questions: [],
    ...overrides,
  }
}

function countRanges(
  set: DecorationSet | RangeSet<GutterMarker>,
  doc: Text,
): number {
  let count = 0
  set.between(0, doc.length, () => {
    count++
  })
  return count
}

function markerTexts(set: RangeSet<GutterMarker>, doc: Text): string[] {
  const texts: string[] = []
  set.between(0, doc.length, (_f, _t, marker) => {
    texts.push(
      (marker.toDOM!(null as unknown as EditorView).textContent ?? '').trim(),
    )
  })
  return texts
}

describe('buildSpanValue', () => {
  const doc = Text.of(['one', 'two', 'three', 'four'])

  it('builds a band and amber line numbers for a span', () => {
    const value = buildSpanValue(doc, {
      kind: 'span',
      startLine: 2,
      endLine: 3,
    })

    expect(countRanges(value.decorations, doc)).toBe(2)
    expect(markerTexts(value.markers, doc)).toEqual(['2', '3'])
  })

  it('builds a single deletion marker with no colored numbers', () => {
    const value = buildSpanValue(doc, {
      kind: 'deletion',
      startLine: 2,
      endLine: 2,
    })

    expect(countRanges(value.decorations, doc)).toBe(1)
    expect(markerTexts(value.markers, doc)).toEqual([])
  })

  it('clears everything for a null span', () => {
    const value = buildSpanValue(doc, null)

    expect(countRanges(value.decorations, doc)).toBe(0)
    expect(markerTexts(value.markers, doc)).toEqual([])
  })

  it('clamps out-of-range spans to the document', () => {
    const value = buildSpanValue(doc, {
      kind: 'span',
      startLine: 0,
      endLine: 99,
    })

    expect(countRanges(value.decorations, doc)).toBe(4)
    expect(markerTexts(value.markers, doc)).toEqual(['1', '2', '3', '4'])
  })

  it('handles an empty document', () => {
    const empty = Text.of([''])
    const value = buildSpanValue(empty, {
      kind: 'span',
      startLine: 1,
      endLine: 1,
    })

    expect(countRanges(value.decorations, empty)).toBe(1)
    expect(markerTexts(value.markers, empty)).toEqual(['1'])
  })
})

describe('diffGutterMarks', () => {
  const lines: DiffLine[] = [
    { type: 'add', content: 'x', oldLineNumber: null, newLineNumber: 1 },
    { type: 'del', content: 'y', oldLineNumber: 2, newLineNumber: null },
    { type: 'context', content: 'z', oldLineNumber: 3, newLineNumber: 2 },
  ]

  it('labels add/del/context rows like the pre-pivot gutter', () => {
    expect(diffGutterMarks(fixtureHunk({ lines }))).toEqual([
      { label: '+', kind: 'add' },
      { label: '-', kind: 'del' },
      { label: '3', kind: 'context' },
    ])
  })
})

describe('reviewSpanForHunk', () => {
  it('maps a normal hunk to its new-file line range', () => {
    expect(
      reviewSpanForHunk(fixtureHunk({ newStart: 5, newLines: 3 })),
    ).toEqual({
      kind: 'span',
      startLine: 5,
      endLine: 7,
    })
  })

  it('collapses a pure deletion to a marker line', () => {
    expect(
      reviewSpanForHunk(fixtureHunk({ newStart: 5, newLines: 0 })),
    ).toEqual({
      kind: 'deletion',
      startLine: 5,
      endLine: 5,
    })
  })
})
