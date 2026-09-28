import { useState } from 'react'
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
  // Simplest possible collapse for now — local, not persisted, no animation.
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Nav aria-label="Changed files" $collapsed={collapsed}>
      <ToggleButton
        variant="secondary"
        size="sm"
        aria-expanded={!collapsed}
        title={collapsed ? 'Show changed files' : 'Hide changed files'}
        onClick={() => setCollapsed((value) => !value)}
      >
        {collapsed ? '›' : '‹'}
      </ToggleButton>
      {collapsed ? null : (
        <List>
          {files.map((file, index) => {
            const { add, del } = fileLineStats(file)
            const lastSlash = file.path.lastIndexOf('/')
            const dir =
              lastSlash === -1 ? null : file.path.slice(0, lastSlash + 1)
            const name =
              lastSlash === -1 ? file.path : file.path.slice(lastSlash + 1)
            return (
              <Item
                key={file.path}
                $current={file.path === currentPath}
                onClick={() => onSelectFile(index)}
              >
                <Badge status={fileBadgeStatus(file)} />
                <Path title={file.path}>
                  {dir && <Dir>{dir}</Dir>}
                  <Name>{name}</Name>
                </Path>
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
        </List>
      )}
    </Nav>
  )
}

// Style Overrides
const Nav = styled.nav<{ $collapsed: boolean }>`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: ${({ $collapsed, theme }) =>
    $collapsed ? theme.spacing[2] : '280px'};
  flex: none;
  overflow: visible;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.background};
`

const List = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: ${({ theme }) => theme.spacing[3]};
`

const ToggleButton = styled(Button)`
  position: absolute;
  top: ${({ theme }) => theme.spacing[3]};
  right: 0;
  z-index: 1;
  width: ${({ theme }) => theme.spacing[4]};
  height: ${({ theme }) => theme.spacing[4]};
  padding: 0;
  line-height: 1;
  border-radius: ${({ theme }) => theme.radii.full};
  transform: translateX(50%);

  &:hover:not(:disabled) {
    filter: brightness(0.92);
    background-color: ${({ theme }) => theme.colors.tertiary};
  }
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
  min-width: 0;
  display: flex;
  align-items: baseline;
  overflow: hidden;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.mono};
`

const Dir = styled.span`
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme }) => theme.colors.muted};
`

const Name = styled.span`
  flex: none;
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.secondary};
`

const StatAdd = styled.span`
  color: ${({ theme }) => theme.colors.success};
`

const StatDel = styled.span`
  color: ${({ theme }) => theme.colors.danger};
`
