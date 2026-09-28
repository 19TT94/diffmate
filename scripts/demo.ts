import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Engine
import { readUntrackedFile, resolveDiff } from '../src/engine/git.js'
import { buildMarkdown } from '../src/engine/output.js'
import { parseDiff, parseUntrackedFile } from '../src/engine/parseDiff.js'
import { ReviewSession } from '../src/engine/session.js'
import { startReviewServer } from '../src/engine/httpServer.js'

// Demo
import {
  DEMO_USAGE,
  DemoArgError,
  parseDemoArgs,
  type DemoArgs,
} from './demoArgs.js'

// Stand-in for the real `diffmate review` CLI: wires the engine pieces
// together end-to-end against a real repo so the UI can be tried before
// (or alongside) the MCP path. Optional --title/--summary simulate the
// agent context MCP's start_review normally supplies.

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const uiDir = path.join(projectRoot, 'src/ui/dist')

if (!existsSync(path.join(uiDir, 'index.html'))) {
  console.error('src/ui/dist not built — run `npm run build:ui` first.')
  process.exit(1)
}

let demoArgs: DemoArgs
try {
  demoArgs = parseDemoArgs(process.argv.slice(2))
} catch (error) {
  if (error instanceof DemoArgError) {
    console.error(`${error.message}\n\n${DEMO_USAGE}`)
    process.exit(2)
  }
  throw error
}

const targetRepo = path.resolve(demoArgs.repo ?? process.cwd())
const hasAgentContext = demoArgs.title !== null || demoArgs.summary !== null

const raw = await resolveDiff({}, targetRepo)
const files = parseDiff(raw.diffText)
for (const relPath of raw.untrackedFiles) {
  const content = await readUntrackedFile(raw.repoRoot, relPath)
  files.push(parseUntrackedFile(relPath, content))
}

// mode 'mcp' so AgentContext renders when title/summary are supplied —
// same banner path as a real start_review session.
const session = new ReviewSession(hasAgentContext ? 'mcp' : 'cli', {}, files, {
  title: demoArgs.title,
  summary: demoArgs.summary,
})
const server = await startReviewServer(session, uiDir, raw.repoRoot)

console.log(`Reviewing: ${raw.repoRoot}`)
console.log(`Open: ${server.url}`)

const opener =
  process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'start'
      : 'xdg-open'
execFile(opener, [server.url], () => {
  // Best-effort only — the URL above works regardless of whether this
  // succeeds (e.g. no GUI available, or the opener binary is missing).
})

session.bus.once('review_complete', () => {
  console.log('\nReview submitted. Structured output:')
  console.log(buildMarkdown(session))
  server.close().then(() => process.exit(0))
})
