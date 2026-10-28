import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "@/components/ui/sonner"
import { clearCsrfToken } from "@/lib/api/client"
import { reviewKeys } from "./review-api"
import { ReviewPage } from "./ReviewPage"

const draft = {
  date: "2026-10-28",
  metrics: {
    total: 4,
    open: 2,
    todayDue: 1,
    overdue: 1,
    highPriority: 1,
    needReport: 1,
    completedTotal: 2,
    completionRate: 50,
    reportedCount: 1,
    internalMetric: "内部字段不应显示",
  },
  overdueAnalysis: "一项任务需要重新排期",
  reportQuality: "汇报包含结果与下一步",
  collabIssues: "暂无协作阻塞",
  highlights: ["完成季度总结"],
  improvements: ["提前拆分大型任务"],
  tomorrowGoals: ["确认下周计划"],
  focusCapability: "不应展示的建议字段",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function renderPage(setup?: (queryClient: QueryClient) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  setup?.(queryClient)
  render(<QueryClientProvider client={queryClient}><ReviewPage /><Toaster theme="light" /></QueryClientProvider>)
  return queryClient
}

describe("工作复盘", () => {
  beforeEach(() => clearCsrfToken())
  afterEach(() => {
    clearCsrfToken()
    toast.dismiss()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("404 显示尚未生成今日复盘，而不是错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "复盘草稿不存在" }, 404)))
    renderPage()

    expect(await screen.findByText("尚未生成今日复盘")).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent("focusCapability")
  })

  it("生成时保留已有草稿并显示进度，完成后仅展示工作字段", async () => {
    let resolveGenerate!: (response: Response) => void
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/review/daily") return jsonResponse(draft)
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "review-csrf" })
      if (path === "/api/review/daily/generate" && init?.method === "POST") {
        return new Promise<Response>((resolve) => { resolveGenerate = resolve })
      }
      return jsonResponse({ message: "未 mock 的接口" }, 500)
    }))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText("完成季度总结")).toBeVisible()
    expect(screen.getByText("一项任务需要重新排期")).toBeVisible()
    expect(screen.getByText("汇报包含结果与下一步")).toBeVisible()
    expect(screen.getByText("暂无协作阻塞")).toBeVisible()
    expect(screen.getByText("提前拆分大型任务")).toBeVisible()
    expect(screen.getByText("确认下周计划")).toBeVisible()
    expect(document.body).not.toHaveTextContent("不应展示的建议字段")
    expect(document.body).not.toHaveTextContent("focusCapability")
    expect(document.body).not.toHaveTextContent("建议聚焦")
    for (const label of ["全部任务", "待办任务", "今日截止", "已逾期", "高优先级", "需要汇报", "累计完成", "完成率", "汇报事项"]) {
      expect(screen.getByText(label)).toBeVisible()
    }
    expect(document.body).not.toHaveTextContent("internalMetric")
    expect(document.body).not.toHaveTextContent("内部字段不应显示")

    await user.click(screen.getByRole("button", { name: "生成今日复盘" }))
    expect(screen.getByRole("button", { name: "正在生成今日复盘" })).toBeDisabled()
    expect(screen.getByText("完成季度总结")).toBeVisible()
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => path === "/api/review/daily/generate")).toHaveLength(1)

    resolveGenerate(jsonResponse({ ...draft, highlights: ["新生成的亮点"] }))
    expect(await screen.findByText("新生成的亮点")).toBeVisible()
    expect(await screen.findByText("复盘已生成")).toBeVisible()
  })

  it("首次生成时防止重复请求，失败保留已有草稿并可重试", async () => {
    let rejectGenerate!: (error: Error) => void
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path === "/api/review/daily") return jsonResponse(draft)
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "review-csrf" })
      if (path === "/api/review/daily/generate") return new Promise<Response>((_resolve, reject) => { rejectGenerate = reject })
      return jsonResponse({ message: "未 mock 的接口" }, 500)
    }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("完成季度总结")
    await user.click(screen.getByRole("button", { name: "生成今日复盘" }))
    await user.click(screen.getByRole("button", { name: "正在生成今日复盘" }))
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => path === "/api/review/daily/generate")).toHaveLength(1)

    rejectGenerate(new Error("网络连接失败"))
    expect(await screen.findByRole("alert")).toHaveTextContent("网络连接失败")
    expect(screen.getByText("完成季度总结")).toBeVisible()
    expect(screen.getByRole("button", { name: "生成今日复盘" })).toBeEnabled()
  })

  it("普通加载错误提供重试，成功后展示空列表说明", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "复盘暂不可用" }, 500))
      .mockResolvedValueOnce(jsonResponse({ ...draft, highlights: [], improvements: [], tomorrowGoals: [] })))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("复盘暂不可用")
    await user.click(screen.getByRole("button", { name: "重新加载" }))
    expect(await screen.findAllByText("暂无内容")).toHaveLength(3)
  })

  it("初始加载期间禁用生成，避免无草稿时重复发起", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)))
    renderPage()

    expect(await screen.findByText("正在加载今日复盘")).toBeVisible()
    expect(screen.getByRole("button", { name: "生成今日复盘" })).toBeDisabled()
  })

  it("慢 GET 快 POST 竞态中，旧 GET 最后返回也不能覆盖新复盘", async () => {
    let resolveGet!: (response: Response) => void
    let resolvePost!: (response: Response) => void
    let getSignal: AbortSignal | undefined
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "review-csrf" })
      if (path === "/api/review/daily") {
        getSignal = init?.signal ?? undefined
        return new Promise<Response>((resolve) => { resolveGet = resolve })
      }
      if (path === "/api/review/daily/generate" && init?.method === "POST") {
        return new Promise<Response>((resolve) => { resolvePost = resolve })
      }
      return jsonResponse({ message: `未 mock 的接口：${path}` }, 500)
    }))
    const user = userEvent.setup()
    renderPage((queryClient) => queryClient.setQueryData(reviewKeys.daily(), draft))
    expect(await screen.findByText("完成季度总结")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "生成今日复盘" }))
    expect(getSignal?.aborted).toBe(true)
    await act(async () => {
      resolvePost(jsonResponse({ ...draft, highlights: ["新生成的亮点"] }))
      await Promise.resolve()
    })
    expect(await screen.findByText("新生成的亮点")).toBeVisible()

    await act(async () => {
      resolveGet(jsonResponse({ ...draft, highlights: ["旧 GET 覆盖内容"] }))
      await Promise.resolve()
    })
    expect(screen.getByText("新生成的亮点")).toBeVisible()
    expect(screen.queryByText("旧 GET 覆盖内容")).not.toBeInTheDocument()
  })
})
