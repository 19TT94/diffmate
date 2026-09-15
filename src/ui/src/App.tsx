import styled from 'styled-components'

// Components
import { Banner } from './components/Banner'
import { FileList } from './components/FileList'
import { HunkStepper } from './components/HunkStepper'
import { TopBar } from './components/TopBar'

// Hooks
import { flattenHunks, useReviewSession } from './hooks/useReviewSession'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

// Utils
import { findNextPendingHunkId } from './lib/hunkNav'

// Types
import type { HunkStatus, ReviewFile } from './types'

const App = () => {
  const {
    session,
    focusedHunkId,
    setFocusedHunkId,
    setHunkStatus,
    submitReview,
  } = useReviewSession()

  const flatHunks = flattenHunks(session)
  const hunkIdsByFile =
    session?.files.map((file) => file.hunks.map((hunk) => hunk.id)) ?? []
  const currentIndex = flatHunks.findIndex(
    (entry) => entry.hunk.id === focusedHunkId,
  )
  const currentEntry = currentIndex === -1 ? null : flatHunks[currentIndex]!
  const currentPath = currentEntry?.file.path ?? null

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

  useKeyboardShortcuts({
    hunkIdsByFile,
    focusedHunkId,
    onFocusHunk: setFocusedHunkId,
    onSetStatus: handleSetStatus,
    onFocusComment,
    onSubmit: submitReview,
  })

  if (!session) {
    return <Loading>Loading…</Loading>
  }

  return (
    <Shell>
      <TopBar
        hunks={flatHunks}
        reviewComplete={session.reviewComplete}
        onSubmit={submitReview}
      />
      <Layout>
        <FileList
          files={session.files}
          currentPath={currentPath}
          onSelectFile={onSelectFile}
          onBulkSetStatus={handleBulkSetStatus}
        />
        <FileView>
          {session.files.length === 0 ? (
            <EmptyState>No changes to review.</EmptyState>
          ) : currentEntry ? (
            <HunkStepper
              file={currentEntry.file}
              hunk={currentEntry.hunk}
              index={currentIndex}
              total={flatHunks.length}
              onPrev={
                currentIndex > 0
                  ? () => setFocusedHunkId(flatHunks[currentIndex - 1]!.hunk.id)
                  : null
              }
              onNext={
                currentIndex < flatHunks.length - 1
                  ? () => setFocusedHunkId(flatHunks[currentIndex + 1]!.hunk.id)
                  : null
              }
              onSetStatus={handleSetStatus}
            />
          ) : (
            <EmptyState>
              Nothing to review — see the file list for status.
            </EmptyState>
          )}
        </FileView>
      </Layout>
      {session.reviewComplete && <Banner>Review submitted.</Banner>}
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

const FileView = styled.main`
  flex: 1;
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
