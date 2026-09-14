import { useEffect, useState } from 'react'
import styled from 'styled-components'

// Types
import type { Hunk } from '../types'

interface FullFileColumnProps {
  content: string | null
  error: string | null
  loading: boolean
  hunk: Hunk
  editedContent: string | null
  onSetEditedContent: (editedContent: string | null) => void
}

// Scrollable rendering of a file's full current content. The hunk being
// reviewed is editable in place (an inline textarea over its line range,
// scrolled into view); the rest of the file is read-only context.
export function FullFileColumn({
  content,
  error,
  loading,
  hunk,
  editedContent,
  onSetEditedContent,
}: FullFileColumnProps) {
  if (loading) return <Placeholder>Loading file…</Placeholder>
  if (error) return <Placeholder>{error}</Placeholder>
  if (content === null) return <Placeholder>No content available.</Placeholder>

  return (
    <FileBody
      // Remounts on hunk change so the draft's local state doesn't carry
      // over from the previous hunk's range — don't rely on a parent
      // component to key this correctly.
      key={hunk.id}
      content={content}
      hunk={hunk}
      editedContent={editedContent}
      onSetEditedContent={onSetEditedContent}
    />
  )
}

interface FileBodyProps {
  content: string
  hunk: Hunk
  editedContent: string | null
  onSetEditedContent: (editedContent: string | null) => void
}

function FileBody({
  content,
  hunk,
  editedContent,
  onSetEditedContent,
}: FileBodyProps) {
  const lines = content.split('\n')
  // newStart is 1-indexed; newLines may be 0 for a pure deletion, in which
  // case this is a zero-height insertion point rather than a real range.
  const rangeStart = hunk.newStart - 1
  const rangeEnd = rangeStart + hunk.newLines
  const originalRange = lines.slice(rangeStart, rangeEnd).join('\n')
  const [draft, setDraft] = useState(editedContent ?? originalRange)

  useEffect(() => {
    document
      .getElementById(`filerange-${hunk.id}`)
      ?.scrollIntoView({ block: 'center' })
  }, [hunk.id])

  function handleBlur(): void {
    const trimmed = draft.trim()
    const next = trimmed === originalRange.trim() ? null : trimmed
    if (next !== editedContent) onSetEditedContent(next)
  }

  // Every line being edited is, by definition, a modification — it never
  // has a stable line number of its own, so the gutter shows a dash per
  // line here, same as an added line does in the old (left) column.
  const draftLineCount = Math.max(draft.split('\n').length, 1)

  return (
    <Scroller>
      {lines.slice(0, rangeStart).map((line, index) => (
        <Row key={index}>
          <LineNo>{index + 1}</LineNo>
          <Content>{line}</Content>
        </Row>
      ))}
      <EditRow>
        <EditGutter>
          {Array.from({ length: draftLineCount }, (_, index) => (
            <span key={index}>-</span>
          ))}
        </EditGutter>
        <EditableRange
          id={`filerange-${hunk.id}`}
          aria-label="Suggested rewrite for this hunk"
          value={draft}
          rows={draftLineCount}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
        />
      </EditRow>
      {lines.slice(rangeEnd).map((line, index) => (
        <Row key={rangeEnd + index}>
          <LineNo>{rangeEnd + index + 1}</LineNo>
          <Content>{line}</Content>
        </Row>
      ))}
    </Scroller>
  )
}

// Style Overrides
const Scroller = styled.div`
  height: 100%;
  overflow-y: auto;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const Row = styled.div`
  display: flex;
  align-items: flex-start;
`

const LineNo = styled.span`
  width: 44px;
  flex: none;
  text-align: right;
  padding-right: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.muted};
  user-select: none;
`

const Content = styled.span`
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

const EditRow = styled.div`
  display: flex;
  align-items: stretch;
`

const EditGutter = styled.div`
  width: 44px;
  flex: none;
  display: flex;
  flex-direction: column;
  text-align: right;
  padding-right: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.muted};
  user-select: none;
  line-height: 1.4;
  background: ${({ theme }) =>
    `color-mix(in srgb, ${theme.colors.primary} 12%, ${theme.colors.tertiary})`};
`

const EditableRange = styled.textarea`
  display: block;
  flex: 1;
  min-width: 0;
  resize: none;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  line-height: 1.4;
  overflow-wrap: anywhere;
  background: ${({ theme }) =>
    `color-mix(in srgb, ${theme.colors.primary} 12%, ${theme.colors.tertiary})`};
`

const Placeholder = styled.div`
  padding: ${({ theme }) => theme.spacing[4]};
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`
