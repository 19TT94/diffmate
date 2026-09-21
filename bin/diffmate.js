#!/usr/bin/env node
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const cliEntry = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'cli',
  'index.js',
)

if (!existsSync(cliEntry)) {
  console.error('diffmate: build not found — run `npm run build` first.')
  process.exit(1)
}

const { main } = await import(cliEntry)
main(process.argv.slice(2))
