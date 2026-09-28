import styled from 'styled-components'

// Components
import { Button } from './Button'

// Types
import type { DiffLayout } from '../../types'

interface ViewModeToggleProps {
  layout: DiffLayout
  onLayoutChange: (layout: DiffLayout) => void
}

export function ViewModeToggle({
  layout,
  onLayoutChange,
}: ViewModeToggleProps) {
  return (
    <Group role="group" aria-label="Diff layout">
      <Button
        size="sm"
        variant="ghost"
        active={layout === 'stacked'}
        aria-pressed={layout === 'stacked'}
        title="Stack the diff above the file"
        onClick={() => onLayoutChange('stacked')}
      >
        ▬▬
      </Button>
      <Button
        size="sm"
        variant="ghost"
        active={layout === 'side-by-side'}
        aria-pressed={layout === 'side-by-side'}
        title="Show the diff and file side by side"
        onClick={() => onLayoutChange('side-by-side')}
      >
        ▮▮
      </Button>
    </Group>
  )
}

// Style Overrides
const Group = styled.div`
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
`
