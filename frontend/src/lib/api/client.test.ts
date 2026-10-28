import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, clearCsrfToken, resetUnauthorized } from "./client"
import { ApiError } from "./errors"

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  })
}

describe("API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
    clearCsrfToken()
    resetUnauthorized()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("adds csrf to writes and emits unauthorized once", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-1" }))
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: "t1" }, 201))

    await api("/api/tasks", { method: "POST", body: { title: "任务" } })

    expect(fetch).toHaveBeenLastCalledWith(
      "/api/tasks",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-1" }),
      }),
    )
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/tasks",
      expect.not.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.anything() }),
      }),
    )
  })

  it("sends FormData unchanged without manually setting Content-Type", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-file" }))
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ text: "正文" }))
    const body = new FormData()
    body.append("file", new File(["正文"], "notes.txt"))

    await api("/api/ai/extract-text", { method: "POST", body })

    expect(fetch).toHaveBeenLastCalledWith("/api/ai/extract-text", expect.objectContaining({
      body,
      headers: { Accept: "application/json", "X-CSRF-TOKEN": "csrf-file" },
    }))
  })

  it.each([
    ["Blob", () => new Blob(["raw"], { type: "application/octet-stream" })],
    ["ArrayBuffer", () => new TextEncoder().encode("raw").buffer],
    ["URLSearchParams", () => new URLSearchParams({ title: "任务" })],
  ])("sends native %s bodies unchanged without JSON headers", async (_label, createBody) => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-native" }))
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))
    const body = createBody()

    await api("/api/native-body", { method: "POST", body })

    expect(fetch).toHaveBeenLastCalledWith("/api/native-body", expect.objectContaining({
      body,
      headers: { Accept: "application/json", "X-CSRF-TOKEN": "csrf-native" },
    }))
  })

  it("uses cookies on reads without requesting a csrf token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: "t1" }))

    await expect(api("/api/tasks/t1")).resolves.toEqual({ id: "t1" })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith("/api/tasks/t1", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
      signal: undefined,
      body: undefined,
    })
  })

  it("shares one csrf request between concurrent writes", async () => {
    let resolveCsrf: ((response: Response) => void) | undefined
    vi.mocked(fetch)
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => { resolveCsrf = resolve }),
      )
      .mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })))

    const first = api("/api/tasks/1", { method: "PUT", body: { title: "一" } })
    const second = api("/api/tasks/2", { method: "DELETE" })
    resolveCsrf?.(jsonResponse({ csrfToken: "shared" }))
    await Promise.all([first, second])

    expect(vi.mocked(fetch).mock.calls.filter(([path]) => path === "/api/auth/csrf")).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith("/api/tasks/2", expect.objectContaining({
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "shared" }),
    }))
  })

  it("deduplicates unauthorized events from concurrent responses", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "未登录" }, 401))
    const listener = vi.fn()
    window.addEventListener("auth:unauthorized", listener)

    await Promise.allSettled([api("/api/auth/me"), api("/api/tasks")])
    window.removeEventListener("auth:unauthorized", listener)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("returns no content and preserves structured API errors", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(undefined, 204))
    await expect(api<void>("/api/tasks/1")).resolves.toBeUndefined()

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      status: 403,
      code: "FORBIDDEN",
      message: "没有权限",
      requestId: "req-1",
    }, 403))

    const error = await api("/api/admin/users").catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: "FORBIDDEN", message: "没有权限", requestId: "req-1" })
  })

  it("can log in without a pre-existing csrf token or redirect event", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ username: "admin" }))
    const listener = vi.fn()
    window.addEventListener("auth:unauthorized", listener)

    await api("/api/auth/login", {
      method: "POST",
      body: { username: "admin", password: "secret" },
      skipCsrf: true,
      skipUnauthorizedEvent: true,
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(listener).not.toHaveBeenCalled()
    window.removeEventListener("auth:unauthorized", listener)
  })

  it.each([200, 205])("returns undefined for an empty %s response", async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status }))

    await expect(api<void>("/api/tasks/empty")).resolves.toBeUndefined()
  })

  it("converts a non-JSON success response to a stable ApiError", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("plain text", {
      status: 200,
      headers: { "Content-Type": "text/plain", "X-Request-ID": "req-success" },
    }))

    const error = await api("/api/tasks").catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(SyntaxError)
    expect(error).toMatchObject({
      status: 200,
      code: "INVALID_RESPONSE",
      message: "服务器返回了无法解析的响应",
      requestId: "req-success",
      path: "/api/tasks",
    })
  })

  it("keeps a stable fallback for a non-JSON error response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("Bad Gateway", {
      status: 502,
      headers: { "Content-Type": "text/plain", "X-Request-ID": "req-error" },
    }))

    const error = await api("/api/tasks").catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 502,
      code: "HTTP_ERROR",
      message: "请求失败（502）",
      requestId: "req-error",
      path: "/api/tasks",
    })
  })

  it.each([
    ["null", null],
    ["primitive JSON", "invalid"],
    ["array", ["invalid"]],
  ])("uses a stable ApiError for a non-object JSON error body: %s", async (_label, body) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(body), {
      status: 502,
      headers: { "Content-Type": "application/json", "X-Request-ID": "req-shape" },
    }))

    const error = await api("/api/tasks").catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 502,
      code: "HTTP_ERROR",
      message: "请求失败（502）",
      requestId: "req-shape",
      path: "/api/tasks",
    })
  })

  it.each([
    ["network failure", () => Promise.reject(new TypeError("network offline"))],
    ["non-2xx response", () => Promise.resolve(jsonResponse({ message: "暂不可用" }, 503))],
    ["invalid response", () => Promise.resolve(jsonResponse({}))],
  ])("retries csrf after a %s instead of caching rejection", async (_label, firstAttempt) => {
    vi.mocked(fetch)
      .mockImplementationOnce(firstAttempt)
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "fresh-csrf" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(api("/api/tasks", { method: "POST", body: { title: "一" } })).rejects.toThrow()
    await expect(api("/api/tasks", { method: "POST", body: { title: "二" } })).resolves.toEqual({ ok: true })

    expect(vi.mocked(fetch).mock.calls.filter(([path]) => path === "/api/auth/csrf")).toHaveLength(2)
    expect(fetch).toHaveBeenLastCalledWith("/api/tasks", expect.objectContaining({
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "fresh-csrf" }),
    }))
  })

  it("surfaces csrf endpoint 401 and emits one unauthorized event without writing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: "会话已过期" }, 401))
    const listener = vi.fn()
    window.addEventListener("auth:unauthorized", listener)

    const error = await api("/api/tasks", { method: "POST", body: { title: "任务" } })
      .catch((reason: unknown) => reason)
    window.removeEventListener("auth:unauthorized", listener)

    expect(error).toMatchObject({ status: 401, message: "会话已过期" })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith("/api/auth/csrf", expect.objectContaining({ credentials: "include" }))
  })
})
