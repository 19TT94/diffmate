import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import type {
  CallToolResult,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js'

// CLI
import { defaultUiDir, openBrowser } from '../cli/index.js'

// MCP
import { SessionController } from './tools.js'
import type {
  AnswerQuestionArgs,
  EndReviewArgs,
  McpDeps,
  StartReviewArgs,
  WaitForActivityArgs,
} from './tools.js'

const SESSION_ID_PROPERTY = {
  type: 'string',
  description: 'The sessionId returned by start_review.',
} as const

const TOOLS = [
  {
    name: 'start_review',
    description:
      'Start a diffmate review of the current repo and open it in the browser ' +
      'for the user to approve or reject each hunk. Returns the session id and ' +
      'review URL immediately — share the url with the user, since the ' +
      'browser may not have opened — then call wait_for_activity in a loop. ' +
      'Only one review can be active at a time.',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
          description: 'Review changes since the merge-base of this ref.',
        },
        staged: {
          type: 'boolean',
          description: 'Review only staged changes.',
        },
        title: {
          type: 'string',
          description: 'A short title describing what this review covers.',
        },
        summary: {
          type: 'string',
          description:
            'Agent context — what the change does and why — shown in the review UI.',
        },
        hunkSummaries: {
          type: 'array',
          description:
            'One entry per hunk you changed, explaining why you made that ' +
            'change; shown on the hunk in the review UI. Identify a hunk by ' +
            'its file path and its 1-based position within that file, in ' +
            'git diff order (a new untracked file is one hunk). List entries ' +
            'in the order a human should review them, so what a change ' +
            'depends on comes first: files are shown in the order they first ' +
            "appear here (any you leave out come last), and a file's hunks " +
            'stay in diff order. Say in each summary how the change connects ' +
            'to the changes that follow. Entries that match no hunk come ' +
            'back as unmatchedSummaries.',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              hunk: { type: 'integer', minimum: 1 },
              summary: { type: 'string' },
            },
            required: ['path', 'hunk', 'summary'],
          },
        },
      },
    },
  },
  {
    name: 'wait_for_activity',
    description:
      'Wait for the reviewer. Returns { type: "no_activity", pending, ' +
      'decided, idleSeconds } on timeout (call again right away without ' +
      'narrating), a { type: "question" } to answer with answer_question ' +
      '(a null filePath means it is about the whole review, not one hunk), ' +
      'or { type: "review_complete" } with the decisions (stop looping, act ' +
      'on them, answer any unansweredQuestions in your summary, then call ' +
      'end_review). { type: "review_ended" } means the review is over; stop ' +
      'looping. If idleSeconds passes ~600, the reviewer is likely away: ' +
      'give the user the review url, stop looping, and resume when they say ' +
      'they are back.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: SESSION_ID_PROPERTY,
        timeoutSeconds: {
          type: 'number',
          description:
            'How long to wait before no_activity (default 20, max 25).',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'answer_question',
    description:
      "Answer a reviewer's question about a hunk, from your own knowledge of " +
      'why you made the change. The answer appears in the review UI.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: SESSION_ID_PROPERTY,
        questionId: {
          type: 'string',
          description: 'The questionId from the wait_for_activity question.',
        },
        answer: {
          type: 'string',
          description: 'Your reply, shown under the question in the review UI.',
        },
      },
      required: ['sessionId', 'questionId', 'answer'],
    },
  },
  {
    name: 'end_review',
    description:
      'Finish the review: tells the browser you are acting on it and closes ' +
      'the review server. diffmate never changes files — applying the ' +
      'feedback is up to you.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: SESSION_ID_PROPERTY,
        reason: {
          type: 'string',
          description: 'Shown to the reviewer, e.g. "Applying your feedback".',
        },
      },
      required: ['sessionId'],
    },
  },
] as const

export function createMcpServer(
  controller: SessionController,
  deps: McpDeps,
): Server {
  const server = new Server(
    { name: 'diffmate', version: '0.2.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...TOOLS],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const input = toRecord(request.params.arguments)
    switch (request.params.name) {
      case 'start_review':
        return toolResult(
          await controller.start(parseStartReviewArgs(input), deps),
        )
      case 'wait_for_activity':
        return toolResult(
          await controller.waitForActivity(parseWaitForActivityArgs(input)),
        )
      case 'answer_question':
        return toolResult(
          controller.answerQuestion(parseAnswerQuestionArgs(input)),
        )
      case 'end_review':
        return toolResult(await controller.endReview(parseEndReviewArgs(input)))
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`,
        )
    }
  })

  return server
}

function toRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  if (typeof value !== 'string' || !value) {
    throw new McpError(ErrorCode.InvalidParams, `${key} is required`)
  }
  return value
}

function parseStartReviewArgs(input: Record<string, unknown>): StartReviewArgs {
  const args: StartReviewArgs = {}
  if (typeof input.base === 'string') args.base = input.base
  if (typeof input.staged === 'boolean') args.staged = input.staged
  if (typeof input.title === 'string') args.title = input.title
  if (typeof input.summary === 'string') args.summary = input.summary
  if (Array.isArray(input.hunkSummaries)) {
    args.hunkSummaries = input.hunkSummaries
  }
  return args
}

function parseWaitForActivityArgs(
  input: Record<string, unknown>,
): WaitForActivityArgs {
  const args: WaitForActivityArgs = {
    sessionId: requireString(input, 'sessionId'),
  }
  if (typeof input.timeoutSeconds === 'number') {
    args.timeoutSeconds = input.timeoutSeconds
  }
  return args
}

function parseAnswerQuestionArgs(
  input: Record<string, unknown>,
): AnswerQuestionArgs {
  return {
    sessionId: requireString(input, 'sessionId'),
    questionId: requireString(input, 'questionId'),
    answer: requireString(input, 'answer'),
  }
}

function parseEndReviewArgs(input: Record<string, unknown>): EndReviewArgs {
  const args: EndReviewArgs = { sessionId: requireString(input, 'sessionId') }
  if (typeof input.reason === 'string') args.reason = input.reason
  return args
}

// Every tool result is a plain JSON object, which is what structuredContent
// carries; the cast only drops the specific result type.
function toolResult(result: object): CallToolResult {
  const text: TextContent = {
    type: 'text',
    text: JSON.stringify(result, null, 2),
  }
  return {
    content: [text],
    structuredContent: result as Record<string, unknown>,
  }
}

export async function runMcpServer(): Promise<void> {
  const controller = new SessionController()
  const deps: McpDeps = {
    uiDir: defaultUiDir(),
    openBrowser,
  }
  const server = createMcpServer(controller, deps)
  const transport = new StdioServerTransport()

  await server.connect(transport)
  // Keep the process alive until the client closes the stdio pipe (Claude
  // Code tears the MCP process down with the session).
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve()
  })
  await controller.close()
}
