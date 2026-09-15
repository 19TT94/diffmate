// Maps a review file path to a Shiki language id. Unknown extensions fall
// back to plain text (no grammar). Keep in sync with the langs loaded in
// `lib/highlight.ts`.

export const HIGHLIGHT_LANGUAGES = [
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
  'terraform',
  'toml',
  'tsx',
  'typescript',
  'vue',
  'yaml',
] as const

export type HighlightLanguage = (typeof HIGHLIGHT_LANGUAGES)[number] | 'text'

const EXT_TO_LANG: Record<string, HighlightLanguage> = {
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
  tf: 'terraform',
  tfvars: 'terraform',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  vue: 'vue',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
}

export function languageFromPath(path: string): HighlightLanguage {
  const base = path.split('/').pop() ?? path
  if (/^Dockerfile(\.|$)/i.test(base) || base === 'Dockerfile') {
    return 'dockerfile'
  }
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return 'text'
  const ext = base.slice(dot + 1).toLowerCase()
  return EXT_TO_LANG[ext] ?? 'text'
}
