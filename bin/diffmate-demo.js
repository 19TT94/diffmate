#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Stopgap for milestone M7 (see docs/PLAN.md): links via `npm link` so
// scripts/demo.ts can be triggered from inside any other repo's directory,
// ahead of the real `diffmate review` CLI. Resolve paths relative to this
// file's own location (not cwd), same pattern scripts/demo.ts already uses
// for src/ui/dist.

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const demoScript = path.join(projectRoot, 'scripts/demo.ts')
const tsx = path.join(projectRoot, 'node_modules/.bin/tsx')

const child = spawn(tsx, [demoScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 1))
