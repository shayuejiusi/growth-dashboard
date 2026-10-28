import { ApiError, parseApiResponse } from "./errors"
import type { ApiOptions } from "./types"

let cachedCsrfToken: string | null = null
let csrfRequest: Promise<string> | null = null
let unauthorizedEmitted = false
let sessionVersion = 0

export function advanceAuthSession() {
  sessionVersion += 1
  clearCsrfToken()
}

function assertCurrentSession(requestVersion: number, path: string) {
  if (requestVersion !== sessionVersion) {
    throw new ApiError(0, "会话已切换，已忽略旧账号响应", { code: "STALE_SESSION", path })
  }
}

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

  const requestVersion = sessionVersion
  const request = fetch("/api/auth/csrf", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  }).then(async (response) => {
    assertCurrentSession(requestVersion, "/api/auth/csrf")
    if (response.status === 401) emitUnauthorized()
    const data = await parseApiResponse<{ csrfToken?: string } | undefined>(response, "/api/auth/csrf")
    assertCurrentSession(requestVersion, "/api/auth/csrf")
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
    if (csrfRequest === request) csrfRequest = null
  })
  csrfRequest = request

  return request
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

async function requestApi(path: string, options: ApiOptions) {
  const requestVersion = sessionVersion
  const method = options.method ?? "GET"
  const headers: Record<string, string> = { Accept: "application/json" }
  const nativeBody = options.body !== undefined && isNativeBody(options.body)
  if (options.body !== undefined && !nativeBody) headers["Content-Type"] = "application/json"
  if (method !== "GET" && !options.skipCsrf) {
    headers["X-CSRF-TOKEN"] = await csrfToken()
    assertCurrentSession(requestVersion, path)
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
    body: options.body === undefined ? undefined : isNativeBody(options.body) ? options.body : JSON.stringify(options.body),
  })
  assertCurrentSession(requestVersion, path)
  if (response.status === 401 && !options.skipUnauthorizedEvent) emitUnauthorized()
  return { response, requestVersion }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { response, requestVersion } = await requestApi(path, options)
  const data = await parseApiResponse<T>(response, path)
  assertCurrentSession(requestVersion, path)
  return data
}

export async function apiBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const { response, requestVersion } = await requestApi(path, { signal })
  if (!response.ok) {
    await parseApiResponse(response, path)
    throw new ApiError(response.status, "下载失败", { path })
  }
  const data = await response.blob()
  assertCurrentSession(requestVersion, path)
  return data
}
