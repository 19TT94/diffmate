import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const MAX_BUFFER = 64 * 1024 * 1024
const MAX_FILE_CONTENT_BYTES = 2 * 1024 * 1024

export interface DiffScope {
  staged?: boolean
  base?: string
  // Reviews this branch against `base` (the default branch if unset).
  branch?: string
  // Set by resolveDiff for a branch review: the worktree the branch is
  // checked out in, or null when it isn't, so files come from the branch
  // and can't be edited.
  worktree?: string | null
}

export interface RawDiff {
  repoRoot: string
  diffText: string
  untrackedFiles: string[]
  // The scope as resolved: a branch review's base and worktree filled in.
  scope: DiffScope
}

async function runGit(repoRoot: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoRoot,
      maxBuffer: MAX_BUFFER,
    })
    return stdout
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`git ${args.join(' ')} failed: ${message}`)
  }
}

export async function findRepoRoot(
  cwd: string = process.cwd(),
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--show-toplevel'],
      { cwd },
    )
    return stdout.trim()
  } catch {
    throw new Error(`Not a git repository: ${cwd}`)
  }
}

async function gitSucceeds(repoRoot: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync('git', args, { cwd: repoRoot })
    return true
  } catch {
    return false
  }
}

// origin's default branch when there is a remote, else a local main or
// master.
async function defaultBranch(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
      { cwd: repoRoot },
    )
    return stdout.trim()
  } catch {
    for (const name of ['main', 'master']) {
      if (
        await gitSucceeds(repoRoot, [
          'rev-parse',
          '--verify',
          '--quiet',
          `refs/heads/${name}`,
        ])
      ) {
        return name
      }
    }
    throw new Error('No base given and no main or master branch to default to')
  }
}

// The worktree `branch` is checked out in, if any.
async function findWorktree(
  repoRoot: string,
  branch: string,
): Promise<string | null> {
  const listing = await runGit(repoRoot, ['worktree', 'list', '--porcelain'])
  let worktree: string | null = null
  for (const line of listing.split('\n')) {
    if (line.startsWith('worktree ')) worktree = line.slice('worktree '.length)
    else if (line === `branch refs/heads/${branch}`) return worktree
  }
  return null
}

// A branch checked out in a worktree is reviewed there, uncommitted changes
// included; any other branch is reviewed as its committed `base...branch`
// diff. Either way, nothing is checked out or changed.
async function resolveBranchDiff(
  scope: DiffScope & { branch: string },
  repoRoot: string,
): Promise<RawDiff> {
  if (scope.staged) {
    throw new Error('Cannot combine branch and staged')
  }
  const { branch } = scope
  if (
    !(await gitSucceeds(repoRoot, [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${branch}`,
    ]))
  ) {
    throw new Error(`Unknown branch: ${branch}`)
  }
  const base = scope.base ?? (await defaultBranch(repoRoot))
  const worktree = await findWorktree(repoRoot, branch)
  const resolved: DiffScope = { branch, base, worktree }

  if (worktree) {
    const raw = await resolveDiff({ base }, worktree)
    return {
      ...raw,
      untrackedFiles: await listUntracked(raw.repoRoot),
      scope: resolved,
    }
  }
  const diffText = await runGit(repoRoot, [...DIFF_ARGS, `${base}...${branch}`])
  return { repoRoot, diffText, untrackedFiles: [], scope: resolved }
}

async function listUntracked(repoRoot: string): Promise<string[]> {
  const listing = await runGit(repoRoot, [
    'ls-files',
    '--others',
    '--exclude-standard',
  ])
  return listing
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const DIFF_ARGS = ['--no-pager', 'diff', '--no-color', '-U3']

export async function resolveDiff(
  scope: DiffScope = {},
  cwd: string = process.cwd(),
): Promise<RawDiff> {
  if (scope.staged && scope.base) {
    throw new Error('Cannot combine --staged and --base')
  }

  const repoRoot = await findRepoRoot(cwd)
  if (scope.branch !== undefined) {
    return resolveBranchDiff({ ...scope, branch: scope.branch }, repoRoot)
  }

  const args = [...DIFF_ARGS]
  if (scope.base) {
    // Merge-base against the working tree, so uncommitted edits count too
    // (`<base>...` alone would stop at HEAD).
    args.push('--merge-base', scope.base)
  } else if (scope.staged) {
    args.push('--cached')
  } else {
    args.push('HEAD')
  }

  const diffText = await runGit(repoRoot, args)

  const untrackedFiles =
    scope.staged || scope.base ? [] : await listUntracked(repoRoot)

  return { repoRoot, diffText, untrackedFiles, scope }
}

export async function readUntrackedFile(
  repoRoot: string,
  relativePath: string,
): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

// Reads a file's full current content for the full-file review pane — the
// "new" side of whichever scope is being reviewed. `--base` still resolves
// against the working tree (resolveDiff diffs the merge-base against it),
// so only `--staged` (the index blob) and a branch with no worktree (the
// branch's blob) need a different source than a plain disk read.
export async function readFileContent(
  repoRoot: string,
  relativePath: string,
  scope: DiffScope,
): Promise<string> {
  // A branch with no worktree has no files on disk to read.
  const blob = scope.staged
    ? `:${relativePath}`
    : scope.branch !== undefined && !scope.worktree
      ? `${scope.branch}:${relativePath}`
      : null
  if (blob) {
    const content = await runGit(repoRoot, ['show', blob])
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_CONTENT_BYTES) {
      throw new Error(`File too large to preview: ${relativePath}`)
    }
    return content
  }

  const absPath = path.join(repoRoot, relativePath)
  const stats = await stat(absPath).catch(() => null)
  if (!stats) {
    throw new Error(`Unknown file: ${relativePath}`)
  }
  if (stats.size > MAX_FILE_CONTENT_BYTES) {
    throw new Error(`File too large to preview: ${relativePath}`)
  }
  return readFile(absPath, 'utf8')
}
