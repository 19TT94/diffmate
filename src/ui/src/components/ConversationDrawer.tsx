import { useState } from 'react'
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'
import styled from 'styled-components'

// Components
import { Button } from './ui/Button'
import { Markdown } from './Markdown'

// Utils
import { clampWidth, startDragResize } from '../lib/dragResize'
import { hunkLabel } from '../lib/questions'

// Types
import type { Question, ReviewFile } from '../types'

const DEFAULT_WIDTH = 360
const MIN_WIDTH = 280
const MAX_WIDTH = 560

function displayWidth(saved: number | undefined): number {
  return clampWidth(saved ?? DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH)
}

interface ConversationDrawerProps {
  questions: Question[]
  // Labels each question's hunk tag.
  files: ReviewFile[]
  // The ask box's default tag.
  focusedHunkId: string | null
  // The agent ended the review: nothing more will be answered.
  ended: boolean
  // A null hunkId asks about the whole review.
  onAsk: (hunkId: string | null, text: string) => void
  onSelectHunk: (hunkId: string) => void
  // The saved width (from settings); undefined means the default.
  width?: number
  // Called once per drag, when it ends, to save the new width.
  onWidthChange: (width: number) => void
}

// The review's one conversation with the agent, beside the review. The ask
// box is tagged with the focused hunk until the reviewer removes the tag.
export function ConversationDrawer({
  questions,
  files,
  focusedHunkId,
  ended,
  onAsk,
  onSelectHunk,
  width: savedWidth,
  onWidthChange,
}: ConversationDrawerProps) {
  const [text, setText] = useState('')
  // Cleared after each send, so the next question is tagged again.
  const [wholeReview, setWholeReview] = useState(false)
  const [width, setWidth] = useState(() => displayWidth(savedWidth))
  // Saved settings arrive after the first render; follow them when they do.
  const [lastSaved, setLastSaved] = useState(savedWidth)
  if (savedWidth !== lastSaved) {
    setLastSaved(savedWidth)
    setWidth(displayWidth(savedWidth))
  }

  const askHunkId = wholeReview ? null : focusedHunkId
  const askLabel = askHunkId ? hunkLabel(files, askHunkId) : null
  const canSend = !ended && text.trim() !== ''

  function send(): void {
    if (!canSend) return
    onAsk(askLabel ? askHunkId : null, text.trim())
    setText('')
    setWholeReview(false)
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    send()
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    send()
  }

  function handleResizeStart(event: ReactMouseEvent): void {
    startDragResize(event, {
      startWidth: width,
      min: MIN_WIDTH,
      max: MAX_WIDTH,
      onChange: setWidth,
      onEnd: onWidthChange,
      edge: 'left',
    })
  }

  return (
    <Aside aria-label="Conversation" style={{ width }}>
      <Resizer
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize conversation"
        onMouseDown={handleResizeStart}
      />
      <Heading>Conversation</Heading>
      {questions.length === 0 ? (
        <Empty>
          Ask the agent about a hunk, or about the whole review. Asking
          doesn&apos;t approve or reject anything.
        </Empty>
      ) : (
        <List aria-label="Questions">
          {questions.map((question) => {
            const { hunkId } = question
            const label = hunkId ? hunkLabel(files, hunkId) : null
            return (
              <Item key={question.id}>
                {label && hunkId ? (
                  <TagButton type="button" onClick={() => onSelectHunk(hunkId)}>
                    {label}
                  </TagButton>
                ) : (
                  <Tag>Whole review</Tag>
                )}
                <QuestionText>{question.text}</QuestionText>
                {question.answer !== null ? (
                  <Answer>
                    <Markdown>{question.answer}</Markdown>
                  </Answer>
                ) : (
                  <Status>
                    {ended
                      ? 'Not answered: the agent ended the review'
                      : 'Waiting for the agent…'}
                  </Status>
                )}
              </Item>
            )
          })}
        </List>
      )}

      <AskForm aria-label="Ask the agent" onSubmit={handleSubmit}>
        <AskTag>
          {askLabel ? (
            <Tag>
              {askLabel}
              <RemoveTag
                type="button"
                aria-label="Ask about the whole review instead"
                title="Ask about the whole review instead"
                disabled={ended}
                onClick={() => setWholeReview(true)}
              >
                ×
              </RemoveTag>
            </Tag>
          ) : (
            <Tag>Whole review</Tag>
          )}
        </AskTag>
        <TextArea
          aria-label="Question"
          placeholder={ended ? 'The agent ended the review' : 'Ask the agent…'}
          value={text}
          rows={3}
          disabled={ended}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <SendRow>
          <Hint>Enter to send, Shift+Enter for a new line</Hint>
          <Button type="submit" size="sm" variant="primary" disabled={!canSend}>
            Send
          </Button>
        </SendRow>
      </AskForm>
    </Aside>
  )
}

// Style Overrides
// Gives way below its set width before the hunk view does.
const Aside = styled.aside`
  position: relative;
  flex: 0 1 auto;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.background};
`

// Straddles the left border.
const Resizer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: -3px;
  width: 6px;
  cursor: col-resize;
  z-index: 1;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
  }
`

const Heading = styled.h2`
  flex: none;
  margin: 0;
  padding: ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const Empty = styled.p`
  flex: 1;
  margin: 0;
  padding: ${({ theme }) => theme.spacing[4]};
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const List = styled.ol`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Item = styled.li`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  padding: 1px ${({ theme }) => theme.spacing[2]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.full};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.muted};
  background: ${({ theme }) => theme.colors.tertiary};
`

const TagButton = styled(Tag).attrs({ as: 'button' })`
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
    border-color: currentColor;
  }
`

const RemoveTag = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.danger};
  }
`

const QuestionText = styled.p`
  margin: 0;
  white-space: pre-wrap;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.secondary};
`

const Answer = styled.div`
  align-self: stretch;
  padding-left: ${({ theme }) => theme.spacing[3]};
  border-left: 3px solid ${({ theme }) => theme.colors.agent};
`

const Status = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-style: italic;
  color: ${({ theme }) => theme.colors.muted};
`

const AskForm = styled.form`
  flex: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`

const AskTag = styled.div`
  display: flex;
`

const TextArea = styled.textarea`
  resize: vertical;
  padding: ${({ theme }) => theme.spacing[2]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  font: inherit;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.secondary};
  background: ${({ theme }) => theme.colors.tertiary};
`

const SendRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[2]};
`

const Hint = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.muted};
`
