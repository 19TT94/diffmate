import { readFile } from 'node:fs/promises'

// Engine
import type { HunkSummaryInput } from '../src/engine/session.js'

export interface DemoArgs {
  repo: string | null
  title: string | null
  summary: string | null
  mcp: boolean
  // Path to a JSON file of per-hunk summaries.
  hunkSummaries: string | null
}

export class DemoArgError extends Error {}

export const DEMO_USAGE = `Usage: diffmate-demo [dir] [--title <text>] [--summary <text>]
                     [--hunk-summaries <file>] [--mcp]

Review a repo's working-tree diff in the browser UI (demo stand-in).

Arguments:
  dir                  Repo directory to review (default: current directory)

Options:
  --title <text>       Agent-style title shown in the review UI
  --summary <text>     Agent-style summary shown in the review UI
  --hunk-summaries <file>
                       JSON array of { path, hunk, summary }: per-hunk
                       explanations (hunk is the 1-based position within the
                       file, in git diff order)
  --mcp                Drive the review through a real \`diffmate mcp\` process
                       with a scripted stand-in agent that answers questions
`

function readOptionValue(
  argv: string[],
  i: number,
  flag: string,
  inline: string | null,
): { value: string; nextIndex: number } {
  if (inline !== null) {
    if (!inline) throw new DemoArgError(`Missing value for ${flag}`)
    return { value: inline, nextIndex: i }
  }
  const value = argv[i + 1]
  if (value === undefined || value.startsWith('-')) {
    throw new DemoArgError(`Missing value for ${flag}`)
  }
  return { value, nextIndex: i + 1 }
}

export function parseDemoArgs(argv: string[]): DemoArgs {
  const args: DemoArgs = {
    repo: null,
    title: null,
    summary: null,
    mcp: false,
    hunkSummaries: null,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!

    if (arg === '--hunk-summaries' || arg.startsWith('--hunk-summaries=')) {
      const inline = arg.startsWith('--hunk-summaries=')
        ? arg.slice('--hunk-summaries='.length)
        : null
      const { value, nextIndex } = readOptionValue(
        argv,
        i,
        '--hunk-summaries',
        inline,
      )
      args.hunkSummaries = value
      i = nextIndex
      continue
    }

    if (arg === '--title' || arg.startsWith('--title=')) {
      const inline = arg.startsWith('--title=')
        ? arg.slice('--title='.length)
        : null
      const { value, nextIndex } = readOptionValue(argv, i, '--title', inline)
      args.title = value
      i = nextIndex
      continue
    }
    if (arg === '--summary' || arg.startsWith('--summary=')) {
      const inline = arg.startsWith('--summary=')
        ? arg.slice('--summary='.length)
        : null
      const { value, nextIndex } = readOptionValue(argv, i, '--summary', inline)
      args.summary = value
      i = nextIndex
      continue
    }
    if (arg === '--mcp') {
      args.mcp = true
      continue
    }
    if (arg.startsWith('-')) {
      throw new DemoArgError(`Unknown option: ${arg}`)
    }
    if (args.repo !== null) {
      throw new DemoArgError(`Unexpected argument: ${arg}`)
    }
    args.repo = arg
  }

  return args
}

// Reads --hunk-summaries' file. Entries are passed through as-is; the
// session reports any that match no hunk.
export async function loadHunkSummaries(
  file: string,
): Promise<HunkSummaryInput[]> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch {
    throw new DemoArgError(`Can't read hunk summaries file: ${file}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new DemoArgError(`Hunk summaries file isn't valid JSON: ${file}`)
  }
  if (!Array.isArray(parsed)) {
    throw new DemoArgError(`Hunk summaries file must be a JSON array: ${file}`)
  }
  // Trusted demo input; the session tolerates entries that match nothing.
  return parsed as HunkSummaryInput[]
}
