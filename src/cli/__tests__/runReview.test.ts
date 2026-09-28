import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

// CLI
import { parseArgs } from '../args.js'
import { runReview } from '../index.js'
import type { ReviewDeps } from '../index.js'

const execFileAsync = promisify(execFile)

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-cli-'))
  await execFileAsync('git', ['init', '-q', '-b', 'master'], { cwd: dir })
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], {
    cwd: dir,
  })
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  await writeFile(path.join(dir, 'tracked.txt'), 'line one\nline two\n')
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd: dir })
  await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: dir })
  return dir
}

async function makeUi(): Promise<string> {
  const uiDir = await mkdtemp(path.join(tmpdir(), 'diffmate-ui-'))
  await writeFile(path.join(uiDir, 'index.html'), '<!doctype html>')
  return uiDir
}

interface Captured {
  deps: ReviewDeps
  stdout: string
  stderr: string
  opened: string[]
}

function captureDeps(uiDir: string): Captured {
  const captured = {
    stdout: '',
    stderr: '',
    opened: [] as string[],
  }
  const deps: ReviewDeps = {
    stdout: (text) => (captured.stdout += text),
    stderr: (text) => (captured.stderr += text),
    openBrowser: (url) => captured.opened.push(url),
    uiDir,
  }
  // A mutable box the deps close over, so tests read live output.
  return {
    deps,
    get stdout() {
      return captured.stdout
    },
    get stderr() {
      return captured.stderr
    },
    get opened() {
      return captured.opened
    },
  }
}

async function waitForUrl(
  captured: Captured,
  timeoutMs = 5000,
): Promise<string> {
  const start = Date.now()
  for (;;) {
    const match = captured.stdout.match(/Open: (http:\/\/[^\n]+)/)
    if (match) return match[1]!
    if (Date.now() - start > timeoutMs) {
      throw new Error('timed out waiting for the review URL')
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function submit(serverUrl: string): Promise<void> {
  const url = new URL(serverUrl)
  const token = url.searchParams.get('token') ?? ''
  const response = await fetch(`${url.origin}/api/submit?token=${token}`, {
    method: 'POST',
  })
  assert.equal(response.status, 200)
}

test('runReview serves a review and prints a markdown report on submit', async () => {
  const dir = await makeRepo()
  const uiDir = await makeUi()
  try {
    await writeFile(
      path.join(dir, 'tracked.txt'),
      'line one\nline two changed\n',
    )
    const captured = captureDeps(uiDir)

    const review = runReview(parseArgs([dir]), captured.deps)
    const serverUrl = await waitForUrl(captured)
    await submit(serverUrl)

    const code = await review
    assert.equal(code, 0)
    assert.deepEqual(captured.opened, [serverUrl])
    assert.match(captured.stdout, /Resolving diff in /)
    assert.match(captured.stdout, /Reviewing: /)
    assert.ok(captured.stdout.includes('# diffmate review'))
    assert.ok(captured.stdout.includes('## Summary'))
  } finally {
    await rm(dir, { recursive: true, force: true })
    await rm(uiDir, { recursive: true, force: true })
  }
})

test('runReview --json prints a JSON report on submit', async () => {
  const dir = await makeRepo()
  const uiDir = await makeUi()
  try {
    await writeFile(
      path.join(dir, 'tracked.txt'),
      'line one\nline two changed\n',
    )
    const captured = captureDeps(uiDir)

    const review = runReview(parseArgs(['--json', dir]), captured.deps)
    const serverUrl = await waitForUrl(captured)
    await submit(serverUrl)

    const code = await review
    assert.equal(code, 0)
    const reportText = captured.stdout.slice(captured.stdout.indexOf('Open: '))
    const report = JSON.parse(reportText.slice(reportText.indexOf('\n') + 1))
    assert.equal(report.counts.total, 1)
    assert.equal(report.counts.pending, 1)
    assert.equal(report.counts.approved, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
    await rm(uiDir, { recursive: true, force: true })
  }
})

test('runReview reports no changes and exits 0 without a diff', async () => {
  const dir = await makeRepo()
  try {
    const captured = captureDeps(dir)
    const code = await runReview(parseArgs([dir]), captured.deps)
    assert.equal(code, 0)
    assert.ok(captured.stdout.includes('No changes to review in '))
    assert.deepEqual(captured.opened, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('runReview --help prints usage and exits 0 without touching git', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-help-'))
  try {
    const captured = captureDeps(dir)
    const code = await runReview(parseArgs(['--help']), captured.deps)
    assert.equal(code, 0)
    assert.ok(captured.stdout.includes('Usage: diffmate'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('runReview fails on a non-repo directory', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-nogit-'))
  try {
    const captured = captureDeps(dir)
    await assert.rejects(
      () => runReview(parseArgs([dir]), captured.deps),
      /Not a git/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('runReview requires the UI build to exist', async () => {
  const dir = await makeRepo()
  try {
    await writeFile(
      path.join(dir, 'tracked.txt'),
      'line one\nline two changed\n',
    )
    const captured = captureDeps(path.join(dir, 'no-such-ui'))
    const code = await runReview(parseArgs([dir]), captured.deps)
    assert.equal(code, 1)
    assert.ok(captured.stderr.includes('run `npm run build:ui` first'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
