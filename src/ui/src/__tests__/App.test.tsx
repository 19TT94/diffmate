import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Contexts
import { SettingsProvider } from '../contexts/SettingsContext'

// Components
import App from '../App'

// Utils
import * as api from '../lib/api'

// Types
import type { Question, ReviewSessionSummary } from '../types'

vi.mock('../lib/api', () => ({
  fetchSession: vi.fn(),
  connectEvents: vi.fn(),
  askQuestion: vi.fn(),
  submitReview: vi.fn(),
  setHunkStatus: vi.fn(),
  setHunkComment: vi.fn(),
  setHunkEditedContent: vi.fn(),
  fetchFileContent: vi.fn(),
  fetchSettings: vi.fn(),
  patchSettings: vi.fn(),
}))

function fixtureSession(
  overrides: Partial<ReviewSessionSummary> = {},
): ReviewSessionSummary {
  return {
    id: 's1',
    mode: 'mcp',
    scope: {},
    title: null,
    summary: null,
    reviewComplete: false,
    reviewEnded: false,
    questions: [],
    files: [
      {
        path: 'a.ts',
        oldPath: null,
        status: 'modified',
        binary: false,
        notes: null,
        hunks: [
          {
            id: 'a.ts@@1',
            header: '@@ -1,1 +1,1 @@',
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: [
              {
                type: 'context',
                content: 'same',
                oldLineNumber: 1,
                newLineNumber: 1,
              },
            ],
            status: 'pending',
            summary: null,
            comment: null,
            editedContent: null,
          },
        ],
      },
    ],
    ...overrides,
  }
}

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    hunkId: 'a.ts@@1',
    text: 'Why?',
    askedAt: 1,
    answer: null,
    answeredAt: null,
    ...overrides,
  }
}

let onServerEvent: () => void = () => {}

// Serves `next` from now on and replays an SSE event, as the server would
// after a question is answered.
async function pushSession(next: ReviewSessionSummary): Promise<void> {
  vi.mocked(api.fetchSession).mockResolvedValue(next)
  await act(async () => onServerEvent())
}

async function renderApp(session: ReviewSessionSummary) {
  vi.mocked(api.fetchSession).mockResolvedValue(session)
  render(
    <SettingsProvider>
      <App />
    </SettingsProvider>,
  )
  await screen.findByRole('toolbar', { name: 'Hunk actions' })
}

const conversationButton = () =>
  screen.getByRole('button', { name: /^Conversation/ })
const drawer = () =>
  screen.queryByRole('complementary', { name: 'Conversation' })

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom really closes its window, tearing down the document.
  vi.spyOn(window, 'close').mockImplementation(() => {})
  vi.mocked(api.connectEvents).mockImplementation((onEvent) => {
    onServerEvent = onEvent
    return { close: () => {} } as EventSource
  })
  vi.mocked(api.fetchSettings).mockResolvedValue({})
  vi.mocked(api.patchSettings).mockResolvedValue({})
  vi.mocked(api.fetchFileContent).mockResolvedValue({ content: 'same' })
  vi.mocked(api.submitReview).mockResolvedValue()
  vi.mocked(api.askQuestion).mockResolvedValue()
})

describe('App conversation', () => {
  it('toggles a drawer beside the review from the "?" button, starting closed', async () => {
    const user = userEvent.setup()
    await renderApp(fixtureSession())
    expect(drawer()).toBeNull()

    await user.click(conversationButton())
    expect(drawer()).not.toBeNull()
    expect(conversationButton()).toHaveAttribute('aria-expanded', 'true')
    // Beside the review, not over it: same layout row as the file view.
    expect(drawer()!.parentElement).toBe(screen.getByRole('main').parentElement)
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(conversationButton())
    expect(drawer()).toBeNull()
  })

  it('has no conversation button in a CLI review', async () => {
    await renderApp(fixtureSession({ mode: 'cli' }))

    expect(screen.queryByRole('button', { name: /^Conversation/ })).toBeNull()
  })

  it('sends a question from the drawer to the server', async () => {
    const user = userEvent.setup()
    await renderApp(fixtureSession())

    await user.click(conversationButton())
    await user.type(
      screen.getByRole('textbox', { name: 'Question' }),
      'Why?{Enter}',
    )

    expect(api.askQuestion).toHaveBeenCalledWith('a.ts@@1', 'Why?')
  })

  it('badges unseen answers and dots waiting questions without opening the drawer', async () => {
    const user = userEvent.setup()
    await renderApp(fixtureSession({ questions: [question()] }))
    expect(
      within(conversationButton()).getByTitle('Waiting for answers'),
    ).toBeTruthy()

    await pushSession(
      fixtureSession({
        questions: [question({ answer: 'Because.', answeredAt: 2 })],
      }),
    )
    await waitFor(() => {
      expect(
        within(conversationButton()).getByTitle('1 new answer'),
      ).toHaveTextContent('1')
    })
    expect(
      within(conversationButton()).queryByTitle('Waiting for answers'),
    ).toBeNull()
    expect(drawer()).toBeNull()

    await user.click(conversationButton())
    await user.click(conversationButton())
    expect(within(conversationButton()).queryByTitle('1 new answer')).toBeNull()
  })

  it('marks the hunk and its file row while a question waits', async () => {
    await renderApp(fixtureSession({ questions: [question()] }))

    const marker = 'Waiting on an answer from the agent'
    expect(
      within(screen.getByRole('toolbar', { name: 'Hunk actions' })).getByTitle(
        marker,
      ),
    ).toBeTruthy()
    expect(
      within(
        screen.getByRole('navigation', { name: 'Changed files' }),
      ).getByTitle(marker),
    ).toBeTruthy()
  })
})

describe('App submit', () => {
  it('confirms before submitting with unanswered questions', async () => {
    const user = userEvent.setup()
    await renderApp(fixtureSession({ questions: [question()] }))

    await user.click(screen.getByRole('button', { name: /Submit review/ }))
    const confirm = screen.getByRole('alertdialog')
    expect(confirm).toHaveTextContent(
      "1 question hasn't been answered. The agent will answer it in its summary.",
    )

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(api.submitReview).not.toHaveBeenCalled()

    await user.keyboard('{Meta>}{Enter}{/Meta}')
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Submit anyway',
      }),
    )
    expect(api.submitReview).toHaveBeenCalledTimes(1)
  })

  it('submits straight away with no open questions', async () => {
    const user = userEvent.setup()
    await renderApp(fixtureSession())

    await user.click(screen.getByRole('button', { name: /Submit review/ }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(api.submitReview).toHaveBeenCalledTimes(1)
  })

  it('closes the tab after submitting, or says it can be closed', async () => {
    const user = userEvent.setup()
    await renderApp(fixtureSession())
    vi.mocked(api.fetchSession).mockResolvedValue(
      fixtureSession({ reviewComplete: true }),
    )

    await user.click(screen.getByRole('button', { name: /Submit review/ }))

    await waitFor(() => expect(window.close).toHaveBeenCalled())
    expect(
      await screen.findByText(
        'Review sent to the agent. You can close this tab.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('toolbar', { name: 'Hunk actions' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Submit review/ })).toBeNull()
  })
})
