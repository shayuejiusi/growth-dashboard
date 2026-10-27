import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { clearCsrfToken } from "@/lib/api/client"
import { DashboardPage } from "./DashboardPage"

const task = {
  id: "task-1",
  title: "完成讲话稿",
  priority: "P0",
  dueDate: "2026-10-27",
  status: "TODO",
  needReport: true,
  capabilities: ["不应展示的能力"],
  note: null,
  createdAt: "2026-10-26T09:00:00",
  completedAt: null,
  category: "行政",
  source: null,
  nextStep: null,
  expectedOutcome: null,
  blocker: null,
  repeatType: "NONE",
  position: 1,
  version: 0,
}

const dashboard = {
  generatedAt: "2026-10-27 10:00",
  stats: {
    total: 1,
    open: 1,
    overdue: 0,
    highPriority: 1,
    todayDue: 1,
    completedTotal: 0,
    completionRate: 0,
    needReport: 0,
  },
  top3: [task],
  focusNow: "先完成讲话稿",
  cockpitAssessment: { radar: [], summary: "能力评估不应展示" },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function mockApi(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    "/api/dashboard": dashboard,
    "/api/ai/status": { remoteConfigured: false, provider: "本地规则引擎", hint: "当前使用本地规则引擎。" },
    ...overrides,
  }
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path in responses) return jsonResponse(responses[path])
    return jsonResponse({ message: `未 mock 的接口：${path}` }, 500)
  }))
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
        <Toaster theme="light" />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe("驾驶舱", () => {
  beforeEach(() => {
    clearCsrfToken()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("渲染任务统计与 TOP3，彻底排除能力评估内容", async () => {
    mockApi()
    const { container } = renderPage()

    expect(await screen.findByRole("heading", { name: "今日最重要的 3 件事" })).toBeVisible()
    expect(screen.getByText("完成讲话稿")).toBeVisible()
    expect(screen.getByText("先完成讲话稿")).toBeVisible()
    expect(screen.getByText("今日待办")).toBeVisible()
    expect(screen.getByText("完成率")).toBeVisible()
    expect(screen.getByText("AI：本地规则引擎")).toBeVisible()
    expect(screen.getByText("数据更新于 2026-10-27 10:00")).toBeVisible()
    expect(container).not.toHaveTextContent("能力评估")
    expect(container).not.toHaveTextContent("能力成长")
    expect(container).not.toHaveTextContent("重新评估")
    expect(container).not.toHaveTextContent("不应展示的能力")
  })

  it("首次加载显示骨架屏与状态提示", async () => {
    mockApi()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/dashboard") return new Promise<Response>(() => undefined)
      return Promise.resolve(jsonResponse({ remoteConfigured: false, provider: "本地规则引擎", hint: "" }))
    })
    const { container } = renderPage()

    expect(await screen.findByText("正在加载驾驶舱")).toBeVisible()
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0)
  })

  it("任务数据失败时提供重试，成功后恢复内容", async () => {
    mockApi()
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path === "/api/dashboard" && vi.mocked(fetch).mock.calls.filter(([url]) => url === path).length === 1) {
        return jsonResponse({ message: "驾驶舱暂不可用" }, 500)
      }
      if (path === "/api/dashboard") return jsonResponse(dashboard)
      if (path === "/api/ai/status") return jsonResponse({ remoteConfigured: true, provider: "远程 AI", hint: "" })
      return jsonResponse({}, 500)
    })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("驾驶舱暂不可用")
    await user.click(screen.getByRole("button", { name: "重新加载" }))
    expect(await screen.findByText("完成讲话稿")).toBeVisible()
  })

  it("AI 状态失败不阻断任务数据，并可独立重试", async () => {
    mockApi()
    let aiAttempts = 0
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path === "/api/dashboard") return jsonResponse(dashboard)
      if (path === "/api/ai/status") {
        aiAttempts += 1
        return aiAttempts === 1
          ? jsonResponse({ message: "AI 状态不可用" }, 500)
          : jsonResponse({ remoteConfigured: false, provider: "本地规则引擎", hint: "" })
      }
      return jsonResponse({}, 500)
    })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText("完成讲话稿")).toBeVisible()
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("AI 状态暂时不可用"))).toBe(true)
    await user.click(screen.getByRole("button", { name: "重试 AI 状态" }))
    expect(await screen.findByText("AI：本地规则引擎")).toBeVisible()
    expect(screen.queryByText("AI 状态暂时不可用")).not.toBeInTheDocument()
  })

  it("无任务时展示统计零值与下一步空状态", async () => {
    mockApi({
      "/api/dashboard": {
        ...dashboard,
        stats: { ...dashboard.stats, total: 0, open: 0, highPriority: 0, todayDue: 0 },
        top3: [],
        focusNow: "先录入今日任务",
      },
    })
    renderPage()

    expect(await screen.findByText("今天还没有重点任务")).toBeVisible()
    expect(screen.getByText("前往任务管理，添加第一件需要推进的事。")).toBeVisible()
    expect(screen.getByRole("link", { name: "前往任务管理" })).toHaveAttribute("href", "/tasks")
    expect(screen.getByText("完成率").parentElement).toHaveTextContent("0%")
  })

  it("快捷完成调用现有接口并刷新驾驶舱与提醒查询", async () => {
    mockApi()
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/dashboard") return jsonResponse(dashboard)
      if (path === "/api/ai/status") return jsonResponse({ remoteConfigured: false, provider: "本地规则引擎", hint: "" })
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "test-csrf" })
      if (path === "/api/tasks/task-1/complete") return jsonResponse({ ...task, status: "DONE" })
      return jsonResponse({ message: `未知请求 ${init?.method ?? "GET"} ${path}` }, 500)
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "完成“完成讲话稿”" }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/tasks/task-1/complete", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "test-csrf" }),
    })))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/dashboard").length).toBeGreaterThanOrEqual(2))
  })
})
