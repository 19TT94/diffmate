import { describe, expect, it } from 'vitest'

// Utils
import { languageFromPath } from '../language'

describe('languageFromPath', () => {
  it('maps common extensions to highlight languages', () => {
    expect(languageFromPath('src/ui/Button.tsx')).toBe('tsx')
    expect(languageFromPath('src/lib/format.ts')).toBe('typescript')
    expect(languageFromPath('scripts/run.sh')).toBe('bash')
    expect(languageFromPath('infra/main.tf')).toBe('terraform')
    expect(languageFromPath('config.yaml')).toBe('yaml')
  })

  it('detects Dockerfiles by basename', () => {
    expect(languageFromPath('Dockerfile')).toBe('dockerfile')
    expect(languageFromPath('services/api/Dockerfile.dev')).toBe('dockerfile')
  })

  it('falls back to plain text for unknown paths', () => {
    expect(languageFromPath('README')).toBe('text')
    expect(languageFromPath('notes.txt')).toBe('text')
  })
})
