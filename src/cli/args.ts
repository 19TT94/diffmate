// Engine
import type { DiffScope } from '../engine/git.js'

export type Subcommand = 'review' | 'mcp' | 'install'

export interface CliArgs {
  subcommand: Subcommand
  dir: string
  scope: DiffScope
  json: boolean
  help: boolean
}

export class CliArgError extends Error {}

const SUBCOMMANDS: Subcommand[] = ['review', 'mcp', 'install']

export const USAGE = `Usage: diffmate [review] [dir] [--staged | --base <ref>] [--json]

Review the current repo's changes in a local browser UI.

Arguments:
  review               Review the current repo (default)
  dir                  Repo directory to review (default: current directory)

Options:
  --staged             Review staged changes only
  --base <ref>         Review changes since <ref> (merge-base semantics)
  --json               Print the report as JSON instead of markdown
  -h, --help           Show this help
`

const HELP_FLAGS = new Set(['-h', '--help'])

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    subcommand: 'review',
    dir: process.cwd(),
    scope: {},
    json: false,
    help: false,
  }
  const positionals: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!

    if (HELP_FLAGS.has(arg)) {
      args.help = true
      continue
    }
    if (arg === '--json') {
      args.json = true
      continue
    }
    if (arg === '--staged') {
      if (args.scope.base) {
        throw new CliArgError('Cannot combine --staged and --base')
      }
      args.scope.staged = true
      continue
    }
    if (arg === '--base' || arg.startsWith('--base=')) {
      if (args.scope.staged) {
        throw new CliArgError('Cannot combine --staged and --base')
      }
      let ref: string
      if (arg === '--base') {
        const value = argv[++i]
        if (value === undefined || value.startsWith('-')) {
          throw new CliArgError('Missing value for --base')
        }
        ref = value
      } else {
        ref = arg.slice('--base='.length)
      }
      if (!ref) throw new CliArgError('Missing value for --base')
      args.scope.base = ref
      continue
    }
    if (arg === '--') {
      for (const rest of argv.slice(i + 1)) positionals.push(rest)
      break
    }
    if (arg.startsWith('-')) {
      throw new CliArgError(`Unknown flag: ${arg}`)
    }
    positionals.push(arg)
  }

  if (positionals.length === 0) return args

  const first = positionals[0]!
  const isSubcommand = SUBCOMMANDS.includes(first as Subcommand)
  if (isSubcommand) {
    args.subcommand = first as Subcommand
    if (positionals.length > 2) {
      throw new CliArgError(`Unexpected argument: ${positionals[2]}`)
    }
    if (positionals[1]) args.dir = positionals[1]!
  } else if (positionals.length > 1) {
    throw new CliArgError(`Unexpected argument: ${positionals[1]}`)
  } else {
    args.dir = first
  }

  return args
}
