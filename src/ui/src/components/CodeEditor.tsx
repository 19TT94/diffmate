import { useEffect, useRef } from 'react'
import styled, { useTheme } from 'styled-components'

// CodeMirror
import {
  defaultKeymap,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Prec, Text } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  lineNumberMarkers,
} from '@codemirror/view'

// Utils
import { cmDiffTintTheme, cmHighlightTheme } from '../lib/cmTheme'
import { languageExtensionFromPath } from '../lib/cmLanguage'
import {
  reviewSpanField,
  scrollLineIntoView,
  setReviewSpanEffect,
  type ReviewSpan,
  diffSideExtensions,
  sideBySideColumnExtensions,
  type DiffNumberSide,
} from '../lib/cmReview'

// Types
import type { DiffLine, Hunk } from '../types'

interface CodeEditorProps {
  filePath: string
  mode: 'diff' | 'editable'
  hunk?: Hunk
  diffLines?: DiffLine[]
  diffNumberSide?: DiffNumberSide
  content?: string
  hunkSpan?: ReviewSpan | null
  onDocChanged?: (content: string) => void
}

// Shared base for both panes: dark theme, per-path language, compatible
// line metrics, and wrap. Diff mode is strictly read-only; editable mode
// adds the review-span machinery and reports document changes outward.
export function CodeEditor({
  filePath,
  mode,
  hunk,
  diffLines,
  diffNumberSide,
  content,
  hunkSpan,
  onDocChanged,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onDocChangedRef = useRef(onDocChanged)
  const diffTintRef = useRef(new Compartment())
  const { diffAddBg, diffDelBg } = useTheme().colors

  useEffect(() => {
    onDocChangedRef.current = onDocChanged
  }, [onDocChanged])

  const readOnly = mode === 'diff'

  useEffect(() => {
    if (!hostRef.current) return
    const doc = readOnly
      ? Text.of((diffLines ?? hunk!.lines).map((line) => line.content))
      : Text.of(content!.split('\n'))
    const extensions: Extension[] = [
      cmHighlightTheme(),
      // Mount-time tints; the reconfigure effect below tracks later changes.
      diffTintRef.current.of(cmDiffTintTheme({ diffAddBg, diffDelBg })),
      languageExtensionFromPath(filePath),
      EditorView.lineWrapping,
      keymap.of([
        ...defaultKeymap,
        ...(readOnly ? [] : [...historyKeymap, ...searchKeymap, indentWithTab]),
      ]),
      ...(readOnly
        ? [
            EditorState.readOnly.of(true),
            // Diff panes grow to their content; the diff panel scrolls both
            // together with one scrollbar.
            Prec.highest(
              EditorView.theme({
                '&': { height: 'auto' },
                '.cm-scroller': { overflow: 'visible' },
              }),
            ),
            EditorView.editable.of(false),
            EditorView.contentAttributes.of({ 'aria-readonly': 'true' }),
          ]
        : []),
      lineNumbers(),
    ]
    if (readOnly) {
      extensions.push(
        ...(diffLines
          ? sideBySideColumnExtensions(diffLines, diffNumberSide!)
          : diffSideExtensions(hunk!)),
      )
    } else {
      extensions.push(
        reviewSpanField,
        lineNumberMarkers.compute(
          [reviewSpanField],
          (state) => state.field(reviewSpanField).markers,
        ),
        EditorView.decorations.from(
          reviewSpanField,
          (value) => value.decorations,
        ),
      )
    }
    // A stable callback is captured here; prop refs above keep it current.
    const view = new EditorView({
      doc,
      parent: hostRef.current,
      extensions: [
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onDocChangedRef.current?.(update.state.doc.toString())
          }
        }),
      ],
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // The document is owned by the parent and changes remount this
    // component via its key, so a mount-only build is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, mode, readOnly])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: diffTintRef.current.reconfigure(
        cmDiffTintTheme({ diffAddBg, diffDelBg }),
      ),
    })
  }, [diffAddBg, diffDelBg])

  useEffect(() => {
    if (readOnly) return
    const view = viewRef.current
    if (!view) return
    const span = hunkSpan ?? null
    view.dispatch({ effects: setReviewSpanEffect.of(span) })
    if (span) scrollLineIntoView(view, span.startLine)
  }, [hunkSpan, readOnly])

  if (mode === 'diff') {
    if (!hunk && !diffLines) return null
  }
  if (mode === 'editable' && content === undefined) return null

  return <Host ref={hostRef} data-testid={`cm-${mode}`} />
}

// Style Overrides
const Host = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`
