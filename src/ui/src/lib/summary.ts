// Types
import type { Hunk, ReviewFile } from '../types'

export type FileBadgeStatus =
  'pending' | 'approved' | 'rejected' | 'mixed' | 'binary' | 'unsupported'

export function fileBadgeStatus(file: ReviewFile): FileBadgeStatus {
  if (file.binary) return 'binary'
  if (file.status === 'unsupported') return 'unsupported'
  if (file.hunks.length === 0) return 'pending'
  const statuses = new Set(file.hunks.map((hunk) => hunk.status))
  return statuses.size === 1 ? [...statuses][0]! : 'mixed'
}

export function fileLineStats(file: ReviewFile): { add: number; del: number } {
  let add = 0
  let del = 0
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') add++
      else if (line.type === 'del') del++
    }
  }
  return { add, del }
}

export function splitPath(path: string): { dir: string | null; name: string } {
  const lastSlash = path.lastIndexOf('/')
  return lastSlash === -1
    ? { dir: null, name: path }
    : { dir: path.slice(0, lastSlash + 1), name: path.slice(lastSlash + 1) }
}

export function reviewedCount(hunks: Hunk[]): number {
  return hunks.filter((hunk) => hunk.status !== 'pending').length
}
