import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import styled from 'styled-components'

// CodeMirror
import { EditorState, Prec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

// Utils
import { languageExtensionFromPath } from '../lib/cmLanguage'
import { cmHighlightTheme } from '../lib/cmTheme'

// Fence names that aren't file extensions; anything else is tried as one.
const FENCE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  shell: 'sh',
  yml: 'yaml',
}

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
}

// Raw HTML in agent text is turned into plain text before rendering, so a
// tag shows as written and is never parsed into the page.
function remarkHtmlAsText() {
  function walk(node: MdNode): void {
    if (node.type === 'html') node.type = 'text'
    node.children?.forEach(walk)
  }
  return walk
}

const REMARK_PLUGINS = [remarkHtmlAsText]

interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: { className?: unknown }
  children?: HastNode[]
}

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

function fenceLanguage(code: HastNode): string | null {
  const classes = code.properties?.className
  if (!Array.isArray(classes)) return null
  const match = classes.map(String).find((name) => name.startsWith('language-'))
  return match ? match.slice('language-'.length).toLowerCase() : null
}

const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  pre: ({ node, children }) => {
    const code = (node as HastNode | undefined)?.children?.[0]
    if (code?.type !== 'element' || code.tagName !== 'code') {
      return <pre>{children}</pre>
    }
    return (
      <CodeBlock
        language={fenceLanguage(code)}
        code={textOf(code).replace(/\n$/, '')}
      />
    )
  },
}

interface MarkdownProps {
  children: string
}

// Agent-written text (answers, summaries, explanations): a safe Markdown
// subset with code highlighted the same way as the diff.
export function Markdown({ children }: MarkdownProps) {
  return (
    <Prose>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </Prose>
  )
}

function CodeBlock({
  language,
  code,
}: {
  language: string | null
  code: string
}): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hostRef.current) return
    const extension = language ? (FENCE_EXTENSIONS[language] ?? language) : ''
    const view = new EditorView({
      doc: code,
      parent: hostRef.current,
      extensions: [
        cmHighlightTheme(),
        languageExtensionFromPath(`snippet.${extension}`),
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        Prec.highest(
          EditorView.theme({
            '&': { height: 'auto' },
            '.cm-scroller': { overflow: 'visible' },
          }),
        ),
      ],
    })
    return () => view.destroy()
  }, [language, code])

  return <CodeHost ref={hostRef} />
}

// Style Overrides
const Prose = styled.div`
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  line-height: 1.5;
  overflow-wrap: anywhere;

  & > :first-child {
    margin-top: 0;
  }

  & > :last-child {
    margin-bottom: 0;
  }

  p,
  ul,
  ol,
  pre {
    margin: ${({ theme }) => theme.spacing[2]} 0;
  }

  ul,
  ol {
    padding-left: ${({ theme }) => theme.spacing[5]};
  }

  code {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.92em;
    padding: 0 3px;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.background};
  }

  a {
    color: ${({ theme }) => theme.colors.primary};
  }
`

const CodeHost = styled.div`
  margin: ${({ theme }) => theme.spacing[2]} 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  overflow: hidden;
`
