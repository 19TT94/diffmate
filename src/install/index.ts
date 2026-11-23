import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Install
import { renderSkill, SKILL_NAME } from './skill.js'
import type { InstallClient } from './skill.js'

export type { InstallClient } from './skill.js'

export const INSTALL_CLIENTS: InstallClient[] = ['claude', 'cursor']

const MCP_ENTRY = { command: 'npx', args: ['diffmate', 'mcp'] }

const TARGETS: Record<InstallClient, { mcpConfig: string; skill: string }> = {
  claude: {
    mcpConfig: '.mcp.json',
    skill: path.join('.claude', 'skills', SKILL_NAME, 'SKILL.md'),
  },
  cursor: {
    mcpConfig: path.join('.cursor', 'mcp.json'),
    skill: path.join('.cursor', 'skills', SKILL_NAME, 'SKILL.md'),
  },
}

async function readConfig(
  file: string,
  label: string,
): Promise<Record<string, unknown>> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${label} is not valid JSON; fix it and run install again`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `${label} is not a JSON object; fix it and run install again`,
    )
  }
  return parsed as Record<string, unknown>
}

// Adds or replaces only the diffmate server, keeping every other key.
function withDiffmate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const servers = config.mcpServers
  const existing =
    typeof servers === 'object' && servers !== null && !Array.isArray(servers)
      ? servers
      : {}
  return { ...config, mcpServers: { ...existing, diffmate: MCP_ENTRY } }
}

// `diffmate install`: writes the MCP config entry and the diffmate-review
// skill into `projectDir` for each client (both when `client` is null).
// Every existing config is read and checked before anything is written, so
// a broken one leaves the project untouched.
export async function install(
  projectDir: string,
  client: InstallClient | null,
  stdout: (text: string) => void,
): Promise<void> {
  const clients = client ? [client] : INSTALL_CLIENTS
  const writes: { file: string; content: string }[] = []
  for (const name of clients) {
    const target = TARGETS[name]
    const config = await readConfig(
      path.join(projectDir, target.mcpConfig),
      target.mcpConfig,
    )
    writes.push(
      {
        file: target.mcpConfig,
        content: `${JSON.stringify(withDiffmate(config), null, 2)}\n`,
      },
      { file: target.skill, content: renderSkill(name) },
    )
  }

  for (const { file, content } of writes) {
    const absPath = path.join(projectDir, file)
    await mkdir(path.dirname(absPath), { recursive: true })
    await writeFile(absPath, content)
    stdout(`Wrote ${file}\n`)
  }
}
