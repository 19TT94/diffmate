import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Engine
import { readUntrackedFile, resolveDiff } from '../src/engine/git.js'
import { parseDiff, parseUntrackedFile } from '../src/engine/parseDiff.js'
import { ReviewSession } from '../src/engine/session.js'
import { startReviewServer } from '../src/engine/httpServer.js'

// Stand-in for the real `diffmate review` CLI (build order M7, not yet
// built): wires the engine pieces together end-to-end against a real repo
// so the UI can be tried before the CLI/output builder land.

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const uiDir = path.join(projectRoot, 'src/ui/dist')

if (!existsSync(path.join(uiDir, 'index.html'))) {
  console.error('src/ui/dist not built — run `npm run build:ui` first.')
  process.exit(1)
}

const targetRepo = path.resolve(process.argv[2] ?? process.cwd())

const raw = await resolveDiff({}, targetRepo)
const files = parseDiff(raw.diffText)
for (const relPath of raw.untrackedFiles) {
  const content = await readUntrackedFile(raw.repoRoot, relPath)
  files.push(parseUntrackedFile(relPath, content))
}

const session = new ReviewSession('cli', {}, files)
const server = await startReviewServer(session, uiDir)

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
  console.log('\nReview submitted. Final hunk decisions:')
  for (const file of session.files) {
    for (const hunk of file.hunks) {
      const suffix = hunk.comment ? ` ("${hunk.comment}")` : ''
      console.log(`  ${file.path} ${hunk.header} -> ${hunk.status}${suffix}`)
    }
  }
  server.close().then(() => process.exit(0))
})
