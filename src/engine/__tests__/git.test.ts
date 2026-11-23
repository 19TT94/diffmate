import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

// Engine
import { findRepoRoot, readFileContent, resolveDiff } from '../git.js'

const execFileAsync = promisify(execFile)

async function makeRepo(defaultBranch = 'master'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-git-'))
  await execFileAsync('git', ['init', '-q', '-b', defaultBranch], { cwd: dir })
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

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd })
}

// A `feat` branch with one commit, not checked out anywhere.
async function makeBranch(dir: string): Promise<void> {
  await git(dir, 'switch', '-q', '-c', 'feat')
  await writeFile(path.join(dir, 'tracked.txt'), 'line one\nfeat change\n')
  await git(dir, 'commit', '-q', '-am', 'feat commit')
  await git(dir, 'switch', '-q', 'master')
}

test('resolveDiff reviews a branch in its worktree, uncommitted changes included', async () => {
  const dir = await makeRepo()
  const worktree = await mkdtemp(path.join(tmpdir(), 'diffmate-wt-'))
  try {
    await git(dir, 'worktree', 'add', '-q', '-b', 'feat', worktree)
    await writeFile(path.join(worktree, 'tracked.txt'), 'line one\ncommitted\n')
    await git(worktree, 'commit', '-q', '-am', 'feat commit')
    await writeFile(
      path.join(worktree, 'tracked.txt'),
      'line one\ncommitted\nuncommitted\n',
    )
    await writeFile(path.join(worktree, 'new.txt'), 'brand new\n')

    const result = await resolveDiff({ branch: 'feat', base: 'master' }, dir)

    const root = await findRepoRoot(worktree)
    assert.equal(result.repoRoot, root)
    assert.equal(result.scope.worktree, root)
    assert.match(result.diffText, /\+committed/)
    assert.match(result.diffText, /\+uncommitted/)
    assert.deepEqual(result.untrackedFiles, ['new.txt'])
    assert.equal(
      await readFileContent(result.repoRoot, 'tracked.txt', result.scope),
      'line one\ncommitted\nuncommitted\n',
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
    await rm(worktree, { recursive: true, force: true })
  }
})

test('resolveDiff reviews only the commits of a branch with no worktree', async () => {
  const dir = await makeRepo()
  try {
    await makeBranch(dir)
    await writeFile(path.join(dir, 'tracked.txt'), 'line one\nmaster edit\n')
    await writeFile(path.join(dir, 'stray.txt'), 'untracked\n')

    const result = await resolveDiff({ branch: 'feat', base: 'master' }, dir)

    assert.equal(result.repoRoot, await findRepoRoot(dir))
    assert.equal(result.scope.worktree, null)
    assert.match(result.diffText, /\+feat change/)
    assert.doesNotMatch(result.diffText, /master edit/)
    assert.deepEqual(result.untrackedFiles, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readFileContent reads a branch with no worktree from the branch', async () => {
  const dir = await makeRepo()
  try {
    await makeBranch(dir)
    await writeFile(path.join(dir, 'tracked.txt'), 'line one\nmaster edit\n')

    const result = await resolveDiff({ branch: 'feat', base: 'master' }, dir)

    assert.equal(
      await readFileContent(result.repoRoot, 'tracked.txt', result.scope),
      'line one\nfeat change\n',
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('resolveDiff rejects an unknown branch, and branch with staged', async () => {
  const dir = await makeRepo()
  try {
    await assert.rejects(
      () => resolveDiff({ branch: 'nope', base: 'master' }, dir),
      /Unknown branch: nope/,
    )
    await makeBranch(dir)
    await assert.rejects(
      () => resolveDiff({ branch: 'feat', staged: true }, dir),
      /Cannot combine branch and staged/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("resolveDiff defaults a branch's base to the repo's default branch", async () => {
  const dir = await makeRepo()
  const mainRepo = await makeRepo('main')
  const clone = await mkdtemp(path.join(tmpdir(), 'diffmate-clone-'))
  try {
    await makeBranch(dir)
    const fromMaster = await resolveDiff({ branch: 'feat' }, dir)
    assert.equal(fromMaster.scope.base, 'master')

    await git(mainRepo, 'branch', 'feat')
    const fromMain = await resolveDiff({ branch: 'feat' }, mainRepo)
    assert.equal(fromMain.scope.base, 'main')

    await git(clone, 'clone', '-q', dir, '.')
    await git(clone, 'branch', 'feat', 'origin/feat')
    const fromOrigin = await resolveDiff({ branch: 'feat' }, clone)
    assert.equal(fromOrigin.scope.base, 'origin/master')
    assert.match(fromOrigin.diffText, /\+feat change/)
  } finally {
    await rm(dir, { recursive: true, force: true })
    await rm(mainRepo, { recursive: true, force: true })
    await rm(clone, { recursive: true, force: true })
  }
})
