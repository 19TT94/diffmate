import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DemoArgError, parseDemoArgs } from './demoArgs.js'

test('parseDemoArgs defaults to no repo or agent context', () => {
  assert.deepEqual(parseDemoArgs([]), {
    repo: null,
    title: null,
    summary: null,
    mcp: false,
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
