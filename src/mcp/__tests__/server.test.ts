import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

// MCP
import { createMcpServer } from '../server.js'
import { SessionController } from '../tools.js'

const execFileAsync = promisify(execFile)

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'diffmate-mcp-'))
  await execFileAsync('git', ['init', '-q', '-b', 'master'], { cwd: dir })
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], {
    cwd: dir,
  })
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  await writeFile(path.join(dir, 'tracked.txt'), 'line one\nline two\n')
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd: dir })
  await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: dir })
  return dir
}

async function makeUi(): Promise<string> {
  const uiDir = await mkdtemp(path.join(tmpdir(), 'diffmate-ui-'))
  await writeFile(path.join(uiDir, 'index.html'), '<!doctype html>')
  return uiDir
}

interface LinkedMcp {
  client: Client
  controller: SessionController
  opened: string[]
  close: () => Promise<void>
}

async function connectLinked(uiDir: string): Promise<LinkedMcp> {
  const controller = new SessionController()
  const opened: string[] = []
  const server = createMcpServer(controller, {
    uiDir,
    openBrowser: (url) => opened.push(url),
  })
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  return {
    client,
    controller,
    opened,
    close: async () => {
      await client.close()
      await server.close()
    },
  }
}

// Each test drives its own cwd (SessionController resolves the diff against
// process.cwd(), exactly as the stdio server does when Claude Code spawns
// diffmate in the project directory), so run tests sequentially.

test('start_review starts a review, opens the browser, and serves agent context', async () => {
  const dir = await makeRepo()
  const uiDir = await makeUi()
  const previousCwd = process.cwd()
  try {
    await writeFile(
      path.join(dir, 'tracked.txt'),
      'line one\nline two changed\n',
    )
    process.chdir(dir)
    const linked = await connectLinked(uiDir)
    try {
      const tools = await linked.client.listTools()
      assert.equal(tools.tools.length, 1)
      assert.equal(tools.tools[0]!.name, 'start_review')

      const result = await linked.client.callTool({
        name: 'start_review',
        arguments: {
          title: 'My review',
          summary: 'Claude changed a line.',
        },
      })

      assert.ok(!result.isError)
      const structured = result.structuredContent as {
        sessionId: string
        url: string
        fileCount: number
        hunkCount: number
      }
      assert.ok(structured.sessionId.length > 0)
      assert.match(structured.url, /^http:\/\/127\.0\.0\.1:\d+\/\?token=/)
      assert.equal(structured.fileCount, 1)
      assert.equal(structured.hunkCount, 1)
      assert.deepEqual(linked.opened, [structured.url])

      const parsed = new URL(structured.url)
      const token = parsed.searchParams.get('token') ?? ''
      const sessionRes = await fetch(
        `${parsed.origin}/api/session?token=${token}`,
      )
      assert.equal(sessionRes.status, 200)
      const sessionBody = await sessionRes.json()
      assert.equal(sessionBody.mode, 'mcp')
      assert.equal(sessionBody.title, 'My review')
      assert.equal(sessionBody.summary, 'Claude changed a line.')

      const submit = await fetch(`${parsed.origin}/api/submit?token=${token}`, {
        method: 'POST',
      })
      assert.equal(submit.status, 200)
    } finally {
      await linked.close()
    }
  } finally {
    process.chdir(previousCwd)
    await rm(dir, { recursive: true, force: true })
    await rm(uiDir, { recursive: true, force: true })
  }
})

test('start_review rejects a second active review', async () => {
  const dir = await makeRepo()
  const uiDir = await makeUi()
  const previousCwd = process.cwd()
  try {
    await writeFile(
      path.join(dir, 'tracked.txt'),
      'line one\nline two changed\n',
    )
    process.chdir(dir)
    const linked = await connectLinked(uiDir)
    try {
      const first = await linked.client.callTool({ name: 'start_review' })
      assert.ok(!first.isError)

      await assert.rejects(
        () => linked.client.callTool({ name: 'start_review' }),
        /already active/,
      )

      const structured = first.structuredContent as { url: string }
      const parsed = new URL(structured.url)
      const token = parsed.searchParams.get('token') ?? ''
      await fetch(`${parsed.origin}/api/submit?token=${token}`, {
        method: 'POST',
      })
    } finally {
      await linked.close()
    }
  } finally {
    process.chdir(previousCwd)
    await rm(dir, { recursive: true, force: true })
    await rm(uiDir, { recursive: true, force: true })
  }
})

test('start_review rejects a repo with no changes', async () => {
  const dir = await makeRepo()
  const uiDir = await makeUi()
  const previousCwd = process.cwd()
  try {
    process.chdir(dir)
    const linked = await connectLinked(uiDir)
    try {
      await assert.rejects(
        () => linked.client.callTool({ name: 'start_review' }),
        /No changes to review/,
      )
    } finally {
      await linked.close()
    }
  } finally {
    process.chdir(previousCwd)
    await rm(dir, { recursive: true, force: true })
    await rm(uiDir, { recursive: true, force: true })
  }
})

test('an unknown tool is rejected', async () => {
  const uiDir = await makeUi()
  const linked = await connectLinked(uiDir)
  try {
    await assert.rejects(
      () => linked.client.callTool({ name: 'nope' }),
      /Unknown tool/,
    )
  } finally {
    await linked.close()
    await rm(uiDir, { recursive: true, force: true })
  }
})
