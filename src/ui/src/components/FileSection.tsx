import styled from 'styled-components'

// Components
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { HunkView } from './HunkView'

// Utils
import { fileBadgeStatus } from '../lib/summary'

// Types
import type { ReviewFile, HunkStatus } from '../types'

interface FileSectionProps {
  file: ReviewFile
  index: number
  focusedHunkId: string | null
  onFocusHunk: (hunkId: string) => void
  onSetHunkStatus: (hunkId: string, status: HunkStatus) => void
  onSetHunkComment: (hunkId: string, comment: string | null) => void
  onBulkSetStatus: (file: ReviewFile, status: HunkStatus) => void
}

export function FileSection({
  file,
  index,
  focusedHunkId,
  onFocusHunk,
  onSetHunkStatus,
  onSetHunkComment,
  onBulkSetStatus,
}: FileSectionProps) {
  return (
    <Section id={`file-section-${index}`}>
      <SectionHeader>
        <Path>{file.path}</Path>
        <Badge status={fileBadgeStatus(file)} />
        {file.hunks.length > 0 && (
          <BulkActions>
            <Button size="sm" onClick={() => onBulkSetStatus(file, 'approved')}>
              Approve all
            </Button>
            <Button size="sm" onClick={() => onBulkSetStatus(file, 'rejected')}>
              Reject all
            </Button>
          </BulkActions>
        )}
      </SectionHeader>

      {file.binary || file.status === 'unsupported' ? (
        <EmptyState>
          {file.binary
            ? 'Binary file — content not shown.'
            : 'Unsupported change (submodule/symlink) — content not shown.'}
        </EmptyState>
      ) : (
        file.hunks.map((hunk) => (
          <HunkView
            key={hunk.id}
            hunk={hunk}
            isFocused={hunk.id === focusedHunkId}
            onFocus={() => onFocusHunk(hunk.id)}
            onSetStatus={(status) => onSetHunkStatus(hunk.id, status)}
            onSetComment={(comment) => onSetHunkComment(hunk.id, comment)}
          />
        ))
      )}
    </Section>
  )
}

// Style Overrides
const Section = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing[8]};
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`

const Path = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`

const BulkActions = styled.div`
  margin-left: auto;
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
`

const EmptyState = styled.div`
  color: ${({ theme }) => theme.colors.muted};
  padding: ${({ theme }) => theme.spacing[8]};
  text-align: center;
`
