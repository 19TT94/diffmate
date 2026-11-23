// Utils
import { splitPath } from './summary'

// Types
import type { Question, ReviewFile } from '../types'

export function isOpen(question: Question): boolean {
  return question.answer === null
}

// Hunk ids with at least one unanswered question.
export function openQuestionHunkIds(questions: Question[]): Set<string> {
  return new Set(
    questions.flatMap((question) =>
      isOpen(question) && question.hunkId !== null ? [question.hunkId] : [],
    ),
  )
}

// Paths of files with an unanswered question about one of their hunks.
export function openQuestionPaths(
  files: ReviewFile[],
  questions: Question[],
): Set<string> {
  const hunkIds = openQuestionHunkIds(questions)
  return new Set(
    files
      .filter((file) => file.hunks.some((hunk) => hunkIds.has(hunk.id)))
      .map((file) => file.path),
  )
}

// "Page.js · hunk 2" for a question's tag; null if the hunk isn't found.
export function hunkLabel(files: ReviewFile[], hunkId: string): string | null {
  for (const file of files) {
    const index = file.hunks.findIndex((hunk) => hunk.id === hunkId)
    if (index !== -1) {
      return `${splitPath(file.path).name} · hunk ${index + 1}`
    }
  }
  return null
}
