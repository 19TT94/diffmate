import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

// Components
import { Markdown } from '../Markdown'

// Utils
import { renderWithTheme } from '../../test/render'

describe('Markdown', () => {
  it('renders paragraphs, inline code, lists, and emphasis', () => {
    const { container } = renderWithTheme(
      <Markdown>
        {'Uses `useGroups`.\n\n- **one**\n- _two_\n\nSecond paragraph.'}
      </Markdown>,
    )

    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector('code')).toHaveTextContent('useGroups')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('strong')).toHaveTextContent('one')
    expect(container.querySelector('em')).toHaveTextContent('two')
  })

  it('highlights fenced code blocks with the language CodeMirror ships', async () => {
    const { container } = renderWithTheme(
      <Markdown>{'```ts\nconst answer: number = 42\n```'}</Markdown>,
    )

    await waitFor(() => {
      expect(container.querySelector('.cm-editor')).not.toBeNull()
    })
    expect(container.querySelector('.cm-content')).toHaveTextContent(
      'const answer: number = 42',
    )
    expect(container.querySelector('.cm-content [class]')).not.toBeNull()
  })

  it('opens links in a new tab', () => {
    const { getByRole } = renderWithTheme(
      <Markdown>{'See [the docs](https://example.com/docs).'}</Markdown>,
    )

    const link = getByRole('link', { name: 'the docs' })
    expect(link).toHaveAttribute('href', 'https://example.com/docs')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('shows raw HTML as text instead of rendering it', () => {
    const { container } = renderWithTheme(
      <Markdown>{'Hi <img src=x onerror="alert(1)"> <b>bold</b>'}</Markdown>,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container).toHaveTextContent('<b>bold</b>')
  })
})
