import { useState } from 'react'
import styled from 'styled-components'

// Components
import { Button } from './ui/Button'
import { HunkView } from './HunkView'

// Hooks
import { useFileContent } from '../hooks/useFileContent'

// Types
import type { Hunk, HunkStatus, ReviewFile } from '../types'

const DEFAULT_OLD_COLUMN_WIDTH = 220

interface HunkStepperProps {
  file: ReviewFile
  hunk: Hunk
  index: number
  total: number
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onSetStatus: (hunkId: string, status: HunkStatus) => void
  onFileChange?: (content: string) => void
}

export function HunkStepper({
  file,
  hunk,
  index,
  total,
  onPrev,
  onNext,
  onSetStatus,
  onFileChange,
}: HunkStepperProps) {
  const {
    content: fileContent,
    error: fileContentError,
    loading: fileContentLoading,
  } = useFileContent(file.path)
  // Lives here, not in HunkView, so a resize sticks as you step between
  // hunks and files — HunkView is keyed by file.path and remounts on file
  // changes.
  const [oldColumnWidth, setOldColumnWidth] = useState(DEFAULT_OLD_COLUMN_WIDTH)

  return (
    <Wrap>
      <Header>
        <Path>{file.path}</Path>
        <Progress>
          {index + 1} of {total}
        </Progress>
      </Header>

      {/* Keyed by file, not hunk: the whole-file editor must survive hunk
          stepping. The old-side strip remounts per hunk on its own. */}
      <HunkView
        key={file.path}
        hunk={hunk}
        filePath={file.path}
        isFocused={false}
        onFocus={() => {}}
        onSetStatus={(status) => onSetStatus(hunk.id, status)}
        onFileChange={onFileChange ?? (() => {})}
        fileContent={fileContent}
        fileContentError={fileContentError}
        fileContentLoading={fileContentLoading}
        oldColumnWidth={oldColumnWidth}
        onOldColumnWidthChange={setOldColumnWidth}
      />

      <Nav>
        <Button
          size="sm"
          variant="ghost"
          disabled={!onPrev}
          onClick={() => onPrev?.()}
        >
          ‹ Prev
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!onNext}
          onClick={() => onNext?.()}
        >
          Next ›
        </Button>
      </Nav>
    </Wrap>
  )
}

// Style Overrides
const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
`

const Header = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`

const Path = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Progress = styled.span`
  flex: none;
  margin-left: auto;
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const Nav = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing[2]};
`
