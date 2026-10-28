import { ApiError, parseApiResponse } from "./errors"
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
    const data = await parseApiResponse<{ csrfToken?: string } | undefined>(response, "/api/auth/csrf")
    if (!data?.csrfToken) {
      throw new ApiError(response.status, "CSRF 响应缺少有效令牌", {
        code: "INVALID_RESPONSE",
        requestId: response.headers.get("X-Request-ID") ?? undefined,
        path: "/api/auth/csrf",
      })
    }
    cachedCsrfToken = data.csrfToken
    return data.csrfToken
  }).finally(() => {
    csrfRequest = null
  })

  return csrfRequest
}

function isNativeBody(body: unknown): body is BodyInit {
  return typeof body === "string"
    || body instanceof Blob
    || body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof ArrayBuffer
    || Object.prototype.toString.call(body) === "[object ArrayBuffer]"
    || ArrayBuffer.isView(body)
    || (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? "GET"
  const headers: Record<string, string> = { Accept: "application/json" }
  const nativeBody = options.body !== undefined && isNativeBody(options.body)
  if (options.body !== undefined && !nativeBody) headers["Content-Type"] = "application/json"
  if (method !== "GET" && !options.skipCsrf) {
    headers["X-CSRF-TOKEN"] = await csrfToken()
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
    body: options.body === undefined ? undefined : isNativeBody(options.body) ? options.body : JSON.stringify(options.body),
  })
  if (response.status === 401 && !options.skipUnauthorizedEvent) emitUnauthorized()
  return parseApiResponse<T>(response, path)
}
