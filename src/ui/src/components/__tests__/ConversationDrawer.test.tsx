import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Components
import { ConversationDrawer } from '../ConversationDrawer'

// Utils
import { renderWithTheme } from '../../test/render'

// Types
import type { Hunk, Question, ReviewFile } from '../../types'

function fixtureHunk(id: string): Hunk {
  return {
    id,
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [],
    status: 'pending',
    summary: null,
    comment: null,
    editedContent: null,
  }
}

const FILES: ReviewFile[] = [
  {
    path: 'src/lib/useGroups.ts',
    oldPath: null,
    status: 'modified',
    binary: false,
    hunks: [fixtureHunk('groups@@1'), fixtureHunk('groups@@2')],
    notes: null,
  },
  {
    path: 'src/pages/Page.js',
    oldPath: null,
    status: 'modified',
    binary: false,
    hunks: [fixtureHunk('page@@1')],
    notes: null,
  },
]

function fixtureQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    hunkId: null,
    text: 'Why?',
    askedAt: 1,
    answer: null,
    answeredAt: null,
    ...overrides,
  }
}

function renderDrawer(
  overrides: Partial<Parameters<typeof ConversationDrawer>[0]> = {},
) {
  return renderWithTheme(
    <ConversationDrawer
      questions={[]}
      files={FILES}
      focusedHunkId="groups@@2"
      ended={false}
      onAsk={() => {}}
      onSelectHunk={() => {}}
      onWidthChange={() => {}}
      {...overrides}
    />,
  )
}

function questionItems(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Questions' })).getAllByRole(
    'listitem',
  )
}

describe('ConversationDrawer', () => {
  it('lists questions in the order asked, each with its hunk or whole-review tag', () => {
    renderDrawer({
      questions: [
        fixtureQuestion({ id: 'q1', hunkId: 'page@@1', text: 'First' }),
        fixtureQuestion({ id: 'q2', hunkId: null, text: 'Second' }),
        fixtureQuestion({ id: 'q3', hunkId: 'groups@@2', text: 'Third' }),
      ],
    })

    const items = questionItems()
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
      expect.stringContaining('Third'),
    ])
    expect(items[0]).toHaveTextContent('Page.js · hunk 1')
    expect(items[1]).toHaveTextContent('Whole review')
    expect(items[2]).toHaveTextContent('useGroups.ts · hunk 2')
  })

  it('focuses a hunk when its tag is clicked', async () => {
    const user = userEvent.setup()
    const onSelectHunk = vi.fn()
    renderDrawer({
      questions: [fixtureQuestion({ hunkId: 'page@@1' })],
      onSelectHunk,
    })

    await user.click(screen.getByRole('button', { name: 'Page.js · hunk 1' }))

    expect(onSelectHunk).toHaveBeenCalledWith('page@@1')
  })

  it('asks about the focused hunk by default and follows focus', async () => {
    const user = userEvent.setup()
    const onAsk = vi.fn()
    const { rerender } = renderDrawer({ onAsk })
    const askBox = screen.getByRole('form', { name: 'Ask the agent' })
    expect(askBox).toHaveTextContent('useGroups.ts · hunk 2')

    rerender(
      <ConversationDrawer
        questions={[]}
        files={FILES}
        focusedHunkId="page@@1"
        ended={false}
        onAsk={onAsk}
        onSelectHunk={() => {}}
        onWidthChange={() => {}}
      />,
    )
    expect(askBox).toHaveTextContent('Page.js · hunk 1')

    await user.type(screen.getByRole('textbox'), 'What calls this?{Enter}')
    expect(onAsk).toHaveBeenCalledWith('page@@1', 'What calls this?')
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('asks about the whole review once the hunk tag is removed', async () => {
    const user = userEvent.setup()
    const onAsk = vi.fn()
    renderDrawer({ onAsk })

    await user.click(
      screen.getByRole('button', {
        name: 'Ask about the whole review instead',
      }),
    )
    const askBox = screen.getByRole('form', { name: 'Ask the agent' })
    expect(askBox).toHaveTextContent('Whole review')

    await user.type(screen.getByRole('textbox'), 'Overall?')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(onAsk).toHaveBeenCalledWith(null, 'Overall?')
  })

  it('adds a newline on Shift+Enter and never sends empty text', async () => {
    const user = userEvent.setup()
    const onAsk = vi.fn()
    renderDrawer({ onAsk })

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await user.type(screen.getByRole('textbox'), '   {Enter}')
    expect(onAsk).not.toHaveBeenCalled()

    await user.type(screen.getByRole('textbox'), 'a{Shift>}{Enter}{/Shift}b')
    expect(screen.getByRole('textbox')).toHaveValue('   a\nb')
    expect(onAsk).not.toHaveBeenCalled()
  })

  it('shows a waiting line until the answer arrives, then the answer as Markdown', () => {
    const { rerender } = renderDrawer({ questions: [fixtureQuestion()] })
    expect(questionItems()[0]).toHaveTextContent('Waiting for the agent…')

    rerender(
      <ConversationDrawer
        questions={[
          fixtureQuestion({
            answer: 'It calls `useGroups` from **Page**.',
            answeredAt: 2,
          }),
        ]}
        files={FILES}
        focusedHunkId={null}
        ended={false}
        onAsk={() => {}}
        onSelectHunk={() => {}}
        onWidthChange={() => {}}
      />,
    )
    const item = questionItems()[0]!
    expect(item).not.toHaveTextContent('Waiting for the agent…')
    expect(item.querySelector('code')).toHaveTextContent('useGroups')
    expect(item.querySelector('strong')).toHaveTextContent('Page')
  })

  it('keeps the question text plain', () => {
    renderDrawer({ questions: [fixtureQuestion({ text: 'Is **this** ok?' })] })

    const item = questionItems()[0]!
    expect(item).toHaveTextContent('Is **this** ok?')
    expect(item.querySelector('strong')).toBeNull()
  })

  it('marks open questions as not answered and disables asking once the review ended', () => {
    renderDrawer({
      ended: true,
      questions: [
        fixtureQuestion({ id: 'q1' }),
        fixtureQuestion({ id: 'q2', answer: 'Done.', answeredAt: 2 }),
      ],
    })

    const [open, answered] = questionItems()
    expect(open).toHaveTextContent('Not answered: the agent ended the review')
    expect(open).not.toHaveTextContent('Waiting for the agent…')
    expect(answered).toHaveTextContent('Done.')
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('opens at the saved width, clamped to 280–560px, defaulting to 360px', () => {
    const { rerender } = renderDrawer()
    const drawer = () =>
      screen.getByRole('complementary', { name: 'Conversation' })
    expect(drawer()).toHaveStyle({ width: '360px' })

    rerender(
      <ConversationDrawer
        questions={[]}
        files={FILES}
        focusedHunkId={null}
        ended={false}
        onAsk={() => {}}
        onSelectHunk={() => {}}
        width={1000}
        onWidthChange={() => {}}
      />,
    )
    expect(drawer()).toHaveStyle({ width: '560px' })
  })

  it('widens when its left edge is dragged left and saves the width on release', () => {
    const onWidthChange = vi.fn()
    renderDrawer({ onWidthChange })
    const handle = screen.getByRole('separator', {
      name: 'Resize conversation',
    })

    fireEvent.mouseDown(handle, { clientX: 500 })
    fireEvent.mouseMove(document, { clientX: 400 })
    fireEvent.mouseUp(document)

    expect(
      screen.getByRole('complementary', { name: 'Conversation' }),
    ).toHaveStyle({ width: '460px' })
    expect(onWidthChange).toHaveBeenCalledWith(460)
  })
})
