// Types
import type { ReviewFile } from '../types'

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
