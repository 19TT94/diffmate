import { describe, expect, it } from 'vitest'

// Utils
import {
  EMPTY_LANGUAGE,
  languageExtensionFromPath,
  languageFromPath,
} from '../cmLanguage'

describe('languageFromPath', () => {
  it('maps common extensions to CodeMirror languages', () => {
    expect(languageFromPath('src/ui/Button.tsx')).toBe('tsx')
    expect(languageFromPath('src/lib/format.ts')).toBe('typescript')
    expect(languageFromPath('scripts/run.sh')).toBe('bash')
    expect(languageFromPath('config.yaml')).toBe('yaml')
  })

  it('detects Dockerfiles by basename', () => {
    expect(languageFromPath('Dockerfile')).toBe('dockerfile')
    expect(languageFromPath('services/api/Dockerfile.dev')).toBe('dockerfile')
  })

  it('falls back to plain text for unknown paths', () => {
    expect(languageFromPath('README')).toBe('text')
    expect(languageFromPath('notes.txt')).toBe('text')
    // Terraform had a Shiki grammar; the CodeMirror set has no tf mode, so
    // it falls back to text rather than guessing wrong.
    expect(languageFromPath('infra/main.tf')).toBe('text')
  })
})

describe('languageExtensionFromPath', () => {
  it('resolves a real extension for known languages and empty for text', () => {
    expect(languageExtensionFromPath('a.ts')).toBeTruthy()
    expect(languageExtensionFromPath('notes.txt')).toBe(EMPTY_LANGUAGE)
  })
})
