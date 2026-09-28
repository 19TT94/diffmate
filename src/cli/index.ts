import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { once } from 'node:events'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Engine
import { readUntrackedFile, resolveDiff } from '../engine/git.js'
import { buildJson, buildMarkdown } from '../engine/output.js'
import { parseDiff, parseUntrackedFile } from '../engine/parseDiff.js'
import { ReviewSession } from '../engine/session.js'
import { startReviewServer } from '../engine/httpServer.js'

// CLI
import { CliArgError, parseArgs, USAGE } from './args.js'

// MCP
import { runMcpServer } from '../mcp/server.js'

// Types
import type { CliArgs } from './args.js'

export interface ReviewDeps {
  stdout: (text: string) => void
  stderr: (text: string) => void
  openBrowser: (url: string) => void
  uiDir?: string
}

export function defaultUiDir(): string {
  // The CLI module lives at <root>/src/cli/index.ts (or <root>/dist/cli/
  // index.js after `npm run build`), so the package root is two levels up
  // either way.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  return path.join(moduleDir, '..', '..', 'src', 'ui', 'dist')
}

// One-shot review flow (phase 1): resolve the diff, serve it over a local
// HTTP server, wait for the browser's submit, and print the structured
// report. Returns the process exit code.
export async function runReview(
  args: CliArgs,
  deps: ReviewDeps,
): Promise<number> {
  if (args.help) {
    deps.stdout(USAGE)
    return 0
  }
  if (args.subcommand !== 'review') {
    deps.stderr(
      `diffmate: ${args.subcommand} is not implemented yet (phase 2).\n`,
    )
    return 1
  }

  deps.stdout(`Resolving diff in ${args.dir}…\n`)
  const raw = await resolveDiff(args.scope, args.dir)

  const files = parseDiff(raw.diffText)
  for (const relPath of raw.untrackedFiles) {
    const content = await readUntrackedFile(raw.repoRoot, relPath)
    files.push(parseUntrackedFile(relPath, content))
  }

  const hunkCount = files.reduce((total, file) => total + file.hunks.length, 0)
  if (hunkCount === 0) {
    deps.stdout(`No changes to review in ${raw.repoRoot}.\n`)
    return 0
  }

  const uiDir = deps.uiDir ?? defaultUiDir()
  if (!existsSync(path.join(uiDir, 'index.html'))) {
    deps.stderr('diffmate: UI build missing — run `npm run build:ui` first.\n')
    return 1
  }

  const session = new ReviewSession('cli', args.scope, files)
  const server = await startReviewServer(session, uiDir, raw.repoRoot)

  deps.stdout(`Reviewing: ${raw.repoRoot}\n`)
  deps.stdout(`Open: ${server.url}\n`)
  deps.openBrowser(server.url)

  await once(session.bus, 'review_complete')

  const report = args.json ? buildJson(session) : buildMarkdown(session)
  await server.close()
  deps.stdout(report)
  return 0
}

async function run(argv: string[]): Promise<number> {
  let args: CliArgs
  try {
    args = parseArgs(argv)
  } catch (error) {
    if (error instanceof CliArgError) {
      process.stderr.write(`diffmate: ${error.message}\n\n${USAGE}`)
      return 2
    }
    throw error
  }

  if (args.subcommand === 'mcp') {
    try {
      await runMcpServer()
      return 0
    } catch (error) {
      process.stderr.write(
        `diffmate: ${error instanceof Error ? error.message : String(error)}\n`,
      )
      return 1
    }
  }

  try {
    return await runReview(args, {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
      openBrowser: openBrowser,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`diffmate: ${message}\n`)
    return 1
  }
}

export function openBrowser(url: string): void {
  const opener =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open'
  // Best-effort only — the URL is printed regardless, so a missing GUI or
  // opener binary doesn't block the review.
  execFile(opener, [url], () => {})
}

export function main(argv: string[]): void {
  void run(argv).then((code) => {
    process.exitCode = code
  })
}
