import styled from 'styled-components'

// Components
import { Button } from './ui/Button'
import { HunkView } from './HunkView'

// Types
import type { Hunk, HunkStatus, ReviewFile } from '../types'

interface HunkStepperProps {
  file: ReviewFile
  hunk: Hunk
  index: number
  total: number
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onSetStatus: (hunkId: string, status: HunkStatus) => void
  onSetComment: (hunkId: string, comment: string | null) => void
}

export function HunkStepper({
  file,
  hunk,
  index,
  total,
  onPrev,
  onNext,
  onSetStatus,
  onSetComment,
}: HunkStepperProps) {
  return (
    <Wrap>
      <Header>
        <Path>{file.path}</Path>
        <Progress>
          {index + 1} of {total}
        </Progress>
      </Header>

      <HunkView
        key={hunk.id}
        hunk={hunk}
        isFocused={false}
        onFocus={() => {}}
        onSetStatus={(status) => onSetStatus(hunk.id, status)}
        onSetComment={(comment) => onSetComment(hunk.id, comment)}
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
  max-width: 900px;
  margin: 0 auto;
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
