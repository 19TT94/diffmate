import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

// Engine
import { findRepoRoot, resolveDiff } from './git.js'

const execFileAsync = promisify(execFile)

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-git-'))
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

test('resolveDiff reports working-tree changes plus untracked files', async () => {
  const dir = await makeRepo()
  try {
    await writeFile(
      path.join(dir, 'tracked.txt'),
      'line one\nline two changed\n',
    )
    await writeFile(path.join(dir, 'new.txt'), 'brand new\n')

    const result = await resolveDiff({}, dir)

    assert.match(result.diffText, /tracked\.txt/)
    assert.match(result.diffText, /-line two/)
    assert.match(result.diffText, /\+line two changed/)
    assert.deepEqual(result.untrackedFiles, ['new.txt'])
    assert.equal(result.repoRoot, await findRepoRoot(dir))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('resolveDiff --staged only reports staged changes', async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'tracked.txt'), 'line one\nstaged change\n')
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: dir })
    await writeFile(path.join(dir, 'unstaged.txt'), 'not staged\n')

    const result = await resolveDiff({ staged: true }, dir)

    assert.match(result.diffText, /staged change/)
    assert.deepEqual(result.untrackedFiles, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('resolveDiff --base diffs against a ref via merge-base', async () => {
  const dir = await makeRepo()
  try {
    await execFileAsync('git', ['checkout', '-q', '-b', 'feature'], {
      cwd: dir,
    })
    await writeFile(path.join(dir, 'tracked.txt'), 'line one\nfeature change\n')
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: dir })
    await execFileAsync('git', ['commit', '-q', '-m', 'feature commit'], {
      cwd: dir,
    })

    const result = await resolveDiff({ base: 'master' }, dir)

    assert.match(result.diffText, /feature change/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('resolveDiff rejects combining --staged and --base', async () => {
  const dir = await makeRepo()
  try {
    await assert.rejects(() =>
      resolveDiff({ staged: true, base: 'master' }, dir),
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('findRepoRoot rejects a non-git directory', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-nogit-'))
  try {
    await assert.rejects(() => findRepoRoot(dir))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
