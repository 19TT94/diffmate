import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

// User preferences for the review UI, kept outside any repo so they survive
// across reviews (each review serves on a new port, so the browser's own
// storage doesn't). The only file a review writes.
export interface Settings {
  colors?: SettingsColors
  fileListWidth?: number
  conversationWidth?: number
}

export interface SettingsColors {
  agent?: string
  primary?: string
  // 0 (subtlest) to 1 (strongest); the hue stays green/red in the UI.
  diffAddIntensity?: number
  diffDelIntensity?: number
}

// A PATCH body: same shape, but null removes a field.
export interface SettingsPatch {
  colors?: { [K in keyof SettingsColors]?: SettingsColors[K] | null } | null
  fileListWidth?: number | null
  conversationWidth?: number | null
}

// Panel widths in px; all validated and merged the same way.
const WIDTH_FIELDS = ['fileListWidth', 'conversationWidth'] as const

export class SettingsError extends Error {}

type Validator = (value: unknown) => boolean

const isHexColor: Validator = (value) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const isIntensity: Validator = (value) =>
  typeof value === 'number' && value >= 0 && value <= 1
function isWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

const COLOR_FIELDS: Record<keyof SettingsColors, Validator> = {
  agent: isHexColor,
  primary: isHexColor,
  diffAddIntensity: isIntensity,
  diffDelIntensity: isIntensity,
}

export function settingsFilePath(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  const configHome = env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(configHome, 'diffmate', 'settings.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Lenient: a missing, corrupt, or hand-edited file must never break a
// review, so anything invalid is dropped rather than reported.
export async function readSettings(file: string): Promise<Settings> {
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(raw)) return {}

  const settings: Settings = {}
  if (isRecord(raw.colors)) {
    const colors: Record<string, unknown> = {}
    for (const [key, isValid] of Object.entries(COLOR_FIELDS)) {
      if (isValid(raw.colors[key])) colors[key] = raw.colors[key]
    }
    if (Object.keys(colors).length > 0) {
      // Every key was just checked against COLOR_FIELDS.
      settings.colors = colors as SettingsColors
    }
  }
  for (const key of WIDTH_FIELDS) {
    const value = raw[key]
    if (isWidth(value)) settings[key] = value
  }
  return settings
}

// Strict: a PATCH from the UI with anything unknown or invalid is a bug,
// so it's rejected whole instead of half-applied.
export function parseSettingsPatch(raw: unknown): SettingsPatch {
  if (!isRecord(raw)) throw new SettingsError('settings must be an object')
  for (const key of Object.keys(raw)) {
    if (
      key !== 'colors' &&
      !(WIDTH_FIELDS as readonly string[]).includes(key)
    ) {
      throw new SettingsError(`unknown setting: ${key}`)
    }
  }
  if (raw.colors !== undefined && raw.colors !== null) {
    if (!isRecord(raw.colors))
      throw new SettingsError('colors must be an object')
    for (const [key, value] of Object.entries(raw.colors)) {
      // An unknown key indexes to undefined, which is checked right below.
      const isValid = COLOR_FIELDS[key as keyof SettingsColors]
      if (!isValid) throw new SettingsError(`unknown color: ${key}`)
      if (value !== null && !isValid(value)) {
        throw new SettingsError(`invalid value for colors.${key}`)
      }
    }
  }
  for (const key of WIDTH_FIELDS) {
    const value = raw[key]
    if (value !== undefined && value !== null && !isWidth(value)) {
      throw new SettingsError(`invalid value for ${key}`)
    }
  }
  // Every key and value was validated above.
  return raw as SettingsPatch
}

export function mergeSettings(
  current: Settings,
  patch: SettingsPatch,
): Settings {
  const next: Settings = { ...current }

  if (patch.colors === null) {
    delete next.colors
  } else if (patch.colors) {
    const colors: Record<string, unknown> = { ...current.colors }
    for (const [key, value] of Object.entries(patch.colors)) {
      if (value === null) delete colors[key]
      else if (value !== undefined) colors[key] = value
    }
    if (Object.keys(colors).length > 0) {
      // Merged from valid settings and a validated patch.
      next.colors = colors as SettingsColors
    } else {
      delete next.colors
    }
  }

  for (const key of WIDTH_FIELDS) {
    const value = patch[key]
    if (value === null) delete next[key]
    else if (value !== undefined) next[key] = value
  }
  return next
}

// Writes queue per file: each update re-reads the file only after the
// previous one landed, so overlapping PATCHes can't drop each other's fields.
const writeQueues = new Map<string, Promise<unknown>>()

export function updateSettings(
  file: string,
  patch: SettingsPatch,
): Promise<Settings> {
  const previous = writeQueues.get(file) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(() => writeSettings(file, patch))
  writeQueues.set(file, next)
  return next
}

async function writeSettings(
  file: string,
  patch: SettingsPatch,
): Promise<Settings> {
  const next = mergeSettings(await readSettings(file), patch)
  await mkdir(path.dirname(file), { recursive: true })
  // Write-then-rename so a crash mid-write can't leave a truncated file.
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`)
  await rename(temp, file)
  return next
}
