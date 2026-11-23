import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

// Install
import { install } from '../index.js'

const CLAUDE_FILES = ['.mcp.json', '.claude/skills/diffmate-review/SKILL.md']
const CURSOR_FILES = [
  '.cursor/mcp.json',
  '.cursor/skills/diffmate-review/SKILL.md',
]

async function withProject<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-install-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function capture(): { lines: string[]; stdout: (text: string) => void } {
  const lines: string[] = []
  return { lines, stdout: (text) => lines.push(text) }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'))
}

test('install sets up both clients by default and prints each path', async () => {
  await withProject(async (dir) => {
    const out = capture()

    await install(dir, null, out.stdout)

    for (const file of [...CLAUDE_FILES, ...CURSOR_FILES]) {
      assert.ok(existsSync(path.join(dir, file)), `${file} was written`)
      assert.ok(
        out.lines.some((line) => line.includes(file)),
        `${file} was printed`,
      )
    }
    const entry = { command: 'npx', args: ['diffmate', 'mcp'] }
    assert.deepEqual(await readJson(path.join(dir, '.mcp.json')), {
      mcpServers: { diffmate: entry },
    })
    assert.deepEqual(await readJson(path.join(dir, '.cursor/mcp.json')), {
      mcpServers: { diffmate: entry },
    })
  })
})

test('install --client writes only that client', async () => {
  for (const [client, wanted, unwanted] of [
    ['claude', CLAUDE_FILES, CURSOR_FILES],
    ['cursor', CURSOR_FILES, CLAUDE_FILES],
  ] as const) {
    await withProject(async (dir) => {
      await install(dir, client, () => {})

      for (const file of wanted) {
        assert.ok(existsSync(path.join(dir, file)), `${file} was written`)
      }
      for (const file of unwanted) {
        assert.ok(!existsSync(path.join(dir, file)), `${file} was skipped`)
      }
    })
  }
})

test('install keeps other MCP servers and is idempotent', async () => {
  await withProject(async (dir) => {
    const config = path.join(dir, '.mcp.json')
    await writeFile(
      config,
      JSON.stringify({
        mcpServers: {
          other: { command: 'other-server' },
          diffmate: { command: 'old' },
        },
        extra: true,
      }),
    )

    await install(dir, 'claude', () => {})
    assert.deepEqual(await readJson(config), {
      mcpServers: {
        other: { command: 'other-server' },
        diffmate: { command: 'npx', args: ['diffmate', 'mcp'] },
      },
      extra: true,
    })

    const first = await Promise.all(
      CLAUDE_FILES.map((file) => readFile(path.join(dir, file), 'utf8')),
    )
    await install(dir, 'claude', () => {})
    const second = await Promise.all(
      CLAUDE_FILES.map((file) => readFile(path.join(dir, file), 'utf8')),
    )
    assert.deepEqual(second, first)
  })
})

test('install refuses an MCP config that is not valid JSON and writes nothing', async () => {
  await withProject(async (dir) => {
    await mkdir(path.join(dir, '.cursor'))
    const broken = path.join(dir, '.cursor/mcp.json')
    await writeFile(broken, '{ not json')

    await assert.rejects(
      () => install(dir, null, () => {}),
      /\.cursor\/mcp\.json/,
    )

    assert.equal(await readFile(broken, 'utf8'), '{ not json')
    for (const file of [...CLAUDE_FILES, CURSOR_FILES[1]]) {
      assert.ok(!existsSync(path.join(dir, file)), `${file} was not written`)
    }
  })
})
