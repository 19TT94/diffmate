import styled, { css } from 'styled-components'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md'

interface StyledButtonProps {
  $variant: ButtonVariant
  $size: ButtonSize
  $active?: boolean
}

const variantStyles = {
  primary: css<StyledButtonProps>`
    background-color: ${({ theme, $active }) => ($active ? theme.colors.success : theme.colors.primary)};
    border-color: ${({ theme, $active }) => ($active ? theme.colors.success : theme.colors.primary)};
    color: ${({ theme }) => theme.colors.tertiary};

    &:hover:not(:disabled) {
      filter: brightness(0.92);
    }
  `,
  secondary: css<StyledButtonProps>`
    background-color: ${({ theme }) => theme.colors.tertiary};
    border-color: ${({ theme }) => theme.colors.border};
    color: ${({ theme, $active }) => ($active ? theme.colors.danger : theme.colors.secondary)};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.background};
    }
  `,
  ghost: css<StyledButtonProps>`
    background-color: transparent;
    border-color: transparent;
    color: ${({ theme }) => theme.colors.muted};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.background};
    }
  `,
}

const sizeStyles = {
  sm: css`
    padding: 2px ${({ theme }) => theme.spacing[2]};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,
  md: css`
    padding: ${({ theme }) => theme.spacing[2]}
      ${({ theme }) => theme.spacing[4]};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,
}

const StyledButton = styled.button<StyledButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radii.md};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease,
    filter 0.15s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  ${({ $variant }) => variantStyles[$variant]}
  ${({ $size }) => sizeStyles[$size]}
`

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  active?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  active,
  ...props
}: ButtonProps) {
  return (
    <StyledButton $variant={variant} $size={size} $active={active} {...props} />
  )
}
