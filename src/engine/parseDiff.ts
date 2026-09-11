// Types
import type { FileStatus, Hunk, Line, ParsedFile } from './types.js'

const FILE_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*$/

export function parseDiff(diffText: string): ParsedFile[] {
  if (!diffText.trim()) return []

  return diffText
    .split(/^diff --git /m)
    .slice(1)
    .map((block) => parseFileBlock(`diff --git ${block}`))
}

function parseFileBlock(block: string): ParsedFile {
  const lines = block.split('\n')
  const headerMatch = lines[0]?.match(FILE_HEADER_RE)
  let filePath = headerMatch ? headerMatch[2] : 'unknown'
  let oldPath: string | null = null
  let status: FileStatus = 'modified'

  for (const line of lines) {
    // Submodule pointer bumps and symlink target changes aren't line-based
    // content diffs; flag them for the UI to skip rather than mis-rendering
    // a git-internal pointer as text.
    if (line.includes('Subproject commit') || line.includes('mode 120000')) {
      return {
        path: filePath,
        oldPath,
        status: 'unsupported',
        binary: false,
        hunks: [],
      }
    }

    if (line.startsWith('new file mode')) {
      status = 'added'
    } else if (line.startsWith('deleted file mode')) {
      status = 'deleted'
    } else if (line.startsWith('rename from ')) {
      oldPath = line.slice('rename from '.length)
      status = 'renamed'
    } else if (line.startsWith('rename to ')) {
      filePath = line.slice('rename to '.length)
    }
  }

  const binaryLine = lines.find(
    (line) => line.startsWith('Binary files ') && line.endsWith('differ'),
  )
  if (binaryLine) {
    return { path: filePath, oldPath, status, binary: true, hunks: [] }
  }

  const firstHunkIndex = lines.findIndex((line) => line.startsWith('@@'))
  const hunkLines = firstHunkIndex === -1 ? [] : lines.slice(firstHunkIndex)
  const hunks = parseHunks(hunkLines, filePath)

  return { path: filePath, oldPath, status, binary: false, hunks }
}

// Unified diff hunks already interleave removals then additions per change
// block, so before/after lines can be paired up positionally as they're
// read — no LCS/alignment algorithm is needed to build side-by-side columns.
function parseHunks(lines: string[], filePath: string): Hunk[] {
  const hunks: Hunk[] = []
  let current: Hunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    const headerMatch = line.match(HUNK_HEADER_RE)
    if (headerMatch) {
      const [, oldStartStr, oldLinesStr, newStartStr, newLinesStr] = headerMatch
      const oldStart = Number(oldStartStr)
      const newStart = Number(newStartStr)
      current = {
        // path + header is a stable-enough key across a single parse for
        // ReviewSession to address this hunk by id in REST/MCP calls.
        id: `${filePath}@@${line}`,
        header: line,
        oldStart,
        oldLines: oldLinesStr ? Number(oldLinesStr) : 1,
        newStart,
        newLines: newLinesStr ? Number(newLinesStr) : 1,
        lines: [],
      }
      hunks.push(current)
      oldLine = oldStart
      newLine = newStart
      continue
    }

    if (!current || line.length === 0 || line.startsWith('\\ No newline')) {
      continue
    }

    const marker = line[0]
    const content = line.slice(1)

    if (marker === '+') {
      current.lines.push({
        type: 'add',
        content,
        oldLineNumber: null,
        newLineNumber: newLine,
      })
      newLine++
    } else if (marker === '-') {
      current.lines.push({
        type: 'del',
        content,
        oldLineNumber: oldLine,
        newLineNumber: null,
      })
      oldLine++
    } else {
      current.lines.push({
        type: 'context',
        content,
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      })
      oldLine++
      newLine++
    }
  }

  return hunks
}

export function parseUntrackedFile(
  relPath: string,
  content: string,
): ParsedFile {
  const normalized = content.endsWith('\n') ? content.slice(0, -1) : content
  const contentLines = normalized.length === 0 ? [] : normalized.split('\n')
  const lines: Line[] = contentLines.map((text, index) => ({
    type: 'add',
    content: text,
    oldLineNumber: null,
    newLineNumber: index + 1,
  }))

  const hunk: Hunk = {
    id: `${relPath}@@untracked`,
    header: `@@ -0,0 +1,${lines.length} @@`,
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: lines.length,
    lines,
  }

  return {
    path: relPath,
    oldPath: null,
    status: 'added',
    binary: false,
    hunks: [hunk],
  }
}
