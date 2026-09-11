import styled, { css } from 'styled-components'

// Types
import type { FileBadgeStatus } from '../../lib/summary'
import type { HunkStatus } from '../../types'

export type BadgeStatus = HunkStatus | FileBadgeStatus

interface StyledBadgeProps {
  $status: BadgeStatus
}

const statusStyles = {
  pending: css`
    background-color: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.accent} 16%,
      ${({ theme }) => theme.colors.tertiary}
    );
    color: ${({ theme }) => theme.colors.accent};
  `,
  approved: css`
    background-color: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.success} 16%,
      ${({ theme }) => theme.colors.tertiary}
    );
    color: ${({ theme }) => theme.colors.success};
  `,
  rejected: css`
    background-color: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.danger} 16%,
      ${({ theme }) => theme.colors.tertiary}
    );
    color: ${({ theme }) => theme.colors.danger};
  `,
  mixed: css`
    background-color: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.primary} 16%,
      ${({ theme }) => theme.colors.tertiary}
    );
    color: ${({ theme }) => theme.colors.primary};
  `,
  binary: css`
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.muted};
  `,
  unsupported: css`
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.muted};
  `,
}

const StyledBadge = styled.span<StyledBadgeProps>`
  display: inline-block;
  padding: 1px ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  text-transform: uppercase;
  white-space: nowrap;

  ${({ $status }) => statusStyles[$status]}
`

export interface BadgeProps {
  status: BadgeStatus
}

export function Badge({ status }: BadgeProps) {
  return <StyledBadge $status={status}>{status}</StyledBadge>
}
