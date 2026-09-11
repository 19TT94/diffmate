import styled from 'styled-components'

interface BannerProps {
  children: React.ReactNode
}

export function Banner({ children }: BannerProps) {
  return <Wrap>{children}</Wrap>
}

// Style Overrides
const Wrap = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.spacing[4]};
  left: 50%;
  transform: translateX(-50%);
  background: ${({ theme }) => theme.colors.secondary};
  color: ${({ theme }) => theme.colors.tertiary};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[5]};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`
