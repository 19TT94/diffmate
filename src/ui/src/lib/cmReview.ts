import {
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Text,
} from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  GutterMarker,
  lineNumberMarkers,
} from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'

// Types
import type { DiffLine, Hunk } from '../types'

// The current hunk's position inside a whole-file editor: an inclusive
// 1-based line range in the new file. A pure deletion (newLines === 0) has
// no lines of its own, so kind is 'deletion' and the span collapses to the
// single surviving line that reads as the insertion point.
export type ReviewSpanKind = 'span' | 'deletion'

export interface ReviewSpan {
  kind: ReviewSpanKind
  startLine: number
  endLine: number
}

export interface DiffGutterMark {
  label: string
  kind: 'add' | 'del' | 'context'
}

export const setReviewSpanEffect = StateEffect.define<ReviewSpan | null>()

class HunkGutterMarker extends GutterMarker {
  private readonly originalText: string
  private readonly className: string

  constructor(text: string, className?: string) {
    super()
    this.originalText = text
    this.className = className ?? ''
  }

  toDOM(): HTMLElement {
    const node = document.createElement('span')
    node.textContent = this.originalText
    if (this.className) node.className = this.className
    return node
  }

  eq(other: GutterMarker): boolean {
    return (
      other instanceof HunkGutterMarker &&
      other.originalText === this.originalText &&
      other.className === this.className
    )
  }
}

export interface SpanFieldValue {
  decorations: DecorationSet
  markers: RangeSet<GutterMarker>
}

const EMPTY_SPAN_VALUE: SpanFieldValue = {
  decorations: Decoration.none,
  markers: RangeSet.empty,
}

export function buildSpanValue(
  doc: Text,
  span: ReviewSpan | null,
): SpanFieldValue {
  if (!span) return EMPTY_SPAN_VALUE
  const start = Math.min(Math.max(span.startLine, 1), doc.lines)
  const end = Math.max(Math.min(span.endLine, doc.lines), start)
  const decoBuilder = new RangeSetBuilder<Decoration>()
  const markerBuilder = new RangeSetBuilder<GutterMarker>()
  for (let lineNumber = start; lineNumber <= end; lineNumber++) {
    const line = doc.line(lineNumber)
    const decorative = span.kind === 'deletion' && lineNumber === start
    decoBuilder.add(
      line.from,
      line.from,
      Decoration.line({
        class: decorative ? 'cm-hunk-deletion' : 'cm-hunk-span',
      }),
    )
    if (!decorative) {
      markerBuilder.add(
        line.from,
        line.from,
        new HunkGutterMarker(String(lineNumber), 'cm-hunk-gutter'),
      )
    }
  }
  return {
    decorations: decoBuilder.finish(),
    markers: markerBuilder.finish(),
  }
}

// Tracks the focused hunk's span so the field can recompute on hunk
// changes while keeping colored numbers and the soft band aligned to the
// document as the user edits around them.
export const reviewSpanField = StateField.define<SpanFieldValue>({
  create: () => EMPTY_SPAN_VALUE,
  update(value, tr) {
    let next = value
    if (tr.docChanged) {
      next = {
        decorations: value.decorations.map(tr.changes),
        markers: value.markers.map(tr.changes),
      }
    }
    for (const effect of tr.effects) {
      if (effect.is(setReviewSpanEffect)) {
        next = buildSpanValue(tr.state.doc, effect.value)
      }
    }
    return next
  },
})

export function scrollLineIntoView(view: EditorView, lineNumber: number): void {
  const doc = view.state.doc
  const target = Math.min(Math.max(lineNumber, 1), doc.lines)
  const pos = doc.line(target).from
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: 'center' }),
  })
}

// Maps a hunk onto the new file: an inclusive 1-based line range. A pure
// deletion (newLines === 0) collapses to a single marker line at newStart.
export function reviewSpanForHunk(hunk: Hunk): ReviewSpan | null {
  if (hunk.newLines === 0) {
    return {
      kind: 'deletion',
      startLine: hunk.newStart,
      endLine: hunk.newStart,
    }
  }
  return {
    kind: 'span',
    startLine: hunk.newStart,
    endLine: hunk.newStart + hunk.newLines - 1,
  }
}

function diffLinesToDoc(hunk: Hunk): Text {
  return Text.of(hunk.lines.map((line) => line.content))
}

export function diffGutterMarks(hunk: Hunk): DiffGutterMark[] {
  return hunk.lines.map((line) => {
    if (line.type === 'add') return { label: '+', kind: 'add' }
    if (line.type === 'del') return { label: '-', kind: 'del' }
    return {
      label: line.oldLineNumber === null ? '' : String(line.oldLineNumber),
      kind: 'context',
    }
  })
}

// Colored +/-/old-number gutter for the old-side strip, mirroring the
// pre-pivot LineNo rendering. Context rows keep the default muted look.
function buildDiffMarkers(
  doc: Text,
  marks: DiffGutterMark[],
): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>()
  for (let index = 0; index < doc.lines; index++) {
    const mark = marks[index]
    const line = doc.line(index + 1)
    if (mark.kind === 'add') {
      builder.add(
        line.from,
        line.from,
        new HunkGutterMarker('+', 'cm-diff-gutter-add'),
      )
    } else if (mark.kind === 'del') {
      builder.add(
        line.from,
        line.from,
        new HunkGutterMarker('-', 'cm-diff-gutter-del'),
      )
    } else {
      builder.add(line.from, line.from, new HunkGutterMarker(mark.label))
    }
  }
  return builder.finish()
}

// add/del row backgrounds for the old-side strip.
function buildDiffDecorations(doc: Text, lines: DiffLine[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (let index = 0; index < Math.min(doc.lines, lines.length); index++) {
    const type = lines[index]!.type
    const line = doc.line(index + 1)
    if (type !== 'context') {
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          class: type === 'add' ? 'cm-diff-row-add' : 'cm-diff-row-del',
        }),
      )
    }
  }
  return builder.finish()
}

// Read-only extensions for the old-side hunk strip (left pane). The doc is
// the hunk's own lines, so nothing needs to react to edits.
export function diffSideExtensions(hunk: Hunk): Extension[] {
  const doc = diffLinesToDoc(hunk)
  return [
    lineNumberMarkers.of(buildDiffMarkers(doc, diffGutterMarks(hunk))),
    EditorView.decorations.of(buildDiffDecorations(doc, hunk.lines)),
  ]
}

export type DiffNumberSide = 'old' | 'new'

// Gutter labels and add/del tints for one side-by-side column. Numberless
// filler rows (see sideBySideColumn) get an empty label and no tint.
function buildSideNumberMarkers(
  doc: Text,
  lines: DiffLine[],
  side: DiffNumberSide,
): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>()
  for (let index = 0; index < doc.lines; index++) {
    const line = doc.line(index + 1)
    const src = lines[index]!
    const number = side === 'old' ? src.oldLineNumber : src.newLineNumber
    const className =
      src.type === 'add'
        ? 'cm-diff-gutter-add'
        : src.type === 'del'
          ? 'cm-diff-gutter-del'
          : undefined
    builder.add(
      line.from,
      line.from,
      new HunkGutterMarker(number === null ? '' : String(number), className),
    )
  }
  return builder.finish()
}

// Read-only extensions for a side-by-side column: real old/new line
// numbers in the gutter, add/del row tints, blank lines for the opposite
// cell. The two columns share one row model so their line grids line up.
export function sideBySideColumnExtensions(
  lines: DiffLine[],
  side: DiffNumberSide,
): Extension[] {
  const doc = Text.of(lines.map((diffLine) => diffLine.content))
  return [
    lineNumberMarkers.of(buildSideNumberMarkers(doc, lines, side)),
    EditorView.decorations.of(buildDiffDecorations(doc, lines)),
  ]
}
