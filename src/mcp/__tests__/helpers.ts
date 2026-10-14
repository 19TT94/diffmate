import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

// MCP
import { createMcpServer } from '../server.js'
import { SessionController } from '../tools.js'

const execFileAsync = promisify(execFile)

export async function makeRepo(): Promise<string> {
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

export async function makeUi(): Promise<string> {
  const uiDir = await mkdtemp(path.join(tmpdir(), 'diffmate-ui-'))
  await writeFile(path.join(uiDir, 'index.html'), '<!doctype html>')
  return uiDir
}

export interface LinkedMcp {
  client: Client
  controller: SessionController
  opened: string[]
  close: () => Promise<void>
}

export async function connectLinked(
  uiDir: string,
  controller: SessionController = new SessionController(),
): Promise<LinkedMcp> {
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
      // Sessions outlive submit (until end_review), so tests must free any
      // review server still listening.
      await controller.close()
    },
  }
}

export async function callStructured<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await client.callTool({ name, arguments: args })
  if (result.isError) {
    throw new Error(`${name} returned an error result`)
  }
  return result.structuredContent as T
}

// A started review over a repo with one modified file (one hunk), with
// helpers for driving the browser side of it over HTTP.
export interface StartedReview {
  linked: LinkedMcp
  sessionId: string
  origin: string
  api: (pathname: string, init?: RequestInit) => Promise<Response>
  hunkId: () => Promise<string>
  ask: (hunkId: string, text: string) => Promise<string>
  setStatus: (hunkId: string, status: string) => Promise<void>
  submit: () => Promise<void>
}

// Tests drive their own cwd (SessionController resolves the diff against
// process.cwd(), exactly as the stdio server does when Claude Code spawns
// diffmate in the project directory), so tests in a file run sequentially.
export async function withRepoChange<T>(
  fn: (dir: string, uiDir: string) => Promise<T>,
): Promise<T> {
  const dir = await makeRepo()
  const uiDir = await makeUi()
  const previousCwd = process.cwd()
  try {
    await writeFile(
      path.join(dir, 'tracked.txt'),
      'line one\nline two changed\n',
    )
    process.chdir(dir)
    return await fn(dir, uiDir)
  } finally {
    process.chdir(previousCwd)
    await rm(dir, { recursive: true, force: true })
    await rm(uiDir, { recursive: true, force: true })
  }
}

export function reviewHelpers(
  linked: LinkedMcp,
  started: { sessionId: string; url: string },
): StartedReview {
  const parsed = new URL(started.url)
  const token = parsed.searchParams.get('token') ?? ''
  const api = (pathname: string, init?: RequestInit): Promise<Response> => {
    const separator = pathname.includes('?') ? '&' : '?'
    return fetch(`${parsed.origin}${pathname}${separator}token=${token}`, init)
  }
  return {
    linked,
    sessionId: started.sessionId,
    origin: parsed.origin,
    api,
    hunkId: async () => {
      const body = await (await api('/api/session')).json()
      return body.files[0].hunks[0].id as string
    },
    ask: async (hunkId, text) => {
      const res = await api('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hunkId, text }),
      })
      const body = await res.json()
      return body.questionId as string
    },
    setStatus: async (hunkId, status) => {
      await api(`/api/hunks/${encodeURIComponent(hunkId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    },
    submit: async () => {
      await api('/api/submit', { method: 'POST' })
    },
  }
}

export async function withStartedReview(
  fn: (review: StartedReview) => Promise<void>,
  controller?: SessionController,
): Promise<void> {
  await withRepoChange(async (_dir, uiDir) => {
    const linked = await connectLinked(uiDir, controller)
    try {
      const started = await callStructured<{ sessionId: string; url: string }>(
        linked.client,
        'start_review',
        { title: 'Test review' },
      )
      await fn(reviewHelpers(linked, started))
    } finally {
      await linked.close()
    }
  })
}

// Opens the browser's SSE stream and resolves with the data of the first
// `eventName` event via `next`. Returns once the stream is connected, so the
// caller can trigger the event right after awaiting this.
export async function listenForEvent(
  review: StartedReview,
  eventName: string,
): Promise<{ next: Promise<unknown>; stop: () => void }> {
  const controller = new AbortController()
  const res = await review.api('/api/events', { signal: controller.signal })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  const next = (async () => {
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) throw new Error(`stream ended before ${eventName}`)
      buffer += decoder.decode(value, { stream: true })
      for (const block of buffer.split('\n\n')) {
        const lines = block.split('\n')
        if (lines[0] === `event: ${eventName}`) {
          return JSON.parse(lines[1]!.slice('data: '.length)) as unknown
        }
      }
    }
  })()
  return { next, stop: () => controller.abort() }
}

export async function isServerUp(origin: string): Promise<boolean> {
  try {
    await fetch(origin)
    return true
  } catch {
    return false
  }
}
