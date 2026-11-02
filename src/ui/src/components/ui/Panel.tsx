import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styled, { css } from 'styled-components'

export type PanelTone = 'neutral' | 'agent'

interface PanelProps {
  title: ReactNode
  // Names the panel in its buttons' labels, e.g. "Collapse diff".
  name: string
  // A pill before the title, e.g. "agent".
  badge?: string
  // Only colors differ between tones; layout and controls are shared.
  tone?: PanelTone
  // Extra header controls, placed before the panel's own buttons.
  actions?: ReactNode
  // Adds a button that opens the panel in a larger view over the page.
  expandable?: boolean
  // Replaces the title in the larger view, which has no surrounding context.
  expandedTitle?: ReactNode
  // The body; without one there is nothing to collapse.
  children?: ReactNode
  className?: string
}

// The app's one collapsible panel: a bordered card whose header can hide the
// body or (if expandable) open it in a larger view. The larger view is this
// same element lifted into a fixed overlay rather than a copy in a portal,
// and collapsing only hides the body, so editors inside keep their state.
export function Panel({
  title,
  name,
  badge,
  tone = 'neutral',
  actions,
  expandable = false,
  expandedTitle,
  children,
  className,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const headingId = useId()
  const expandRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const hasBody = children !== undefined && children !== null

  useEffect(() => {
    if (!expanded) return
    closeRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [expanded])

  // Focus goes back to the expand button once the overlay closes.
  const wasExpanded = useRef(false)
  useEffect(() => {
    if (wasExpanded.current && !expanded) expandRef.current?.focus()
    wasExpanded.current = expanded
  }, [expanded])

  function expand(): void {
    setCollapsed(false)
    setExpanded(true)
  }

  return (
    <>
      {expanded && (
        <Backdrop
          data-testid="panel-backdrop"
          onClick={() => setExpanded(false)}
        />
      )}
      <Section
        className={className}
        aria-labelledby={headingId}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded ? true : undefined}
        $tone={tone}
        data-collapsed={collapsed || !hasBody}
        data-expanded={expanded}
      >
        <Header $tone={tone}>
          <Heading id={headingId}>
            {badge && <Badge $tone={tone}>{badge}</Badge>}
            <Title>{expanded ? (expandedTitle ?? title) : title}</Title>
          </Heading>
          {actions}
          {expanded ? (
            <IconButton
              ref={closeRef}
              type="button"
              aria-label={`Close larger ${name} view`}
              title="Close (Esc)"
              onClick={() => setExpanded(false)}
            >
              <Icon viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </Icon>
            </IconButton>
          ) : (
            <>
              {expandable && (
                <IconButton
                  ref={expandRef}
                  type="button"
                  aria-label={`Open ${name} in a larger view`}
                  title="Open in a larger view"
                  onClick={expand}
                >
                  <Icon viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9" />
                  </Icon>
                </IconButton>
              )}
              {hasBody && (
                <IconButton
                  type="button"
                  aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}
                  title={collapsed ? 'Show' : 'Hide'}
                  aria-expanded={!collapsed}
                  aria-controls={bodyId}
                  onClick={() => setCollapsed((value) => !value)}
                >
                  <Chevron
                    $collapsed={collapsed}
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </Chevron>
                </IconButton>
              )}
            </>
          )}
        </Header>
        {hasBody && (
          // Hidden rather than unmounted, so editors keep their state.
          <Body id={bodyId} hidden={collapsed} $tone={tone}>
            {children}
          </Body>
        )}
      </Section>
    </>
  )
}

// Padded, wrapping prose for a panel body (summaries, explanations).
export const PanelText = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  line-height: 1.5;
  white-space: pre-wrap;
`

// Style Overrides
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgb(31 35 40 / 0.45);
`

// Attribute selectors outrank a single class, so collapsed and expanded
// states win over sizing that callers add with styled(Panel).
const Section = styled.section<{ $tone: PanelTone }>`
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.tertiary};
  overflow: hidden;
  ${({ $tone, theme }) =>
    $tone === 'agent'
      ? css`
          border: 3px solid ${theme.colors.agent};
        `
      : css`
          border: 1px solid ${theme.colors.border};
        `}

  &[data-collapsed='true'] {
    flex: none;
    min-height: 0;
  }

  &[data-expanded='true'] {
    position: fixed;
    inset: 5vh 5vw;
    z-index: 50;
    max-height: none;
    min-height: 0;
    box-shadow: 0 16px 48px rgb(31 35 40 / 0.3);
  }
`

const Header = styled.div<{ $tone: PanelTone }>`
  flex: none;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  ${({ $tone, theme }) =>
    $tone === 'agent'
      ? css`
          background: ${theme.colors.agent};
          color: ${theme.colors.onAgent};
        `
      : css`
          background: ${theme.colors.background};
          color: ${theme.colors.secondary};
        `}

  ${Section}[data-collapsed='false'] > & {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
`

const Heading = styled.h3`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
`

const Title = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Badge = styled.span<{ $tone: PanelTone }>`
  flex: none;
  padding: 1px ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  ${({ $tone, theme }) =>
    $tone === 'agent'
      ? css`
          background: ${theme.colors.tertiary};
          color: ${theme.colors.agentOnWhite};
        `
      : css`
          background: ${theme.colors.border};
          color: ${theme.colors.muted};
        `}
`

// Takes the header's text color, so it reads on any tone.
const IconButton = styled.button`
  flex: none;
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: transparent;
  color: inherit;
  opacity: 0.75;
  cursor: pointer;

  &:hover {
    opacity: 1;
    background: color-mix(in srgb, currentColor 14%, transparent);
  }

  &:focus-visible {
    opacity: 1;
    outline: 2px solid currentColor;
    outline-offset: 1px;
  }
`

const Icon = styled.svg`
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
`

const Chevron = styled(Icon)<{ $collapsed: boolean }>`
  transition: transform 120ms ease;
  transform: rotate(${({ $collapsed }) => ($collapsed ? '-90deg' : '0deg')});
`

const Body = styled.div<{ $tone: PanelTone }>`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: ${({ $tone, theme }) =>
    $tone === 'agent' ? theme.colors.background : theme.colors.tertiary};

  &[hidden] {
    display: none;
  }
`
