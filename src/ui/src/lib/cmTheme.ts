import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

// Styles
import { theme } from '../styles/theme'

// Both review panes are CodeMirror instances styled to the dark "Tokyo
// Night" code-pane look that Shiki previously produced (lib/highlight.ts).
// Bg/fg are the same constants that file used, so the panes' base look is
// unchanged; the chrome (gutter, cursor, selection) is tuned to match.
export const HIGHLIGHT_EDITOR_BG = '#1a1b26'
export const HIGHLIGHT_EDITOR_FG = '#a9b1d6'

// Tokyo Night Night token palette, mapped onto lezer highlight tags. This
// is visually close to Shiki's tokyo-night port but not identical — lezer
// classifies tokens differently from TextMate grammars.
const PANE_SELECTION = '#2f3549'
const PANE_CURSOR = '#c0caf5'
const PANE_SPAN_AMBER = '#e0af68'
const PANE_SPAN_BAND = 'rgba(224, 175, 104, 0.08)'

const tokyoNightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#bb9af7' },
  { tag: [t.string, t.special(t.string), t.character], color: '#9ece6a' },
  { tag: [t.number, t.bool, t.null], color: '#ff9e64' },
  {
    tag: [t.comment, t.blockComment, t.lineComment],
    color: '#565f89',
    fontStyle: 'italic',
  },
  { tag: t.function(t.variableName), color: '#7aa2f7' },
  { tag: t.function(t.propertyName), color: '#7aa2f7' },
  { tag: [t.typeName, t.className, t.namespace], color: '#2ac3de' },
  { tag: t.propertyName, color: '#73daca' },
  { tag: t.variableName, color: '#c0caf5' },
  { tag: t.tagName, color: '#f7768e' },
  { tag: t.attributeName, color: '#bb9af7' },
  { tag: [t.operator, t.punctuation, t.separator], color: '#89ddff' },
  {
    tag: [t.bracket, t.squareBracket, t.paren, t.brace, t.angleBracket],
    color: '#c0caf5',
  },
  { tag: [t.definition(t.variableName), t.labelName], color: '#7dcfff' },
  { tag: [t.heading, t.strong], color: '#e0af68', fontWeight: 'bold' },
  { tag: [t.emphasis, t.quote, t.link], color: '#9aa5ce' },
  { tag: t.invalid, color: '#db4b4b' },
])

// Shared chrome for both panes. Diff-row tints (diffAddBg/diffDelBg) stay
// the app's light tiles on the dark pane, matching the pre-pivot look.
const cmTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: HIGHLIGHT_EDITOR_BG,
  },
  '.cm-scroller': {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.xs,
    lineHeight: '1.4',
    overflowX: 'hidden',
  },
  '.cm-content': {
    height: 'auto',
    caretColor: HIGHLIGHT_EDITOR_FG,
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-gutters': {
    backgroundColor: HIGHLIGHT_EDITOR_BG,
    color: theme.colors.muted,
    border: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '44px',
    padding: '0 14px 0 0',
  },
  '.cm-cursor': {
    borderLeftColor: PANE_CURSOR,
  },
  '.cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: `${PANE_SELECTION}!important`,
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-activeLineGutter': {
    backgroundColor: HIGHLIGHT_EDITOR_BG,
  },
  '.cm-matchingBracket': {
    backgroundColor: PANE_SELECTION,
  },
  // Current-hunk span (right pane): soft band + re-colored line numbers.
  '.cm-hunk-span': {
    backgroundColor: PANE_SPAN_BAND,
  },
  '.cm-hunk-gutter': {
    color: PANE_SPAN_AMBER,
  },
  // Pure-deletion marker (right pane): first surviving line reads as the
  // insertion point where the removed lines sat.
  '.cm-hunk-deletion': {
    backgroundColor: 'rgba(219, 75, 75, 0.14)',
  },
  // Old-side diff strip: add/del row tints plus gutter +/- coloring.
  '.cm-diff-row-add': {
    backgroundColor: theme.colors.diffAddBg,
  },
  '.cm-diff-row-del': {
    backgroundColor: theme.colors.diffDelBg,
  },
  '.cm-diff-gutter-add': {
    color: theme.colors.success,
  },
  '.cm-diff-gutter-del': {
    color: theme.colors.danger,
  },
})

const cmHighlight = syntaxHighlighting(tokyoNightHighlight)

export function cmHighlightTheme() {
  return [cmTheme, cmHighlight]
}
