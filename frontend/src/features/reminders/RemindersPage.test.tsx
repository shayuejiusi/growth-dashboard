import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { RemindersPage } from "./RemindersPage"

function task(id: string, title: string) {
  return {
    id,
    title,
    priority: "P1",
    dueDate: "2026-10-27",
    status: "TODO",
    needReport: false,
    capabilities: [],
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
}

const reminders = {
  generatedAt: "2026-10-27 10:00",
  phase: "早间检查",
  stats: { total: 5, open: 5, overdue: 1, highPriority: 1, todayDue: 1, completedTotal: 0, completionRate: 0, needReport: 1 },
  reminders: {
    todayDue: [task("today", "今日截止任务")],
    overdue: [task("overdue", "已经逾期任务")],
    highPriority: [task("high", "高优先级任务")],
    needReport: [task("report", "需要汇报任务")],
    recurring: [{ ...task("recurring", "周期检查任务"), repeatType: "DAILY" }],
  },
  scripts: [
    { scene: "同步任务状态", text: "今日例行检查：待办 5 项。" },
    { scene: "向领导汇报进度", text: "汇报进展：当前未完成 5 项。" },
  ],
  focusNow: "优先处理今日截止任务",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function mockApi(body: unknown = reminders) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/reminders") return jsonResponse(body)
    return jsonResponse({ message: `未 mock 的接口：${String(input)}` }, 500)
  }))
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter>
          <RemindersPage />
        </MemoryRouter>
        <Toaster theme="light" />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe("提醒中心", () => {
  afterEach(async () => {
    const { toast } = await import("sonner")
    toast.dismiss()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("展示五组提醒、数量与任务跳转链接", async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText("早间检查")).toBeVisible()
    expect(screen.getByRole("heading", { name: "提醒中心" })).toBeVisible()
    const groups = [
      ["今日截止", "今日截止任务", "today"],
      ["已逾期", "已经逾期任务", "overdue"],
      ["高优先级", "高优先级任务", "high"],
      ["需要汇报", "需要汇报任务", "report"],
      ["周期事项", "周期检查任务", "recurring"],
    ] as const
    for (const [label, title, id] of groups) {
      await user.click(screen.getByRole("tab", { name: new RegExp(label) }))
      expect(await screen.findByText(title)).toBeVisible()
      expect(screen.getByRole("link", { name: `查看“${title}”` })).toHaveAttribute("href", `/tasks?focus=${id}`)
    }
  })

  it("空组显示准确文案和下一步，不制造待处理事项", async () => {
    mockApi({
      ...reminders,
      reminders: { todayDue: [], overdue: [], highPriority: [], needReport: [], recurring: [] },
    })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText("今天没有截止任务")).toBeVisible()
    expect(screen.getByText("可切换到其他分组，或前往任务管理安排截止时间。")).toBeVisible()
    expect(screen.getByRole("link", { name: "安排任务" })).toHaveAttribute("href", "/tasks")
    await user.click(screen.getByRole("tab", { name: /已逾期/ }))
    expect(await screen.findByText("没有逾期任务")).toBeVisible()
    await user.click(screen.getByRole("tab", { name: /高优先级/ }))
    expect(await screen.findByText("没有高优先级任务")).toBeVisible()
    await user.click(screen.getByRole("tab", { name: /需要汇报/ }))
    expect(await screen.findByText("没有需要汇报的任务")).toBeVisible()
    await user.click(screen.getByRole("tab", { name: /周期事项/ }))
    expect(await screen.findByText("没有周期事项")).toBeVisible()
  })

  it("首次加载显示骨架屏与状态提示", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)))
    const { container } = renderPage()

    expect(await screen.findByText("正在加载提醒")).toBeVisible()
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0)
  })

  it("加载失败后可重试并移除骨架屏", async () => {
    mockApi()
    vi.mocked(fetch).mockRejectedValueOnce(new Error("网络连接失败"))
    const user = userEvent.setup()
    const { container } = renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("提醒加载失败")
    await user.click(screen.getByRole("button", { name: "重新加载" }))
    expect(await screen.findByText("今日截止任务")).toBeVisible()
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeInTheDocument()
  })

  it("复制话术成功后显示 Toast", async () => {
    mockApi()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    renderPage()

    const scriptCard = (await screen.findByText("同步任务状态")).closest("[data-slot='card']") as HTMLElement
    await user.click(within(scriptCard).getByRole("button", { name: "复制话术" }))
    expect(writeText).toHaveBeenCalledWith("今日例行检查：待办 5 项。")
    expect(await screen.findByText("话术已复制")).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "手动复制话术" })).not.toBeInTheDocument()
  })

  it("复制失败显示可手动选择的文本，不显示成功 Toast", async () => {
    mockApi()
    const writeText = vi.fn().mockRejectedValue(new Error("denied"))
    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    renderPage()

    const scriptCard = (await screen.findByText("同步任务状态")).closest("[data-slot='card']") as HTMLElement
    await user.click(within(scriptCard).getByRole("button", { name: "复制话术" }))
    expect(await screen.findByRole("textbox", { name: "手动复制话术" })).toHaveValue("今日例行检查：待办 5 项。")
    expect(screen.getByText("自动复制失败，请手动选择并复制。")).toBeVisible()
    expect(screen.queryByText("话术已复制")).not.toBeInTheDocument()
  })

  it("同名话术场景的复制降级互不影响", async () => {
    mockApi({
      ...reminders,
      scripts: [
        { scene: "重复场景", text: "第一段同名话术" },
        { scene: "重复场景", text: "第二段同名话术" },
      ],
    })
    const writeText = vi.fn().mockRejectedValue(new Error("denied"))
    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    renderPage()

    const headings = await screen.findAllByText("重复场景")
    const cards = headings.map((heading) => heading.closest("[data-slot='card']") as HTMLElement)
    await user.click(within(cards[0]).getByRole("button", { name: "复制话术" }))

    expect(await within(cards[0]).findByRole("textbox", { name: "手动复制话术" })).toHaveValue("第一段同名话术")
    expect(within(cards[1]).queryByRole("textbox", { name: "手动复制话术" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("textbox", { name: "手动复制话术" })).toHaveLength(1)
  })

  it("没有话术时展示空状态", async () => {
    mockApi({ ...reminders, scripts: [] })
    renderPage()

    expect(await screen.findByText("暂无可复制的话术")).toBeVisible()
    expect(screen.getByText("提醒数据仍可正常查看，话术将在生成后显示。")).toBeVisible()
  })
})
