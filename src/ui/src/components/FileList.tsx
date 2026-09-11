import styled from 'styled-components'

// Components
import { Badge } from './ui/Badge'

// Utils
import { fileBadgeStatus, fileLineStats } from '../lib/summary'

// Types
import type { ReviewFile } from '../types'

interface FileListProps {
  files: ReviewFile[]
  currentPath: string | null
  onSelectFile: (index: number) => void
}

export function FileList({ files, currentPath, onSelectFile }: FileListProps) {
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
`

const Path = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.mono};
`

const Stat = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const StatAdd = styled.span`
  color: ${({ theme }) => theme.colors.success};
`

const StatDel = styled.span`
  color: ${({ theme }) => theme.colors.danger};
`
