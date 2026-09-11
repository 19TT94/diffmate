import { describe, expect, it } from 'vitest'

// Components
import { Badge } from '../Badge'

// Utils
import { renderWithTheme } from '../../../test/render'

describe('Badge', () => {
  it('renders the status as its label', () => {
    const { getByText } = renderWithTheme(<Badge status="approved" />)
    expect(getByText('approved')).toBeInTheDocument()
  })
})
