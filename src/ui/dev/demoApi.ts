import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'

// Vite-dev-only stand-in for engine/httpServer.ts: same /api contract,
// canned JSON session. Production `vite build` never loads this module
// (configureServer is a dev hook). Restart Vite after editing the JSON.

const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const
const HUNK_STATUS_RE = /^\/api\/hunks\/([^/]+)\/status$/
const HUNK_COMMENT_RE = /^\/api\/hunks\/([^/]+)\/comment$/
const HUNK_EDIT_RE = /^\/api\/hunks\/([^/]+)\/edit$/
const FILE_NOTES_RE = /^\/api\/files\/([^/]+)\/notes$/

interface DemoHunk {
  id: string
  status: string
  comment: string | null
  editedContent: string | null
}

interface DemoFile {
  path: string
  notes: string | null
  hunks: DemoHunk[]
}

interface DemoSession {
  id: string
  files: DemoFile[]
  reviewComplete: boolean
  [key: string]: unknown
}

interface DemoFixture {
  session: DemoSession
  fileContents: Record<string, string>
}

const fixturePath = fileURLToPath(
  new URL('./demo-session.json', import.meta.url),
)

export function createDemoApi() {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as DemoFixture
  const session = structuredClone(fixture.session)
  const fileContents = fixture.fileContents
  const clients = new Set<ServerResponse>()

  function emit(type: string, payload: unknown): void {
    const chunk = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
    for (const client of clients) client.write(chunk)
  }

  function findHunk(hunkId: string): DemoHunk {
    for (const file of session.files) {
      const hunk = file.hunks.find((entry) => entry.id === hunkId)
      if (hunk) return hunk
    }
    throw new Error(`Unknown hunk: ${hunkId}`)
  }

  return function demoApi(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): void {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) {
      next()
      return
    }

    handle(req, res, url, session, fileContents, clients, emit, findHunk).catch(
      (error) => {
        if (res.headersSent) return
        const message = error instanceof Error ? error.message : String(error)
        sendJson(res, message.startsWith('Unknown') ? 404 : 400, {
          error: message,
        })
      },
    )
  }
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  session: DemoSession,
  fileContents: Record<string, string>,
  clients: Set<ServerResponse>,
  emit: (type: string, payload: unknown) => void,
  findHunk: (hunkId: string) => DemoHunk,
): Promise<void> {
  const { pathname } = url
  const method = req.method ?? 'GET'

  if (method === 'GET' && pathname === '/api/session') {
    sendJson(res, 200, session)
    return
  }

  if (method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write(':ok\n\n')
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }

  if (method === 'POST' && pathname === '/api/submit') {
    session.reviewComplete = true
    emit('review_complete', { sessionId: session.id })
    sendJson(res, 200, { ok: true })
    return
  }

  const statusMatch = pathname.match(HUNK_STATUS_RE)
  if (method === 'POST' && statusMatch) {
    const hunkId = decodeURIComponent(statusMatch[1]!)
    const body = (await readJsonBody(req)) as { status?: string }
    if (
      !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])
    ) {
      sendJson(res, 400, { error: 'invalid status' })
      return
    }
    const hunk = findHunk(hunkId)
    hunk.status = body.status as string
    emit('hunk_updated', { hunkId, status: hunk.status })
    sendJson(res, 200, { ok: true })
    return
  }

  const commentMatch = pathname.match(HUNK_COMMENT_RE)
  if (method === 'POST' && commentMatch) {
    const hunkId = decodeURIComponent(commentMatch[1]!)
    const body = (await readJsonBody(req)) as { comment?: string | null }
    const hunk = findHunk(hunkId)
    hunk.comment = body.comment ?? null
    emit('hunk_updated', { hunkId, comment: hunk.comment })
    sendJson(res, 200, { ok: true })
    return
  }

  const editMatch = pathname.match(HUNK_EDIT_RE)
  if (method === 'POST' && editMatch) {
    const hunkId = decodeURIComponent(editMatch[1]!)
    const body = (await readJsonBody(req)) as {
      editedContent?: string | null
    }
    const hunk = findHunk(hunkId)
    hunk.editedContent = body.editedContent ?? null
    emit('hunk_updated', {
      hunkId,
      editedContent: hunk.editedContent,
    })
    sendJson(res, 200, { ok: true })
    return
  }

  const notesMatch = pathname.match(FILE_NOTES_RE)
  if (method === 'POST' && notesMatch) {
    const path = decodeURIComponent(notesMatch[1]!)
    const body = (await readJsonBody(req)) as { notes?: string | null }
    const file = session.files.find((candidate) => candidate.path === path)
    if (!file) {
      sendJson(res, 404, { error: `Unknown file: ${path}` })
      return
    }
    file.notes = body.notes ?? null
    sendJson(res, 200, { ok: true })
    return
  }

  if (method === 'GET' && pathname === '/api/files/content') {
    const relPath = url.searchParams.get('path')
    if (!relPath) {
      sendJson(res, 400, { error: 'path is required' })
      return
    }
    const content = fileContents[relPath]
    if (content === undefined) {
      sendJson(res, 404, { error: `Unknown file: ${relPath}` })
      return
    }
    sendJson(res, 200, { content })
    return
  }

  sendJson(res, 404, { error: 'not found' })
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(payload)
}
