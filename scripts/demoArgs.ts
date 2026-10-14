export interface DemoArgs {
  repo: string | null
  title: string | null
  summary: string | null
}

export class DemoArgError extends Error {}

export const DEMO_USAGE = `Usage: diffmate-demo [dir] [--title <text>] [--summary <text>]

Review a repo's working-tree diff in the browser UI (demo stand-in).

Arguments:
  dir                  Repo directory to review (default: current directory)

Options:
  --title <text>       Agent-style title shown in the review UI
  --summary <text>     Agent-style summary shown in the review UI
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
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!

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
