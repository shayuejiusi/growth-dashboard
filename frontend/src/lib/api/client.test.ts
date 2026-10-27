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
})
