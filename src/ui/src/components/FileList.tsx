import { useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import styled, { css } from 'styled-components'

// Components
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

// Utils
import { clampWidth, startDragResize } from '../lib/dragResize'
import {
  fileBadgeStatus,
  fileLineStats,
  reviewedCount,
  splitPath,
} from '../lib/summary'

// Types
import type { HunkStatus, ReviewFile } from '../types'

const DEFAULT_WIDTH = 280
const MIN_WIDTH = 220
const MAX_WIDTH = 480

function displayWidth(saved: number | undefined): number {
  return clampWidth(saved ?? DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH)
}

interface FileListProps {
  files: ReviewFile[]
  currentPath: string | null
  onSelectFile: (index: number) => void
  onBulkSetStatus: (file: ReviewFile, status: HunkStatus) => void
  // The saved width (from settings); undefined means the default.
  width?: number
  // Called once per drag, when it ends, to save the new width.
  onWidthChange: (width: number) => void
}

export function FileList({
  files,
  currentPath,
  onSelectFile,
  onBulkSetStatus,
  width: savedWidth,
  onWidthChange,
}: FileListProps) {
  // Simplest possible collapse for now — local, not persisted, no animation.
  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(() => displayWidth(savedWidth))
  // Saved settings arrive after the first render; follow them when they do.
  const [lastSaved, setLastSaved] = useState(savedWidth)
  if (savedWidth !== lastSaved) {
    setLastSaved(savedWidth)
    setWidth(displayWidth(savedWidth))
  }

  function handleResizeStart(event: ReactMouseEvent): void {
    startDragResize(event, {
      startWidth: width,
      min: MIN_WIDTH,
      max: MAX_WIDTH,
      onChange: setWidth,
      onEnd: onWidthChange,
    })
  }

  return (
    <Nav
      aria-label="Changed files"
      $collapsed={collapsed}
      style={collapsed ? undefined : { width }}
    >
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
        <Resizer
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize file list"
          onMouseDown={handleResizeStart}
        />
      )}
      {collapsed ? null : (
        <List>
          {files.map((file, index) => {
            const { add, del } = fileLineStats(file)
            const { dir, name } = splitPath(file.path)
            const badgeStatus = fileBadgeStatus(file)
            return (
              <Item
                key={file.path}
                $current={file.path === currentPath}
                onClick={() => onSelectFile(index)}
              >
                <Badge
                  status={badgeStatus}
                  detail={
                    badgeStatus === 'mixed'
                      ? `(${reviewedCount(file.hunks)} of ${file.hunks.length})`
                      : undefined
                  }
                />
                <Path title={file.path}>
                  <bdi>
                    {dir && <Dir>{dir}</Dir>}
                    <Name>{name}</Name>
                  </bdi>
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
  ${({ $collapsed, theme }) =>
    $collapsed &&
    css`
      width: ${theme.spacing[2]};
    `}
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

// Straddles the right border; the toggle button sits above it.
const Resizer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  right: -3px;
  width: 6px;
  cursor: col-resize;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
  }
`

const ToggleButton = styled(Button)`
  position: absolute;
  top: ${({ theme }) => theme.spacing[3]};
  right: 0;
  z-index: 2;
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

// Trims the whole path from the front ("…ui/Button.tsx") so the file name
// stays visible: rtl puts the ellipsis on the left (text-align keeps a path
// that fits flush left), and <bdi> keeps the path itself in its own order.
const Path = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  direction: rtl;
  text-align: left;
  font-family: ${({ theme }) => theme.fonts.mono};
`

const Dir = styled.span`
  color: ${({ theme }) => theme.colors.muted};
`

const Name = styled.span`
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  color: ${({ theme }) => theme.colors.secondary};
`

const StatAdd = styled.span`
  color: ${({ theme }) => theme.colors.success};
`

const StatDel = styled.span`
  color: ${({ theme }) => theme.colors.danger};
`
