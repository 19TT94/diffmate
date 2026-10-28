import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

// Engine
import { readSettings, settingsFilePath, updateSettings } from '../settings.js'

async function tempFile(contents: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-settings-'))
  const file = path.join(dir, 'settings.json')
  await writeFile(file, contents)
  return file
}

test('readSettings returns {} for JSON that does not parse', async () => {
  assert.deepEqual(await readSettings(await tempFile('{ not json')), {})
})

test('readSettings keeps only the valid fields of a hand-edited file', async () => {
  const file = await tempFile(
    JSON.stringify({
      colors: {
        agent: '#f06543',
        primary: 'blue',
        diffAddIntensity: 0.4,
        diffDelIntensity: 7,
        mystery: '#000000',
      },
      fileListWidth: -5,
      extra: true,
    }),
  )

  assert.deepEqual(await readSettings(file), {
    colors: { agent: '#f06543', diffAddIntensity: 0.4 },
  })
})

test('readSettings returns {} when the top level is not an object', async () => {
  assert.deepEqual(await readSettings(await tempFile('[1, 2]')), {})
})

test('settingsFilePath uses XDG_CONFIG_HOME when set', () => {
  assert.equal(
    settingsFilePath({ XDG_CONFIG_HOME: '/xdg' }, '/home/me'),
    path.join('/xdg', 'diffmate', 'settings.json'),
  )
})

test('settingsFilePath falls back to ~/.config', () => {
  assert.equal(
    settingsFilePath({}, '/home/me'),
    path.join('/home/me', '.config', 'diffmate', 'settings.json'),
  )
  assert.equal(
    settingsFilePath({ XDG_CONFIG_HOME: '' }, '/home/me'),
    path.join('/home/me', '.config', 'diffmate', 'settings.json'),
  )
})

test('concurrent updateSettings calls keep every field', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-settings-'))
  const file = path.join(dir, 'diffmate', 'settings.json')

  await Promise.all([
    updateSettings(file, { fileListWidth: 320 }),
    updateSettings(file, { colors: { agent: '#f06543' } }),
    updateSettings(file, { colors: { primary: '#0969da' } }),
  ])

  assert.deepEqual(await readSettings(file), {
    fileListWidth: 320,
    colors: { agent: '#f06543', primary: '#0969da' },
  })
})

test('readSettings keeps a valid conversationWidth and drops a bad one', async () => {
  assert.deepEqual(
    await readSettings(
      await tempFile(JSON.stringify({ conversationWidth: 400 })),
    ),
    { conversationWidth: 400 },
  )
  assert.deepEqual(
    await readSettings(
      await tempFile(JSON.stringify({ conversationWidth: 'wide' })),
    ),
    {},
  )
})
