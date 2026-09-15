import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { StreamLanguage } from '@codemirror/language'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import type { Extension } from '@codemirror/state'

// Maps a review file path to CodeMirror language extensions. Unknown
// extensions fall back to plain text (no grammar). Keep in sync with the
// langs wired into `lib/cmLanguage.ts`.
export const CM_LANGUAGES = [
  'bash',
  'css',
  'dockerfile',
  'go',
  'html',
  'javascript',
  'json',
  'lua',
  'markdown',
  'python',
  'sql',
  'toml',
  'tsx',
  'typescript',
  'yaml',
] as const

export type CodeMirrorLanguage = (typeof CM_LANGUAGES)[number] | 'text'

const EXT_TO_LANG: Record<string, CodeMirrorLanguage> = {
  bash: 'bash',
  css: 'css',
  go: 'go',
  html: 'html',
  htm: 'html',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  json: 'json',
  jsonc: 'json',
  lua: 'lua',
  md: 'markdown',
  mdx: 'markdown',
  py: 'python',
  sh: 'bash',
  sql: 'sql',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
}

const LANGUAGE_EXTENSIONS: Record<
  Exclude<CodeMirrorLanguage, 'text'>,
  Extension
> = {
  bash: StreamLanguage.define(shell),
  css: css(),
  dockerfile: StreamLanguage.define(dockerFile),
  go: go(),
  html: html(),
  javascript: javascript({ typescript: false, jsx: false }),
  json: json(),
  lua: StreamLanguage.define(lua),
  markdown: markdown(),
  python: python(),
  sql: sql(),
  toml: StreamLanguage.define(toml),
  tsx: javascript({ jsx: true, typescript: true }),
  typescript: javascript({ jsx: false, typescript: true }),
  yaml: StreamLanguage.define(yaml),
}

export function languageFromPath(path: string): CodeMirrorLanguage {
  const base = path.split('/').pop() ?? path
  if (/^Dockerfile(\.|$)/i.test(base) || base === 'Dockerfile') {
    return 'dockerfile'
  }
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return 'text'
  const ext = base.slice(dot + 1).toLowerCase()
  return EXT_TO_LANG[ext] ?? 'text'
}

export function languageExtensionFromPath(path: string): Extension {
  const language = languageFromPath(path)
  return language === 'text' ? EMPTY_LANGUAGE : LANGUAGE_EXTENSIONS[language]
}

export const EMPTY_LANGUAGE: Extension = []
