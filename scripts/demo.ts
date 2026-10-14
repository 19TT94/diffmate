import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

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
import { runDemoAgent } from './demoAgent.js'

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

if (demoArgs.mcp) {
  // Spawn the real stdio MCP server in the target repo, exactly as Claude
  // Code would, and let a scripted agent drive it.
  const cliEntry = pathToFileURL(path.join(projectRoot, 'src/cli/index.ts'))
  const transport = new StdioClientTransport({
    command: path.join(projectRoot, 'node_modules/.bin/tsx'),
    args: [
      '--eval',
      `import(${JSON.stringify(cliEntry.href)}).then((m) => m.main(['mcp']))`,
    ],
    cwd: targetRepo,
    stderr: 'inherit',
  })
  const client = new Client({ name: 'diffmate-demo-agent', version: '0.1.0' })
  await client.connect(transport)
  console.log('Demo agent connected to `diffmate mcp`.')
  console.log(
    'Ask questions with: curl -X POST "<origin>/api/questions?token=<token>" ' +
      `-H 'Content-Type: application/json' -d '{"hunkId":"…","text":"…"}'`,
  )
  await runDemoAgent(client, {
    title: demoArgs.title,
    summary: demoArgs.summary,
    log: (text) => console.log(text),
  })
  await client.close()
  process.exit(0)
}

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
