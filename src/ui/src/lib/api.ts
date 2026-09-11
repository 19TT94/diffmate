// Types
import type { HunkStatus, ReviewSessionSummary } from '../types'

const TOKEN = new URLSearchParams(window.location.search).get('token') ?? ''

// Only /api/* is token-gated on the server; the static shell that loads
// this file has no user data in it. See engine/httpServer.ts.
function apiUrl(pathname: string): string {
  return `${pathname}?token=${encodeURIComponent(TOKEN)}`
}

async function apiFetch<T>(
  pathname: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(pathname), options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.status === 204 ? (null as T) : res.json()
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function fetchSession(): Promise<ReviewSessionSummary> {
  return apiFetch('/api/session')
}

export function setHunkStatus(
  hunkId: string,
  status: HunkStatus,
): Promise<void> {
  return apiFetch(`/api/hunks/${encodeURIComponent(hunkId)}/status`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  })
}

export function setHunkComment(
  hunkId: string,
  comment: string | null,
): Promise<void> {
  return apiFetch(`/api/hunks/${encodeURIComponent(hunkId)}/comment`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ comment }),
  })
}

export function submitReview(): Promise<void> {
  return apiFetch('/api/submit', { method: 'POST' })
}

const SSE_EVENTS = [
  'hunk_updated',
  'question_asked',
  'question_answered',
  'review_complete',
] as const

export function connectEvents(onEvent: () => void): EventSource {
  const source = new EventSource(apiUrl('/api/events'))
  for (const type of SSE_EVENTS) {
    source.addEventListener(type, onEvent)
  }
  return source
}
