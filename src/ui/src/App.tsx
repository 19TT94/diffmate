import { useEffect } from 'react'
import styled from 'styled-components'

// Components
import { Banner } from './components/Banner'
import { FileList } from './components/FileList'
import { FileSection } from './components/FileSection'
import { TopBar } from './components/TopBar'

// Hooks
import { flattenHunks, useReviewSession } from './hooks/useReviewSession'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

// Types
import type { HunkStatus, ReviewFile } from './types'

const App = () => {
  const {
    session,
    focusedHunkId,
    setFocusedHunkId,
    setHunkStatus,
    setHunkComment,
    submitReview,
  } = useReviewSession()

  const flatHunks = flattenHunks(session)
  const hunkIdsByFile =
    session?.files.map((file) => file.hunks.map((hunk) => hunk.id)) ?? []
  const currentPath =
    flatHunks.find((entry) => entry.hunk.id === focusedHunkId)?.file.path ??
    null

  useEffect(() => {
    if (!focusedHunkId) return
    document
      .getElementById(`hunk-${focusedHunkId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusedHunkId])

  function onSelectFile(index: number): void {
    document
      .getElementById(`file-section-${index}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function onFocusComment(hunkId: string): void {
    document.getElementById(`comment-${hunkId}`)?.focus()
  }

  function onBulkSetStatus(file: ReviewFile, status: HunkStatus): void {
    for (const hunk of file.hunks) setHunkStatus(hunk.id, status)
  }

  useKeyboardShortcuts({
    hunkIdsByFile,
    focusedHunkId,
    onFocusHunk: setFocusedHunkId,
    onSetStatus: setHunkStatus,
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
        />
        <FileView>
          {session.files.length === 0 ? (
            <EmptyState>No changes to review.</EmptyState>
          ) : (
            session.files.map((file, index) => (
              <FileSection
                key={file.path}
                file={file}
                index={index}
                focusedHunkId={focusedHunkId}
                onFocusHunk={setFocusedHunkId}
                onSetHunkStatus={setHunkStatus}
                onSetHunkComment={setHunkComment}
                onBulkSetStatus={onBulkSetStatus}
              />
            ))
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
  overflow-y: auto;
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
