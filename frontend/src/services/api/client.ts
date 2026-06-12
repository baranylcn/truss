import { supabase } from '../../lib/supabase'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

function buildHeaders(token: string | null, isFormData: boolean, extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

function parseError(res: Response, json: { error?: string; detail?: unknown } | null): Error {
  if (json) {
    const detail = Array.isArray(json.detail)
      ? (json.detail as { msg?: string }[]).map(d => d.msg ?? JSON.stringify(d)).join(', ')
      : json.detail
    return new Error(json.error ?? (detail as string) ?? `HTTP ${res.status}`)
  }
  return new Error(`HTTP ${res.status}: ${res.statusText || 'Server error'}`)
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData
  const extra = options.headers as Record<string, string> ?? {}

  let token = await getToken()
  let res = await fetch(`${BASE}${path}`, { ...options, headers: buildHeaders(token, isFormData, extra) })

  if (res.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) {
      await supabase.auth.signOut()
      throw new Error('Session expired. Please sign in again.')
    }
    token = data.session.access_token
    res = await fetch(`${BASE}${path}`, { ...options, headers: buildHeaders(token, isFormData, extra) })
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? ''
    const json = contentType.includes('application/json') ? await res.json().catch(() => null) : null
    throw parseError(res, json)
  }

  const json = await res.json().catch(() => null)
  return json as T
}

export async function apiFormDownload(path: string, body: FormData, filename: string): Promise<void> {
  let token = await getToken()
  let res = await fetch(`${BASE}${path}`, { method: 'POST', headers: buildHeaders(token, true), body })

  if (res.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) {
      await supabase.auth.signOut()
      throw new Error('Session expired. Please sign in again.')
    }
    token = data.session.access_token
    res = await fetch(`${BASE}${path}`, { method: 'POST', headers: buildHeaders(token, true), body })
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText || 'Upload failed'}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  let token = await getToken()
  let res = await fetch(`${BASE}${path}`, { headers: buildHeaders(token, false) })

  if (res.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) {
      await supabase.auth.signOut()
      throw new Error('Session expired. Please sign in again.')
    }
    token = data.session.access_token
    res = await fetch(`${BASE}${path}`, { headers: buildHeaders(token, false) })
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText || 'Export failed'}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
