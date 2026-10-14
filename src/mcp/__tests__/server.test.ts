import assert from 'node:assert/strict'
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

// MCP
import { connectLinked, makeRepo, makeUi } from './helpers.js'

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
      assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
        'answer_question',
        'end_review',
        'start_review',
        'wait_for_activity',
      ])

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

test('tool descriptions guide the agent through the loop', async () => {
  const uiDir = await makeUi()
  const linked = await connectLinked(uiDir)
  try {
    const { tools } = await linked.client.listTools()
    const byName = new Map(tools.map((tool) => [tool.name, tool]))

    const answer = byName.get('answer_question')!.inputSchema
      .properties as Record<string, { description?: string }>
    assert.ok(answer.questionId?.description)
    assert.ok(answer.answer?.description)

    const wait = byName.get('wait_for_activity')!.description ?? ''
    for (const field of ['pending', 'decided', 'idleSeconds']) {
      assert.match(wait, new RegExp(field))
    }
    assert.match(wait, /stop looping/)

    assert.match(
      byName.get('start_review')!.description ?? '',
      /share the url with the user/i,
    )
  } finally {
    await linked.close()
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
