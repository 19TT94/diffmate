import type { Client } from '@modelcontextprotocol/sdk/client/index.js'

// MCP
import type { Activity, StartReviewResult } from '../src/mcp/tools.js'

export interface DemoAgentOptions {
  title: string | null
  summary: string | null
  timeoutSeconds?: number
  log: (text: string) => void
}

async function callTool<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await client.callTool({ name, arguments: args })
  return result.structuredContent as T
}

// A scripted stand-in for the Claude Code agent: drives the same loop the
// project slash command will (start_review -> wait_for_activity loop ->
// answer questions -> end_review on review_complete), with canned answers
// instead of real knowledge of the change.
export async function runDemoAgent(
  client: Client,
  options: DemoAgentOptions,
): Promise<void> {
  const startArgs: Record<string, unknown> = {}
  if (options.title !== null) startArgs.title = options.title
  if (options.summary !== null) startArgs.summary = options.summary
  const started = await callTool<StartReviewResult>(
    client,
    'start_review',
    startArgs,
  )
  options.log(
    `Review started (${started.fileCount} files, ${started.hunkCount} hunks): ${started.url}`,
  )

  for (;;) {
    const activity = await callTool<Activity>(client, 'wait_for_activity', {
      sessionId: started.sessionId,
      ...(options.timeoutSeconds !== undefined && {
        timeoutSeconds: options.timeoutSeconds,
      }),
    })

    if (activity.type === 'no_activity') continue

    if (activity.type === 'question') {
      const answer =
        `Demo agent here. You asked: "${activity.questionText}". A real ` +
        `agent would explain why it changed ${activity.filePath} ` +
        `(${activity.hunkHeader}).`
      await callTool(client, 'answer_question', {
        sessionId: started.sessionId,
        questionId: activity.questionId,
        answer,
      })
      options.log(`Answered: ${activity.questionText}`)
      continue
    }

    options.log(activity.summaryMarkdown)
    await callTool(client, 'end_review', {
      sessionId: started.sessionId,
      reason: 'The demo agent received your review.',
    })
    return
  }
}
