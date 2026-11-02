import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { DemoArgError, loadHunkSummaries, parseDemoArgs } from './demoArgs.js'

test('parseDemoArgs defaults to no repo or agent context', () => {
  assert.deepEqual(parseDemoArgs([]), {
    repo: null,
    title: null,
    summary: null,
    mcp: false,
    hunkSummaries: null,
  })
})

test('parseDemoArgs accepts a repo path and title/summary flags', () => {
  assert.deepEqual(
    parseDemoArgs([
      '/tmp/repo',
      '--title',
      'Add size variants',
      '--summary',
      'Claude added sm/md sizes.',
    ]),
    {
      repo: '/tmp/repo',
      title: 'Add size variants',
      summary: 'Claude added sm/md sizes.',
      mcp: false,
      hunkSummaries: null,
    },
  )
})

test('parseDemoArgs accepts --title= and --summary= forms', () => {
  assert.deepEqual(
    parseDemoArgs(['--title=Hello', '--summary=World', '../other']),
    {
      repo: '../other',
      title: 'Hello',
      summary: 'World',
      mcp: false,
      hunkSummaries: null,
    },
  )
})

test('parseDemoArgs accepts --mcp', () => {
  assert.equal(parseDemoArgs(['--mcp']).mcp, true)
})

test('parseDemoArgs rejects unknown flags and missing values', () => {
  assert.throws(() => parseDemoArgs(['--staged']), DemoArgError)
  assert.throws(() => parseDemoArgs(['--title']), DemoArgError)
  assert.throws(() => parseDemoArgs(['--summary=']), DemoArgError)
  assert.throws(() => parseDemoArgs(['a', 'b']), DemoArgError)
})

test('parseDemoArgs accepts --hunk-summaries <file> and --hunk-summaries=<file>', () => {
  assert.equal(
    parseDemoArgs(['--hunk-summaries', 'notes.json']).hunkSummaries,
    'notes.json',
  )
  assert.equal(
    parseDemoArgs(['--hunk-summaries=notes.json']).hunkSummaries,
    'notes.json',
  )
  assert.throws(() => parseDemoArgs(['--hunk-summaries']), DemoArgError)
})

test('loadHunkSummaries reads a JSON array of { path, hunk, summary }', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-demo-'))
  const file = path.join(dir, 'summaries.json')
  const entries = [{ path: 'a.py', hunk: 1, summary: 'Why.' }]
  await writeFile(file, JSON.stringify(entries))

  assert.deepEqual(await loadHunkSummaries(file), entries)
})

test('loadHunkSummaries gives a clear error for a missing file or bad JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-demo-'))
  await assert.rejects(
    loadHunkSummaries(path.join(dir, 'missing.json')),
    (error: unknown) =>
      error instanceof DemoArgError && /missing\.json/.test(error.message),
  )

  const bad = path.join(dir, 'bad.json')
  await writeFile(bad, '{ not json')
  await assert.rejects(
    loadHunkSummaries(bad),
    (error: unknown) =>
      error instanceof DemoArgError && /JSON/.test(error.message),
  )

  const notArray = path.join(dir, 'object.json')
  await writeFile(notArray, '{}')
  await assert.rejects(
    loadHunkSummaries(notArray),
    (error: unknown) =>
      error instanceof DemoArgError && /array/.test(error.message),
  )
})
