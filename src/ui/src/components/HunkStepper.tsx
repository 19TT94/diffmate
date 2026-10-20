import styled from 'styled-components'

// Components
import { HunkView } from './HunkView'

// Hooks
import { useFileContent } from '../hooks/useFileContent'

// Types
import type { DiffLayout, Hunk, HunkStatus, ReviewFile } from '../types'

interface HunkStepperProps {
  file: ReviewFile
  hunk: Hunk
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onSetStatus: (hunkId: string, status: HunkStatus) => void
  onFileChange?: (content: string) => void
  layout: DiffLayout
  onLayoutChange: (layout: DiffLayout) => void
}

export function HunkStepper({
  file,
  hunk,
  onPrev,
  onNext,
  onSetStatus,
  onFileChange,
  layout,
  onLayoutChange,
}: HunkStepperProps) {
  const {
    content: fileContent,
    error: fileContentError,
    loading: fileContentLoading,
  } = useFileContent(file.path)

  return (
    <Wrap>
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
        layout={layout}
        onLayoutChange={onLayoutChange}
        onPrev={onPrev}
        onNext={onNext}
        position={{
          index: file.hunks.findIndex((entry) => entry.id === hunk.id),
          total: file.hunks.length,
        }}
      />
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
