import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const MAX_BUFFER = 64 * 1024 * 1024

export interface DiffScope {
  staged?: boolean
  base?: string
}

export interface RawDiff {
  repoRoot: string
  diffText: string
  untrackedFiles: string[]
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

export async function resolveDiff(
  scope: DiffScope = {},
  cwd: string = process.cwd(),
): Promise<RawDiff> {
  if (scope.staged && scope.base) {
    throw new Error('Cannot combine --staged and --base')
  }

  const repoRoot = await findRepoRoot(cwd)

  const args = ['--no-pager', 'diff', '--no-color', '-U3']
  if (scope.base) {
    args.push(`${scope.base}...`)
  } else if (scope.staged) {
    args.push('--cached')
  } else {
    args.push('HEAD')
  }

  const diffText = await runGit(repoRoot, args)

  let untrackedFiles: string[] = []
  if (!scope.staged && !scope.base) {
    const listing = await runGit(repoRoot, [
      'ls-files',
      '--others',
      '--exclude-standard',
    ])
    untrackedFiles = listing
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  return { repoRoot, diffText, untrackedFiles }
}

export async function readUntrackedFile(
  repoRoot: string,
  relativePath: string,
): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}
