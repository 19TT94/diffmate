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
import type { McpDeps, StartReviewArgs, StartReviewResult } from './tools.js'

const START_REVIEW_TOOL = {
  name: 'start_review',
  description:
    'Start a diffmate review of the current repo and open it in the browser ' +
    'for the user to approve or reject each hunk. Returns the session id and ' +
    'review URL immediately; the review runs in the browser until the user ' +
    'submits it. Only one review can be active at a time.',
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
    },
  },
} as const

export function createMcpServer(
  controller: SessionController,
  deps: McpDeps,
): Server {
  const server = new Server(
    { name: 'diffmate', version: '0.2.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [START_REVIEW_TOOL],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'start_review') {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`,
      )
    }
    const result = await controller.start(
      parseStartReviewArgs(request.params.arguments),
      deps,
    )
    return toolResult(result)
  })

  return server
}

function parseStartReviewArgs(raw: unknown): StartReviewArgs {
  const input =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const args: StartReviewArgs = {}
  if (typeof input.base === 'string') args.base = input.base
  if (typeof input.staged === 'boolean') args.staged = input.staged
  if (typeof input.title === 'string') args.title = input.title
  if (typeof input.summary === 'string') args.summary = input.summary
  return args
}

function toolResult(result: StartReviewResult): CallToolResult {
  const text: TextContent = {
    type: 'text',
    text: JSON.stringify(result, null, 2),
  }
  return {
    content: [text],
    structuredContent: result as unknown as Record<string, unknown>,
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
}
