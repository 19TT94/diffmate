import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

// Engine
import { readFileContent } from './git.js'
import type { ReviewSession } from './session.js'

// Types
import type { HunkStatus } from './types.js'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

const VALID_STATUSES: HunkStatus[] = ['pending', 'approved', 'rejected']
const HUNK_STATUS_RE = /^\/api\/hunks\/([^/]+)\/status$/
const HUNK_COMMENT_RE = /^\/api\/hunks\/([^/]+)\/comment$/
const HUNK_EDIT_RE = /^\/api\/hunks\/([^/]+)\/edit$/
const FILE_NOTES_RE = /^\/api\/files\/([^/]+)\/notes$/
const FILE_CONTENT_PATH = '/api/files/content'

// Events the browser's SSE connection forwards from the session bus. Kept as
// an explicit allowlist so the stream only ever carries known event shapes.
const SSE_EVENTS = [
  'hunk_updated',
  'question_asked',
  'question_answered',
  'review_complete',
] as const

export interface ReviewServer {
  url: string
  port: number
  token: string
  close: () => Promise<void>
}

export async function startReviewServer(
  session: ReviewSession,
  uiDir: string,
  repoRoot: string,
): Promise<ReviewServer> {
  const token = randomUUID()

  const server = createServer((req, res) => {
    handleRequest(req, res, session, token, uiDir, repoRoot).catch((error) => {
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind review server')
  }
  const port = address.port
  // The token rides in the URL (not a header) so it works for both fetch
  // calls and the browser's EventSource, which can't set custom headers.
  const url = `http://127.0.0.1:${port}/?token=${token}`

  return {
    url,
    port,
    token,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  session: ReviewSession,
  token: string,
  uiDir: string,
  repoRoot: string,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { pathname } = url
  const method = req.method ?? 'GET'

  // Only /api/* (diff content, approve/reject/comment writes) needs the
  // token: the static shell carries no user data and a plain <script src>
  // tag can't append a query string, so gating it too would break loading.
  if (pathname.startsWith('/api/') && url.searchParams.get('token') !== token) {
    sendJson(res, 403, { error: 'forbidden' })
    return
  }

  try {
    if (method === 'GET' && pathname === '/api/session') {
      sendJson(res, 200, summarizeSession(session))
      return
    }

    if (method === 'GET' && pathname === '/api/events') {
      handleEvents(session, res)
      return
    }

    if (method === 'POST' && pathname === '/api/submit') {
      session.complete()
      sendJson(res, 200, { ok: true })
      return
    }

    if (method === 'POST' && pathname === '/api/questions') {
      const body = (await readJsonBody(req)) as {
        hunkId?: string
        text?: string
      }
      if (!body.hunkId || !body.text) {
        sendJson(res, 400, { error: 'hunkId and text are required' })
        return
      }
      // Returns immediately without waiting for an answer: the question is
      // just enqueued for the MCP agent's next wait_for_activity poll.
      const question = session.askQuestion(body.hunkId, body.text)
      sendJson(res, 202, { questionId: question.id })
      return
    }

    const statusMatch = pathname.match(HUNK_STATUS_RE)
    if (method === 'POST' && statusMatch) {
      const hunkId = decodeURIComponent(statusMatch[1]!)
      const body = (await readJsonBody(req)) as { status?: string }
      if (!VALID_STATUSES.includes(body.status as HunkStatus)) {
        sendJson(res, 400, { error: 'invalid status' })
        return
      }
      session.setHunkStatus(hunkId, body.status as HunkStatus)
      sendJson(res, 200, { ok: true })
      return
    }

    const commentMatch = pathname.match(HUNK_COMMENT_RE)
    if (method === 'POST' && commentMatch) {
      const hunkId = decodeURIComponent(commentMatch[1]!)
      const body = (await readJsonBody(req)) as { comment?: string | null }
      session.setHunkComment(hunkId, body.comment ?? null)
      sendJson(res, 200, { ok: true })
      return
    }

    const editMatch = pathname.match(HUNK_EDIT_RE)
    if (method === 'POST' && editMatch) {
      const hunkId = decodeURIComponent(editMatch[1]!)
      const body = (await readJsonBody(req)) as {
        editedContent?: string | null
      }
      session.setHunkEditedContent(hunkId, body.editedContent ?? null)
      sendJson(res, 200, { ok: true })
      return
    }

    const fileNotesMatch = pathname.match(FILE_NOTES_RE)
    if (method === 'POST' && fileNotesMatch) {
      const path = decodeURIComponent(fileNotesMatch[1]!)
      const body = (await readJsonBody(req)) as { notes?: string | null }
      session.setFileNotes(path, body.notes ?? null)
      sendJson(res, 200, { ok: true })
      return
    }

    if (method === 'GET' && pathname === FILE_CONTENT_PATH) {
      const relPath = url.searchParams.get('path')
      if (!relPath) {
        sendJson(res, 400, { error: 'path is required' })
        return
      }
      const content = await readFileContent(repoRoot, relPath, session.scope)
      sendJson(res, 200, { content })
      return
    }

    if (method === 'GET' && !pathname.startsWith('/api/')) {
      await serveStatic(pathname, uiDir, res)
      return
    }

    sendJson(res, 404, { error: 'not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // session.ts throws "Unknown hunk/question: ..." for a bad id; anything
    // else here is a malformed request (e.g. unparsable JSON body).
    sendJson(res, message.startsWith('Unknown') ? 404 : 400, {
      error: message,
    })
  }
}

function summarizeSession(session: ReviewSession) {
  return {
    id: session.id,
    mode: session.mode,
    scope: session.scope,
    files: session.files,
    title: session.title,
    summary: session.summary,
    reviewComplete: session.reviewComplete,
  }
}

function handleEvents(session: ReviewSession, res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write(':ok\n\n')

  const listeners = SSE_EVENTS.map((type) => {
    const listener = (payload: unknown): void => {
      res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`)
    }
    session.bus.on(type, listener)
    return { type, listener }
  })

  res.on('close', () => {
    for (const { type, listener } of listeners) {
      session.bus.off(type, listener)
    }
  })
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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(payload)
}

async function serveStatic(
  pathname: string,
  uiDir: string,
  res: ServerResponse,
): Promise<void> {
  const relPath = pathname === '/' ? '/index.html' : pathname
  const resolved = path.join(uiDir, relPath)

  // Reject any request that resolves outside uiDir (e.g. `/../../etc/passwd`).
  const relative = path.relative(uiDir, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    sendJson(res, 403, { error: 'forbidden' })
    return
  }

  try {
    const body = await readFile(resolved)
    const contentType = CONTENT_TYPES[path.extname(resolved)]
    res.writeHead(200, {
      'Content-Type': contentType ?? 'application/octet-stream',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
  }
}
