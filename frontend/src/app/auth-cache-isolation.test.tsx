import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import App from "@/App"
import { clearCsrfToken, resetUnauthorized } from "@/lib/api/client"

const admin = { username: "admin", name: "系统管理员", level: 1 } as const
const staff = { username: "staff", name: "普通成员", level: 3 } as const
const accountA = { username: "account-a", name: "账号 A", level: 1 } as const
const accountB = { username: "account-b", name: "账号 B", level: 1 } as const
const managerA = { username: "manager-a", name: "经理 A", level: 2 } as const
const managerB = { username: "manager-b", name: "经理 B", level: 2 } as const
type TestUser = typeof admin | typeof staff | typeof accountA | typeof accountB | typeof managerA | typeof managerB

const stats = { total: 0, open: 0, overdue: 0, highPriority: 0, todayDue: 0, completedTotal: 0, completionRate: 0, needReport: 0 }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function dashboard(user: TestUser) {
  return jsonResponse({ generatedAt: "2026-10-28 10:00", stats, top3: [], focusNow: `${user.username} 的私密焦点` })
}

function content(user: TestUser) {
  return jsonResponse({
    date: "2026-10-28",
    articles: [{ title: `${user.username} 的私密文章`, url: "https://example.com/article", source: "示例媒体", points: [], action: "" }],
    videos: [],
    notice: "",
  })
}

function installAuthHandlers(current: { user: TestUser | null }) {
  return (path: string, init?: RequestInit) => {
    if (path === "/api/auth/me") return current.user ? jsonResponse(current.user) : jsonResponse({ message: "未登录" }, 401)
    if (path === "/api/auth/login") {
      const username = (JSON.parse(String(init?.body)) as { username: string }).username
      current.user = [admin, staff, accountA, accountB, managerA, managerB].find((user) => user.username === username) ?? null
      return current.user ? jsonResponse(current.user) : jsonResponse({ message: "用户名或密码错误" }, 401)
    }
    if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "test-csrf" })
    if (path === "/api/auth/logout") {
      current.user = null
      return jsonResponse({ ok: true })
    }
    return null
  }
}

async function login(user: TestUser) {
  const userEventInstance = userEvent.setup()
  await userEventInstance.type(await screen.findByLabelText("用户名"), user.username)
  await userEventInstance.type(screen.getByLabelText("密码"), "secret")
  await userEventInstance.click(screen.getByRole("button", { name: "登录" }))
}

async function logout() {
  const userEventInstance = userEvent.setup()
  await userEventInstance.click(screen.getByRole("button", { name: "打开用户菜单" }))
  await userEventInstance.click(screen.getByRole("menuitem", { name: "退出登录" }))
  await screen.findByRole("heading", { name: "欢迎回来" })
}

async function verifyDashboardSwitch(from: TestUser, to: TestUser) {
  const current: { user: TestUser | null } = { user: from }
  const handleAuth = installAuthHandlers(current)
  let dashboardRequests = 0
  let resolveTarget!: (response: Response) => void
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const authResponse = handleAuth(path, init)
    if (authResponse) return Promise.resolve(authResponse)
    if (path === "/api/ai/status") return Promise.resolve(jsonResponse({ remoteConfigured: false, provider: "本地规则引擎", hint: "" }))
    if (path === "/api/dashboard") {
      dashboardRequests += 1
      if (dashboardRequests === 1) return Promise.resolve(dashboard(from))
      return new Promise<Response>((resolve) => { resolveTarget = resolve })
    }
    return Promise.resolve(jsonResponse({ message: `未 mock 的接口：${path}` }, 500))
  })
  render(<App />)
  expect(await screen.findByText(`${from.username} 的私密焦点`)).toBeVisible()

  await logout()
  await login(to)
  await screen.findByText(`你好，${to.name}`)

  expect(screen.queryByText(`${from.username} 的私密焦点`)).not.toBeInTheDocument()
  expect(dashboardRequests).toBe(2)
  resolveTarget(dashboard(to))
  expect(await screen.findByText(`${to.username} 的私密焦点`)).toBeVisible()
  expect(screen.queryByText(`${from.username} 的私密焦点`)).not.toBeInTheDocument()
}

describe("认证会话业务缓存隔离", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/dashboard")
    localStorage.clear()
    clearCsrfToken()
    resetUnauthorized()
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("管理员切换到三级账号时取消并清除旧角色业务数据，重新请求", async () => {
    await verifyDashboardSwitch(admin, staff)
  })

  it("A 账号切换到 B 账号时任何时刻都不渲染 A 的缓存", async () => {
    await verifyDashboardSwitch(accountA, accountB)
  })

  it("换账号后 30 秒搜索缓存失效并重新请求，同账号缓存保持有效", async () => {
    const current: { user: TestUser | null } = { user: accountA }
    const handleAuth = installAuthHandlers(current)
    let searchRequests = 0
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      const authResponse = handleAuth(path, init)
      if (authResponse) return Promise.resolve(authResponse)
      if (path === "/api/ai/status") return Promise.resolve(jsonResponse({ remoteConfigured: false, provider: "本地规则引擎", hint: "" }))
      if (path === "/api/dashboard") return Promise.resolve(dashboard(current.user ?? accountA))
      if (path.startsWith("/api/search")) {
        searchRequests += 1
        const user = current.user ?? accountA
        return Promise.resolve(jsonResponse({
          tasks: [{ type: "task", id: user.username, title: `${user.username} 的搜索结果`, subtitle: "今天截止", path: `/tasks?focus=${user.username}` }],
          people: [],
          content: [],
        }))
      }
      return Promise.resolve(jsonResponse({ message: `未 mock 的接口：${path}` }, 500))
    })
    const userEventInstance = userEvent.setup()
    render(<App />)
    await screen.findByText("account-a 的私密焦点")

    await userEventInstance.click(screen.getByRole("button", { name: "搜索" }))
    await userEventInstance.type(screen.getByRole("combobox", { name: "全局搜索" }), "德")
    expect(await screen.findByRole("option", { name: /account-a 的搜索结果/ })).toBeVisible()
    expect(searchRequests).toBe(1)
    await userEventInstance.keyboard("{Escape}")
    await logout()
    await login(accountB)
    await screen.findByText("你好，账号 B")

    await userEventInstance.click(screen.getByRole("button", { name: "搜索" }))
    await userEventInstance.type(screen.getByRole("combobox", { name: "全局搜索" }), "德")
    expect(await screen.findByRole("option", { name: /account-b 的搜索结果/ })).toBeVisible()
    expect(screen.queryByText("account-a 的搜索结果")).not.toBeInTheDocument()
    expect(searchRequests).toBe(2)

    await userEventInstance.keyboard("{Escape}")
    await userEventInstance.click(screen.getByRole("button", { name: "搜索" }))
    await userEventInstance.type(screen.getByRole("combobox", { name: "全局搜索" }), "德")
    expect(await screen.findByRole("option", { name: /account-b 的搜索结果/ })).toBeVisible()
    await waitFor(() => expect(screen.getByRole("combobox", { name: "全局搜索" })).toHaveAttribute("aria-expanded", "true"))
    expect(searchRequests).toBe(2)
  })

  it("旧账号 mutation 晚到成功后不能写回新账号缓存", async () => {
    window.history.replaceState({}, "", "/tasks")
    const current: { user: TestUser | null } = { user: accountA }
    const handleAuth = installAuthHandlers(current)
    let taskRequests = 0
    let resolveOldMutation!: (response: Response) => void
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      const authResponse = handleAuth(path, init)
      if (authResponse) return Promise.resolve(authResponse)
      if (path === "/api/tasks" && (init?.method ?? "GET") === "GET") {
        taskRequests += 1
        return taskRequests <= 2 ? Promise.resolve(jsonResponse([])) : new Promise<Response>(() => undefined)
      }
      if (path === "/api/tasks" && init?.method === "POST") {
        return new Promise<Response>((resolve) => { resolveOldMutation = resolve })
      }
      return Promise.resolve(jsonResponse({ message: `未 mock 的接口：${path}` }, 500))
    })
    const userEventInstance = userEvent.setup()
    render(<App />)
    await screen.findByRole("heading", { name: "任务管理" })
    await userEventInstance.click(screen.getAllByRole("button", { name: "新建任务" })[1])
    await userEventInstance.type(await screen.findByLabelText("任务标题"), "账号 A 的晚到任务")
    await userEventInstance.click(screen.getByRole("button", { name: "保存任务" }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/tasks", expect.objectContaining({ method: "POST" })))

    act(() => { window.dispatchEvent(new Event("auth:unauthorized")) })
    await screen.findByRole("heading", { name: "欢迎回来" })
    await login(accountB)
    await screen.findByRole("heading", { name: "任务管理" })
    expect(screen.queryByText("账号 A 的晚到任务")).not.toBeInTheDocument()

    await act(async () => {
      resolveOldMutation(jsonResponse({
        id: "old-a-task",
        title: "账号 A 的晚到任务",
        priority: "P1",
        dueDate: null,
        status: "TODO",
        needReport: false,
        note: null,
        category: null,
        source: null,
        nextStep: null,
        expectedOutcome: null,
        blocker: null,
        repeatType: "NONE",
        position: 0,
        version: 0,
        createdAt: "2026-10-28T10:00:00",
        completedAt: null,
      }))
      await Promise.resolve()
    })
    expect(screen.queryByText("账号 A 的晚到任务")).not.toBeInTheDocument()
  })

  it("业务接口直接返回 401 时同步清理旧缓存，新会话重新请求", async () => {
    window.history.replaceState({}, "", "/content")
    const current: { user: TestUser | null } = { user: managerA }
    const handleAuth = installAuthHandlers(current)
    let contentRequests = 0
    let resolveTarget!: (response: Response) => void
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      const authResponse = handleAuth(path, init)
      if (authResponse) return Promise.resolve(authResponse)
      if (path === "/api/content/daily") {
        contentRequests += 1
        if (contentRequests === 1) return Promise.resolve(content(managerA))
        if (contentRequests === 2) {
          current.user = null
          return Promise.resolve(jsonResponse({ message: "会话已过期" }, 401))
        }
        return new Promise<Response>((resolve) => { resolveTarget = resolve })
      }
      return Promise.resolve(jsonResponse({ message: `未 mock 的接口：${path}` }, 500))
    })
    const userEventInstance = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole("link", { name: "manager-a 的私密文章" })).toBeVisible()

    await userEventInstance.click(screen.getByRole("button", { name: "刷新内容" }))
    await screen.findByRole("heading", { name: "欢迎回来" })
    await login(managerB)
    await screen.findByRole("heading", { name: "每日精选" })

    expect(screen.queryByRole("link", { name: "manager-a 的私密文章" })).not.toBeInTheDocument()
    expect(contentRequests).toBe(3)
    resolveTarget(content(managerB))
    expect(await screen.findByRole("link", { name: "manager-b 的私密文章" })).toBeVisible()
  })
})
