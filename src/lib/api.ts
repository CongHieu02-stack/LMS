// ============================================================================
// lib/api.ts — HTTP Client wrapper cho Backend API
// Trách nhiệm DUY NHẤT: Gửi HTTP requests tới backend /api/* với Bearer token.
// KHÔNG chứa logic nghiệp vụ, không xử lý UI.
// ============================================================================

import { supabase } from './supabase'

const API_BASE = '/api'

/**
 * Lấy access token hiện tại từ Supabase session
 */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/**
 * Fetch wrapper tự động gắn Bearer token + xử lý JSON
 * @param endpoint — Đường dẫn API (vd: '/auth/me', '/classes')
 * @param options — Fetch options (method, body, ...)
 * @returns — Parsed JSON response
 */
export async function api<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Lỗi HTTP ${response.status}`)
  }

  return data as T
}

/**
 * Shorthand cho GET request
 */
export function apiGet<T = unknown>(endpoint: string): Promise<T> {
  return api<T>(endpoint, { method: 'GET' })
}

/**
 * Shorthand cho POST request
 */
export function apiPost<T = unknown>(endpoint: string, body: unknown): Promise<T> {
  return api<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

/**
 * Shorthand cho PUT request
 */
export function apiPut<T = unknown>(endpoint: string, body: unknown): Promise<T> {
  return api<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

/**
 * Shorthand cho DELETE request
 */
export function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  return api<T>(endpoint, { method: 'DELETE' })
}
