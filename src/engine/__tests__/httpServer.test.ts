import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { get } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

// Engine
import { startReviewServer } from '../httpServer.js'
import { ReviewSession } from '../session.js'

// Types
import type { ParsedFile } from '../types.js'

function fixtureFiles(): ParsedFile[] {
  return [
    {
      path: 'a.txt',
      oldPath: null,
      status: 'modified',
      binary: false,
      hunks: [
        {
          id: 'a.txt@@hunk1',
          header: '@@ -1,1 +1,1 @@',
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [],
        },
      ],
    },
  ]
}

async function withServer(
  run: (
    server: Awaited<ReturnType<typeof startReviewServer>>,
    session: ReviewSession,
    apiUrl: (pathname: string) => string,
  ) => Promise<void>,
): Promise<void> {
  const uiDir = await mkdtemp(path.join(tmpdir(), 'diffmate-ui-'))
  await writeFile(path.join(uiDir, 'index.html'), '<h1>diffmate</h1>')

  const repoRoot = await mkdtemp(path.join(tmpdir(), 'diffmate-repo-'))
  await writeFile(path.join(repoRoot, 'a.txt'), 'line one\nline two\n')

  const session = new ReviewSession('cli', {}, fixtureFiles())
  const server = await startReviewServer(session, uiDir, repoRoot)
  const apiUrl = (pathname: string): string =>
    `http://127.0.0.1:${server.port}${pathname}${pathname.includes('?') ? '&' : '?'}token=${server.token}`

  try {
    await run(server, session, apiUrl)
  } finally {
    await server.close()
  }
}

test('rejects requests without a valid token', async () => {
  await withServer(async (server) => {
    const res = await fetch(
      `http://127.0.0.1:${server.port}/api/session?token=wrong`,
    )
    assert.equal(res.status, 403)
  })
})

test('serves static files from the ui dir', async () => {
  await withServer(async (_server, _session, apiUrl) => {
    const res = await fetch(apiUrl('/'))
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /text\/html/)
    assert.equal(await res.text(), '<h1>diffmate</h1>')
  })
})

test('serves static files without a token (only /api/* is gated)', async () => {
  await withServer(async (server) => {
    const res = await fetch(`http://127.0.0.1:${server.port}/`)
    assert.equal(res.status, 200)
  })
})

test('rejects static paths that escape the ui dir', async () => {
  await withServer(async (_server, _session, apiUrl) => {
    const res = await fetch(apiUrl('/../../etc/passwd'))
    assert.equal(res.status, 404)
  })
})

test('GET /api/session returns the session summary', async () => {
  await withServer(async (_server, session, apiUrl) => {
    const res = await fetch(apiUrl('/api/session'))
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.id, session.id)
    assert.equal(body.mode, 'cli')
    assert.equal(body.reviewComplete, false)
    assert.equal(body.title, null)
    assert.equal(body.summary, null)
    assert.equal(body.files[0].hunks[0].status, 'pending')
  })
})

test('GET /api/session includes the agent title/summary', async () => {
  const uiDir = await mkdtemp(path.join(tmpdir(), 'diffmate-ui-'))
  await writeFile(path.join(uiDir, 'index.html'), '<h1>diffmate</h1>')
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'diffmate-repo-'))
  const session = new ReviewSession('mcp', {}, fixtureFiles(), {
    title: 'My review',
    summary: 'Claude changed some things.',
  })
  const server = await startReviewServer(session, uiDir, repoRoot)
  try {
    const res = await fetch(
      `http://127.0.0.1:${server.port}/api/session?token=${server.token}`,
    )
    const body = await res.json()
    assert.equal(body.title, 'My review')
    assert.equal(body.summary, 'Claude changed some things.')
    assert.equal(body.mode, 'mcp')
  } finally {
    await server.close()
  }
})

test('POST /api/hunks/:id/status updates the hunk', async () => {
  await withServer(async (_server, session, apiUrl) => {
    const res = await fetch(apiUrl('/api/hunks/a.txt@@hunk1/status'), {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    })
    assert.equal(res.status, 200)
    assert.equal(session.files[0]!.hunks[0]!.status, 'approved')
  })
})

test('POST /api/hunks/:id/status 404s for an unknown hunk', async () => {
  await withServer(async (_server, _session, apiUrl) => {
    const res = await fetch(apiUrl('/api/hunks/nope/status'), {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    })
    assert.equal(res.status, 404)
  })
})

test('POST /api/hunks/:id/status 400s for an invalid status', async () => {
  await withServer(async (_server, _session, apiUrl) => {
    const res = await fetch(apiUrl('/api/hunks/a.txt@@hunk1/status'), {
      method: 'POST',
      body: JSON.stringify({ status: 'maybe' }),
    })
    assert.equal(res.status, 400)
  })
})

test('POST /api/hunks/:id/comment updates the comment', async () => {
  await withServer(async (_server, session, apiUrl) => {
    const res = await fetch(apiUrl('/api/hunks/a.txt@@hunk1/comment'), {
      method: 'POST',
      body: JSON.stringify({ comment: 'looks off' }),
    })
    assert.equal(res.status, 200)
    assert.equal(session.files[0]!.hunks[0]!.comment, 'looks off')
  })
})

test('POST /api/hunks/:id/edit updates the edited content', async () => {
  await withServer(async (_server, session, apiUrl) => {
    const res = await fetch(apiUrl('/api/hunks/a.txt@@hunk1/edit'), {
      method: 'POST',
      body: JSON.stringify({ editedContent: 'const x = 1' }),
    })
    assert.equal(res.status, 200)
    assert.equal(session.files[0]!.hunks[0]!.editedContent, 'const x = 1')
  })
})

test('POST /api/files/:path/notes stores out-of-hunk edits', async () => {
  await withServer(async (_server, session, apiUrl) => {
    const res = await fetch(apiUrl('/api/files/a.txt/notes'), {
      method: 'POST',
      body: JSON.stringify({ notes: '@@ -1,1 +1,1 @@\n-line one\n+line uno' }),
    })
    assert.equal(res.status, 200)
    assert.equal(
      session.files[0]!.notes,
      '@@ -1,1 +1,1 @@\n-line one\n+line uno',
    )
  })
})

test('GET /api/files/content returns the current file content', async () => {
  await withServer(async (_server, _session, apiUrl) => {
    const res = await fetch(apiUrl('/api/files/content?path=a.txt'))
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.content, 'line one\nline two\n')
  })
})

test('GET /api/files/content 404s for a missing file', async () => {
  await withServer(async (_server, _session, apiUrl) => {
    const res = await fetch(apiUrl('/api/files/content?path=missing.txt'))
    assert.equal(res.status, 404)
  })
})

test('GET /api/files/content 400s without a path', async () => {
  await withServer(async (_server, _session, apiUrl) => {
    const res = await fetch(apiUrl('/api/files/content'))
    assert.equal(res.status, 400)
  })
})

test('POST /api/questions enqueues a question and returns 202', async () => {
  await withServer(async (_server, session, apiUrl) => {
    const res = await fetch(apiUrl('/api/questions'), {
      method: 'POST',
      body: JSON.stringify({ hunkId: 'a.txt@@hunk1', text: 'why?' }),
    })
    assert.equal(res.status, 202)
    const body = await res.json()
    assert.equal(session.files[0]!.hunks[0]!.questions[0]!.id, body.questionId)
  })
})

test('POST /api/submit completes the review', async () => {
  await withServer(async (_server, session, apiUrl) => {
    const res = await fetch(apiUrl('/api/submit'), { method: 'POST' })
    assert.equal(res.status, 200)
    assert.equal(session.reviewComplete, true)
  })
})

test('GET /api/events streams session bus events as SSE', async () => {
  await withServer(async (_server, session, apiUrl) => {
    const received = await new Promise<string>((resolve, reject) => {
      let settled = false
      const req = get(apiUrl('/api/events'), (res) => {
        let buffer = ''
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8')
          if (buffer.includes('event: hunk_updated')) {
            settled = true
            req.destroy()
            resolve(buffer)
          }
        })
        res.on('error', () => {
          // Destroying the request above triggers a socket error on the
          // response too; ignore it once we've already resolved.
          if (!settled) reject(new Error('SSE response errored'))
        })
      })
      req.on('error', (error) => {
        if (!settled) reject(error)
      })
      // Give the server a tick to register the SSE connection before firing.
      setTimeout(() => session.setHunkStatus('a.txt@@hunk1', 'approved'), 20)
    })

    assert.match(received, /event: hunk_updated/)
    assert.match(received, /"hunkId":"a\.txt@@hunk1"/)
  })
})

async function withSettingsServer(
  run: (
    apiUrl: (pathname: string) => string,
    settingsPath: string,
    port: number,
  ) => Promise<void>,
  settingsPath?: string,
): Promise<void> {
  const uiDir = await mkdtemp(path.join(tmpdir(), 'diffmate-ui-'))
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'diffmate-repo-'))
  // Nested under a folder that doesn't exist yet, like a first run.
  const file =
    settingsPath ??
    path.join(
      await mkdtemp(path.join(tmpdir(), 'diffmate-config-')),
      'diffmate',
      'settings.json',
    )
  const session = new ReviewSession('cli', {}, fixtureFiles())
  const server = await startReviewServer(session, uiDir, repoRoot, {
    settingsPath: file,
  })
  const apiUrl = (pathname: string): string =>
    `http://127.0.0.1:${server.port}${pathname}?token=${server.token}`
  try {
    await run(apiUrl, file, server.port)
  } finally {
    await server.close()
  }
}

function patchSettings(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('GET /api/settings returns {} when no settings file exists', async () => {
  await withSettingsServer(async (apiUrl) => {
    const res = await fetch(apiUrl('/api/settings'))
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), {})
  })
})

test('PATCH /api/settings creates the file and a new server reads it back', async () => {
  let file = ''
  await withSettingsServer(async (apiUrl, settingsPath) => {
    file = settingsPath
    const res = await patchSettings(apiUrl('/api/settings'), {
      colors: { agent: '#f06543' },
    })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { colors: { agent: '#f06543' } })
  })

  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
    colors: { agent: '#f06543' },
  })
  await withSettingsServer(async (apiUrl) => {
    const res = await fetch(apiUrl('/api/settings'))
    assert.deepEqual(await res.json(), { colors: { agent: '#f06543' } })
  }, file)
})

test('PATCH /api/settings merges, and null removes a field', async () => {
  await withSettingsServer(async (apiUrl) => {
    await patchSettings(apiUrl('/api/settings'), {
      colors: { agent: '#f06543', primary: '#0969da' },
    })
    const merged = await patchSettings(apiUrl('/api/settings'), {
      fileListWidth: 320,
    })
    assert.deepEqual(await merged.json(), {
      colors: { agent: '#f06543', primary: '#0969da' },
      fileListWidth: 320,
    })

    const cleared = await patchSettings(apiUrl('/api/settings'), {
      colors: { agent: null },
      fileListWidth: null,
    })
    assert.deepEqual(await cleared.json(), { colors: { primary: '#0969da' } })
  })
})

test('PATCH /api/settings 400s for invalid values and writes nothing', async () => {
  await withSettingsServer(async (apiUrl, settingsPath) => {
    for (const body of [
      { colors: { agent: 'orange' } },
      { colors: { primary: '#12345' } },
      { colors: { diffAddIntensity: 1.5 } },
      { colors: { diffDelIntensity: 'strong' } },
      { fileListWidth: 0 },
      { fileListWidth: '300' },
      { colors: { mystery: '#000000' } },
      { theme: 'dark' },
      [1, 2],
    ]) {
      const res = await patchSettings(apiUrl('/api/settings'), body)
      assert.equal(res.status, 400, JSON.stringify(body))
    }
    await assert.rejects(readFile(settingsPath, 'utf8'), { code: 'ENOENT' })
  })
})

test('/api/settings requires the session token', async () => {
  await withSettingsServer(async (_apiUrl, settingsPath, port) => {
    const url = `http://127.0.0.1:${port}/api/settings`
    assert.equal((await fetch(url)).status, 403)
    const res = await patchSettings(url, { fileListWidth: 300 })
    assert.equal(res.status, 403)
    await assert.rejects(readFile(settingsPath, 'utf8'), { code: 'ENOENT' })
  })
})

test('an empty PATCH /api/settings writes nothing', async () => {
  await withSettingsServer(async (apiUrl, settingsPath) => {
    const res = await patchSettings(apiUrl('/api/settings'), {})
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), {})
    await assert.rejects(readFile(settingsPath, 'utf8'), { code: 'ENOENT' })
  })
})
