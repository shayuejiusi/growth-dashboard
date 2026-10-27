import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearCsrfToken, resetUnauthorized } from "@/lib/api/client"
import App from "./App"

const admin = { username: "admin", name: "系统管理员", level: 1 }
const manager = { username: "manager", name: "内容经理", level: 2 }
const staff = { username: "staff", name: "普通成员", level: 3 }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function mockAuthenticated(user: typeof admin) {
  const stats = { total: 0, open: 0, overdue: 0, highPriority: 0, todayDue: 0, completedTotal: 0, completionRate: 0, needReport: 0 }
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    switch (String(input)) {
      case "/api/auth/me": return jsonResponse(user)
      case "/api/dashboard": return jsonResponse({ generatedAt: "2026-10-27 10:00", stats, top3: [], focusNow: "先录入今日任务" })
      case "/api/reminders": return jsonResponse({
        generatedAt: "2026-10-27 10:00", phase: "早间检查", stats, focusNow: "暂无待处理提醒", scripts: [],
        reminders: { todayDue: [], overdue: [], highPriority: [], needReport: [], recurring: [] },
      })
      case "/api/ai/status": return jsonResponse({ remoteConfigured: false, provider: "本地规则引擎", hint: "" })
      default: return jsonResponse({ message: "未 mock 的接口" }, 500)
    }
  })
}

describe("认证与路由", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/dashboard")
    localStorage.clear()
    clearCsrfToken()
    resetUnauthorized()
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("未登录时进入中文登录页，且不渲染能力入口", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "未登录" }, 401))
    const { container } = render(<App />)

    expect(await screen.findByRole("heading", { name: "欢迎回来" })).toBeInTheDocument()
    expect(screen.getByLabelText("用户名")).toBeInTheDocument()
    expect(screen.getByLabelText("密码")).toBeInTheDocument()
    expect(container).not.toHaveTextContent("能力成长")
    expect(container).not.toHaveTextContent("能力评估")
  })

  it("登录成功后恢复原路径、查询参数和 hash", async () => {
    window.history.replaceState({}, "", "/tasks?filter=today#upcoming")
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: "未登录" }, 401))
      .mockResolvedValueOnce(jsonResponse(admin))
      .mockResolvedValueOnce(jsonResponse([]))
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText("用户名"), "admin")
    await user.type(screen.getByLabelText("密码"), "admin123")
    await user.click(screen.getByRole("button", { name: "登录" }))

    expect(await screen.findByRole("heading", { name: "任务管理" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/tasks")
    expect(window.location.search).toBe("?filter=today")
    expect(window.location.hash).toBe("#upcoming")
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it("登录失败显示系统错误提醒并保留表单上下文", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: "未登录" }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: "用户名或密码错误" }, 401))
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText("用户名"), "admin")
    await user.type(screen.getByLabelText("密码"), "wrong")
    await user.click(screen.getByRole("button", { name: "登录" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("用户名或密码错误")
    expect(screen.getByLabelText("用户名")).toHaveValue("admin")
  })

  it.each([
    ["/dashboard", "工作台"],
    ["/tasks", "任务管理"],
    ["/reminders", "提醒中心"],
    ["/content", "每日精选"],
    ["/admin/users", "账号管理"],
    ["/review", "工作复盘"],
    ["/talent", "人才筛选"],
  ])("一级权限可以访问 %s", async (path, heading) => {
    window.history.replaceState({}, "", path)
    mockAuthenticated(admin)
    render(<App />)

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument()
  })

  it.each(["/content", "/admin/users", "/review", "/talent"])(
    "三级权限不能通过直接地址访问 %s",
    async (path) => {
      window.history.replaceState({}, "", path)
      mockAuthenticated(staff)
      render(<App />)

      expect(await screen.findByRole("alert")).toHaveTextContent("没有访问权限")
      expect(screen.getByRole("heading", { name: "工作台" })).toBeInTheDocument()
    },
  )

  it.each(["/admin/users", "/review", "/talent"])(
    "二级权限不能通过直接地址访问一级路由 %s",
    async (path) => {
      window.history.replaceState({}, "", path)
      mockAuthenticated(manager)
      render(<App />)

      expect(await screen.findByRole("alert")).toHaveTextContent("没有访问权限")
      expect(screen.getByRole("heading", { name: "工作台" })).toBeInTheDocument()
    },
  )

  it("已登录会话失效时清空会话并返回登录页", async () => {
    mockAuthenticated(admin)
    render(<App />)
    await screen.findByRole("heading", { name: "工作台" })

    act(() => {
      window.dispatchEvent(new Event("auth:unauthorized"))
    })

    expect(await screen.findByRole("heading", { name: "欢迎回来" })).toBeInTheDocument()
  })

  it("登出携带 CSRF、清理会话并返回登录页", async () => {
    mockAuthenticated(admin)
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      switch (String(input)) {
        case "/api/auth/me": return jsonResponse(admin)
        case "/api/auth/csrf": return jsonResponse({ csrfToken: "logout-csrf" })
        case "/api/auth/logout": return jsonResponse({ ok: true })
        case "/api/dashboard": return jsonResponse({ generatedAt: "2026-10-27 10:00", stats: { total: 0, open: 0, overdue: 0, highPriority: 0, todayDue: 0, completedTotal: 0, completionRate: 0, needReport: 0 }, top3: [], focusNow: "先录入今日任务" })
        case "/api/ai/status": return jsonResponse({ remoteConfigured: false, provider: "本地规则引擎", hint: "" })
        default: return jsonResponse({}, 500)
      }
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole("heading", { name: "工作台" })

    await user.click(screen.getByRole("button", { name: "打开用户菜单" }))
    await user.click(screen.getByRole("menuitem", { name: "退出登录" }))

    expect(await screen.findByRole("heading", { name: "欢迎回来" })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(5)
    expect(fetch).toHaveBeenNthCalledWith(4, "/api/auth/csrf", expect.objectContaining({ credentials: "include" }))
    expect(fetch).toHaveBeenLastCalledWith("/api/auth/logout", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "logout-csrf" }),
    }))
  })

  it("未知及能力相关地址不暴露后续模块", async () => {
    window.history.replaceState({}, "", "/capability/assessment")
    mockAuthenticated(admin)
    const { container } = render(<App />)

    expect(await screen.findByRole("heading", { name: "工作台" })).toBeInTheDocument()
    expect(container).not.toHaveTextContent("能力评估")
  })
})
