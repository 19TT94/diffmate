import styled from 'styled-components'

// Components
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

// Utils
import { fileBadgeStatus, fileLineStats } from '../lib/summary'

// Types
import type { HunkStatus, ReviewFile } from '../types'

interface FileListProps {
  files: ReviewFile[]
  currentPath: string | null
  onSelectFile: (index: number) => void
  onBulkSetStatus: (file: ReviewFile, status: HunkStatus) => void
}

export function FileList({
  files,
  currentPath,
  onSelectFile,
  onBulkSetStatus,
}: FileListProps) {
  return (
    <Nav aria-label="Changed files">
      {files.map((file, index) => {
        const { add, del } = fileLineStats(file)
        return (
          <Item
            key={file.path}
            $current={file.path === currentPath}
            onClick={() => onSelectFile(index)}
          >
            <Badge status={fileBadgeStatus(file)} />
            <Path>{file.path}</Path>
            <Stat>
              <StatAdd>+{add}</StatAdd> <StatDel>-{del}</StatDel>
            </Stat>
            {file.hunks.length > 0 && (
              <BulkActions>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Approve all hunks in this file"
                  onClick={(event) => {
                    event.stopPropagation()
                    onBulkSetStatus(file, 'approved')
                  }}
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Reject all hunks in this file"
                  onClick={(event) => {
                    event.stopPropagation()
                    onBulkSetStatus(file, 'rejected')
                  }}
                >
                  ✕
                </Button>
              </BulkActions>
            )}
          </Item>
        )
      })}
    </Nav>
  )
}

// Style Overrides
const Nav = styled.nav`
  width: 280px;
  flex: none;
  overflow-y: auto;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.background};
`

const Stat = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const BulkActions = styled.div`
  display: none;
  flex: none;
  gap: ${({ theme }) => theme.spacing[1]};
`

const Item = styled.div<{ $current: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  cursor: pointer;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  background: ${({ theme, $current }) => ($current ? theme.colors.tertiary : 'transparent')};

  &:hover {
    background: ${({ theme }) => theme.colors.tertiary};
  }

  &:hover ${Stat} {
    display: none;
  }

  &:hover ${BulkActions} {
    display: flex;
  }
`

const Path = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.mono};
`

const StatAdd = styled.span`
  color: ${({ theme }) => theme.colors.success};
`

const StatDel = styled.span`
  color: ${({ theme }) => theme.colors.danger};
`
