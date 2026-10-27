import { toApiError } from "./errors"
import type { ApiOptions } from "./types"

let cachedCsrfToken: string | null = null
let csrfRequest: Promise<string> | null = null
let unauthorizedEmitted = false

export function clearCsrfToken() {
  cachedCsrfToken = null
  csrfRequest = null
}

export function resetUnauthorized() {
  unauthorizedEmitted = false
}

function emitUnauthorized() {
  if (unauthorizedEmitted || typeof window === "undefined") return
  unauthorizedEmitted = true
  window.dispatchEvent(new Event("auth:unauthorized"))
}

async function csrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken
  if (csrfRequest) return csrfRequest

  csrfRequest = fetch("/api/auth/csrf", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  }).then(async (response) => {
    if (response.status === 401) emitUnauthorized()
    if (!response.ok) throw await toApiError(response)
    const data = await response.json() as { csrfToken?: string }
    if (!data.csrfToken) throw new Error("CSRF 响应缺少令牌")
    cachedCsrfToken = data.csrfToken
    return data.csrfToken
  }).finally(() => {
    csrfRequest = null
  })

  return csrfRequest
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? "GET"
  const headers: Record<string, string> = { Accept: "application/json" }
  if (options.body !== undefined) headers["Content-Type"] = "application/json"
  if (method !== "GET" && !options.skipCsrf) {
    headers["X-CSRF-TOKEN"] = await csrfToken()
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (response.status === 401 && !options.skipUnauthorizedEvent) emitUnauthorized()
  if (!response.ok) throw await toApiError(response)
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
