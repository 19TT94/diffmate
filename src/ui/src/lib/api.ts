// Types
import type {
  HunkStatus,
  ReviewSessionSummary,
  Settings,
  SettingsPatch,
} from '../types'

const TOKEN = new URLSearchParams(window.location.search).get('token') ?? ''

// Only /api/* is token-gated on the server; the static shell that loads
// this file has no user data in it. See engine/httpServer.ts.
function apiUrl(pathname: string): string {
  const sep = pathname.includes('?') ? '&' : '?'
  return `${pathname}${sep}token=${encodeURIComponent(TOKEN)}`
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

export function setHunkEditedContent(
  hunkId: string,
  editedContent: string | null,
): Promise<void> {
  return apiFetch(`/api/hunks/${encodeURIComponent(hunkId)}/edit`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ editedContent }),
  })
}

export function fetchFileContent(path: string): Promise<{ content: string }> {
  return apiFetch(`/api/files/content?path=${encodeURIComponent(path)}`)
}

// A null hunkId asks about the whole review. Returns once the question is
// queued for the agent, not when it's answered (that arrives over SSE).
export async function askQuestion(
  hunkId: string | null,
  text: string,
): Promise<void> {
  await apiFetch('/api/questions', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(hunkId === null ? { text } : { hunkId, text }),
  })
}

export function fetchSettings(): Promise<Settings> {
  return apiFetch('/api/settings')
}

export function patchSettings(patch: SettingsPatch): Promise<Settings> {
  return apiFetch('/api/settings', {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(patch),
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
  'review_ended',
] as const

export function connectEvents(onEvent: () => void): EventSource {
  const source = new EventSource(apiUrl('/api/events'))
  for (const type of SSE_EVENTS) {
    source.addEventListener(type, onEvent)
  }
  return source
}
