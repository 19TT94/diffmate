import assert from 'node:assert/strict'
import { test } from 'node:test'

// CLI
import { CliArgError, parseArgs } from '../args.js'

test('parseArgs defaults to review in the current directory', () => {
  const args = parseArgs([])
  assert.equal(args.subcommand, 'review')
  assert.equal(args.dir, process.cwd())
  assert.deepEqual(args.scope, {})
  assert.equal(args.json, false)
  assert.equal(args.help, false)
})

test('parseArgs --staged sets a staged scope', () => {
  assert.deepEqual(parseArgs(['--staged']).scope, { staged: true })
})

test('parseArgs --base takes the next argument as the ref', () => {
  assert.deepEqual(parseArgs(['--base', 'main']).scope, { base: 'main' })
})

test('parseArgs --base=ref uses the inline form', () => {
  assert.deepEqual(parseArgs(['--base=origin/main']).scope, {
    base: 'origin/main',
  })
})

test('parseArgs --json enables JSON output', () => {
  assert.equal(parseArgs(['--json']).json, true)
})

test('parseArgs rejects combining --staged and --base', () => {
  assert.throws(() => parseArgs(['--staged', '--base', 'main']), CliArgError)
  assert.throws(() => parseArgs(['--base', 'main', '--staged']), CliArgError)
})

test('parseArgs rejects an unknown flag', () => {
  assert.throws(() => parseArgs(['--bogus']), /Unknown flag: --bogus/)
})

test('parseArgs rejects a missing --base value', () => {
  assert.throws(() => parseArgs(['--base']), /Missing value for --base/)
  assert.throws(() => parseArgs(['--base=']), /Missing value for --base/)
  assert.throws(() => parseArgs(['--base', '--json']), /Missing value/)
})

test('parseArgs accepts the review subcommand and a dir positional', () => {
  const args = parseArgs(['review', '/tmp/example'])
  assert.equal(args.subcommand, 'review')
  assert.equal(args.dir, '/tmp/example')
})

test('parseArgs treats a lone dir positional as the review dir', () => {
  assert.equal(parseArgs(['/tmp/example']).dir, '/tmp/example')
})

test('parseArgs accepts future mcp and install subcommands', () => {
  assert.equal(parseArgs(['mcp']).subcommand, 'mcp')
  assert.equal(parseArgs(['install']).subcommand, 'install')
})

test('parseArgs rejects an unexpected extra positional', () => {
  assert.throws(
    () => parseArgs(['review', '/tmp/example', 'extra']),
    /Unexpected/,
  )
  assert.throws(() => parseArgs(['/tmp/example', 'extra']), /Unexpected/)
})

test('parseArgs -h and --help set help', () => {
  assert.equal(parseArgs(['-h']).help, true)
  assert.equal(parseArgs(['--help']).help, true)
})

test('parseArgs -- ends flag parsing', () => {
  assert.deepEqual(parseArgs(['--', '--staged']).scope, {})
  assert.equal(parseArgs(['--', '--staged']).dir, '--staged')
})
