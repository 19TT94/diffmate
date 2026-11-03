import { useState } from 'react'
import styled from 'styled-components'

// Components
import { AgentContext } from './components/AgentContext'
import { ConversationDrawer } from './components/ConversationDrawer'
import { FileList } from './components/FileList'
import { HunkStepper } from './components/HunkStepper'
import { SubmitConfirm } from './components/SubmitConfirm'
import { TopBar } from './components/TopBar'

// Hooks
import { flattenHunks, useReviewSession } from './hooks/useReviewSession'
import { useSettings } from './hooks/useSettings'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

// Utils
import { adjacentHunkIds, findNextPendingHunkId } from './lib/hunkNav'
import { isOpen, openQuestionHunkIds, openQuestionPaths } from './lib/questions'

// Types
import type { DiffLayout, HunkStatus, ReviewFile } from './types'

const App = () => {
  const {
    session,
    focusedHunkId,
    setFocusedHunkId,
    setHunkStatus,
    askQuestion,
    submitReview,
  } = useReviewSession()
  const [diffLayout, setDiffLayout] = useState<DiffLayout>('side-by-side')
  const [conversationOpen, setConversationOpen] = useState(false)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  // Answers the reviewer has had the drawer open for; the rest are unseen.
  const [seenAnswerIds, setSeenAnswerIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const { settings, updateSettings } = useSettings()

  const questions = session?.questions ?? []
  const answeredIds = questions
    .filter((question) => !isOpen(question))
    .map((question) => question.id)
  const unseen = answeredIds.filter((id) => !seenAnswerIds.has(id)).length
  // While the drawer is open every answer is in view, so mark it seen.
  if (conversationOpen && unseen > 0) {
    setSeenAnswerIds(new Set(answeredIds))
  }
  const openQuestions = questions.filter(isOpen).length

  const flatHunks = flattenHunks(session)
  const hunkIdsByFile =
    session?.files.map((file) => file.hunks.map((hunk) => hunk.id)) ?? []
  const currentIndex = flatHunks.findIndex(
    (entry) => entry.hunk.id === focusedHunkId,
  )
  const currentEntry = currentIndex === -1 ? null : flatHunks[currentIndex]!
  const currentPath = currentEntry?.file.path ?? null
  const { prev: prevHunkId, next: nextHunkId } = currentEntry
    ? adjacentHunkIds(
        flatHunks.map((entry) => entry.hunk),
        currentEntry.hunk.id,
      )
    : { prev: null, next: null }

  function onSelectFile(index: number): void {
    const firstHunkId = hunkIdsByFile[index]?.[0]
    if (firstHunkId) setFocusedHunkId(firstHunkId)
  }

  function onFocusComment(hunkId: string): void {
    document.getElementById(`comment-${hunkId}`)?.focus()
  }

  // Advances focus to whatever pending work is left after deciding a hunk,
  // wrapping across file boundaries — the optimistic setFocusedHunkId is
  // safe because useReviewSession's refresh() (triggered by setHunkStatus)
  // keeps it as long as it still names a real hunk once the session re-fetches.
  function handleSetStatus(hunkId: string, status: HunkStatus): void {
    const next = findNextPendingHunkId(
      flatHunks.map((entry) => entry.hunk),
      hunkId,
    )
    if (next) setFocusedHunkId(next)
    setHunkStatus(hunkId, status)
  }

  function handleBulkSetStatus(file: ReviewFile, status: HunkStatus): void {
    const lastHunkId = file.hunks.at(-1)?.id ?? null
    const next = findNextPendingHunkId(
      flatHunks.map((entry) => entry.hunk),
      lastHunkId,
    )
    if (next) setFocusedHunkId(next)
    for (const hunk of file.hunks) setHunkStatus(hunk.id, status)
  }

  // Open questions get one confirm step; the agent answers them in its
  // summary instead.
  function requestSubmit(): void {
    if (openQuestions > 0) setConfirmingSubmit(true)
    else submitReview()
  }

  function confirmSubmit(): void {
    setConfirmingSubmit(false)
    submitReview()
  }

  useKeyboardShortcuts({
    hunkIdsByFile,
    focusedHunkId,
    onFocusHunk: setFocusedHunkId,
    onSetStatus: handleSetStatus,
    onFocusComment,
    onSubmit: requestSubmit,
  })

  if (!session) {
    return <Loading>Loading…</Loading>
  }

  // Submit tries to close the tab; this is what's left if the browser won't.
  if (session.reviewComplete) {
    return <Loading>Review sent to the agent. You can close this tab.</Loading>
  }

  const hasAgent = session.mode === 'mcp'

  return (
    <Shell>
      <TopBar
        hunks={flatHunks}
        reviewComplete={session.reviewComplete}
        onSubmit={requestSubmit}
        conversation={
          hasAgent
            ? {
                open: conversationOpen,
                unseen,
                waiting: openQuestions > 0 && !session.reviewEnded,
                onToggle: () => setConversationOpen((open) => !open),
              }
            : null
        }
      />
      <Layout>
        <FileList
          files={session.files}
          currentPath={currentPath}
          onSelectFile={onSelectFile}
          onBulkSetStatus={handleBulkSetStatus}
          width={settings.fileListWidth}
          onWidthChange={(width) => updateSettings({ fileListWidth: width })}
          openQuestionPaths={openQuestionPaths(session.files, questions)}
        />
        <FileView>
          <AgentContext
            mode={session.mode}
            title={session.title}
            summary={session.summary}
          />
          {session.files.length === 0 ? (
            <EmptyState>No changes to review.</EmptyState>
          ) : currentEntry ? (
            <HunkStepper
              file={currentEntry.file}
              hunk={currentEntry.hunk}
              onPrev={prevHunkId ? () => setFocusedHunkId(prevHunkId) : null}
              onNext={nextHunkId ? () => setFocusedHunkId(nextHunkId) : null}
              onSetStatus={handleSetStatus}
              layout={diffLayout}
              onLayoutChange={setDiffLayout}
              hasOpenQuestions={openQuestionHunkIds(questions).has(
                currentEntry.hunk.id,
              )}
            />
          ) : (
            <EmptyState>
              Nothing to review — see the file list for status.
            </EmptyState>
          )}
        </FileView>
        {hasAgent && conversationOpen && (
          <ConversationDrawer
            questions={questions}
            files={session.files}
            focusedHunkId={focusedHunkId}
            ended={session.reviewEnded}
            onAsk={askQuestion}
            onSelectHunk={setFocusedHunkId}
            width={settings.conversationWidth}
            onWidthChange={(width) =>
              updateSettings({ conversationWidth: width })
            }
          />
        )}
      </Layout>
      {confirmingSubmit && (
        <SubmitConfirm
          openQuestions={openQuestions}
          onCancel={() => setConfirmingSubmit(false)}
          onConfirm={confirmSubmit}
        />
      )}
    </Shell>
  )
}

// Style Overrides
const Shell = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const Layout = styled.div`
  flex: 1;
  display: flex;
  min-height: 0;
`

// The side panels shrink first; this keeps the diff readable when they can't.
const FileView = styled.main`
  flex: 1;
  min-width: 360px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing[4]};
`

const EmptyState = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  padding: ${({ theme }) => theme.spacing[8]};
  text-align: center;
`

const Loading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.muted};
`

export default App
