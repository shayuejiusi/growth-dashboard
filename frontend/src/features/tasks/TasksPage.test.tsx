import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useNavigate } from "react-router"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { clearCsrfToken } from "@/lib/api/client"
import { TasksPage } from "./TasksPage"
import type { Task, TaskInput } from "./types"

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const today = localDate(new Date())

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "整理本周工作",
    priority: "P1",
    dueDate: today,
    status: "TODO",
    needReport: true,
    note: "原始备注",
    category: "行政",
    source: "学部",
    nextStep: "先列提纲",
    expectedOutcome: "形成清单",
    blocker: null,
    repeatType: "NONE",
    position: 0,
    version: 2,
    createdAt: "2026-10-26T09:00:00",
    completedAt: null,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function mockApi(initialTasks: Task[] = []) {
  let tasks = [...initialTasks]
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? "GET"
    if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "test-csrf" })
    if (path === "/api/tasks" && method === "GET") return jsonResponse(tasks)
    if (path === "/api/tasks" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as TaskInput
      const task = makeTask({ ...body, id: `created-${tasks.length + 1}`, dueDate: body.dueDate, version: 0, position: tasks.length })
      tasks = [...tasks, task]
      return jsonResponse(task)
    }
    if (path === "/api/tasks" && method === "DELETE") {
      const deleted = tasks.length
      tasks = []
      return jsonResponse({ deleted })
    }
    if (path === "/api/tasks/export") return jsonResponse(tasks)
    if (path === "/api/tasks/order" && method === "PUT") return jsonResponse(tasks)
    const match = path.match(/^\/api\/tasks\/([^/]+)(\/complete|\/reopen)?$/)
    if (match) {
      const id = decodeURIComponent(match[1])
      const current = tasks.find((task) => task.id === id)
      if (!current) return jsonResponse({ message: "任务不存在" }, 404)
      if (match[2] === "/complete" && method === "POST") {
        const updated = { ...current, status: "DONE" as const, completedAt: "2026-10-27T10:00:00" }
        tasks = tasks.map((task) => task.id === id ? updated : task)
        return jsonResponse(updated)
      }
      if (match[2] === "/reopen" && method === "POST") {
        const updated = { ...current, status: "TODO" as const, completedAt: null }
        tasks = tasks.map((task) => task.id === id ? updated : task)
        return jsonResponse(updated)
      }
      if (!match[2] && method === "PUT") {
        const body = JSON.parse(String(init?.body)) as TaskInput
        const updated = { ...current, ...body }
        tasks = tasks.map((task) => task.id === id ? updated : task)
        return jsonResponse(updated)
      }
      if (!match[2] && method === "DELETE") {
        tasks = tasks.filter((task) => task.id !== id)
        return jsonResponse({ deleted: true })
      }
    }
    return jsonResponse({ message: `未 mock 的接口：${method} ${path}` }, 500)
  }))
  return { getTasks: () => tasks }
}

function GlobalNewButton() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate("/tasks?new=1")}>全局新建</button>
      <button type="button" onClick={() => navigate("/tasks?focus=focus-me")}>导航聚焦</button>
    </>
  )
}

function renderPage(entry = "/tasks") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[entry]}>
          <GlobalNewButton />
          <TasksPage />
        </MemoryRouter>
        <Toaster theme="light" />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { queryClient, ...view }
}

describe("任务管理", () => {
  beforeEach(() => {
    clearCsrfToken()
  })

  afterEach(() => {
    clearCsrfToken()
    toast.dismiss()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("顶部新建入口在任务页内关闭后可再次打开", async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: "全局新建" }))
    expect(await screen.findByRole("dialog", { name: "新建任务" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "关闭新建任务" }))
    await user.click(screen.getByRole("button", { name: "全局新建" }))
    expect(await screen.findByRole("dialog", { name: "新建任务" })).toBeVisible()
  })

  it("保留九个任务视图，并默认显示今日待办", async () => {
    mockApi([
      makeTask(),
      makeTask({ id: "done", title: "已完成事项", status: "DONE", position: 1 }),
    ])
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText("整理本周工作")).toBeVisible()
    expect(screen.queryByText("已完成事项")).not.toBeInTheDocument()
    const labels = ["今日待办", "每日必做", "每周必做", "本周待办", "已逾期", "高优先级", "需汇报", "已完成", "全部任务"]
    expect(screen.getAllByRole("tab")).toHaveLength(9)
    for (const label of labels) expect(screen.getByRole("tab", { name: new RegExp(label) })).toBeVisible()

    await user.click(screen.getByRole("tab", { name: /全部任务/ }))
    expect(screen.getByText("已完成事项")).toBeVisible()
  })

  it("空标题禁止提交，长表单取消时保护未保存修改", async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "新建任务" }))

    await user.click(screen.getByRole("button", { name: "保存任务" }))
    expect(await screen.findByText("请输入任务标题")).toBeVisible()
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => path === "/api/tasks")).toHaveLength(1)

    const title = screen.getByLabelText("任务标题")
    await user.type(title, "尚未保存的标题")
    await user.click(screen.getByRole("button", { name: "关闭新建任务" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(confirm).toHaveTextContent("放弃未保存修改")
    await user.click(within(confirm).getByRole("button", { name: "继续编辑" }))
    expect(screen.getByLabelText("任务标题")).toHaveValue("尚未保存的标题")
  })

  it("编辑保留任务上下文，提交失败保留输入并在操作区显示错误", async () => {
    mockApi([makeTask()])
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "编辑“整理本周工作”" }))

    expect(screen.getByRole("dialog", { name: "编辑任务" })).toBeVisible()
    expect(screen.getByLabelText("任务标题")).toHaveValue("整理本周工作")
    expect(screen.getByLabelText("备注")).toHaveValue("原始备注")
    expect(screen.getByLabelText("下一步行动")).toHaveValue("先列提纲")
    const title = screen.getByLabelText("任务标题")
    await user.clear(title)
    await user.type(title, "修改后的标题")
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "test-csrf" })
      if (path === "/api/tasks/task-1" && init?.method === "PUT") return jsonResponse({ message: "保存失败，请稍后重试" }, 500)
      return jsonResponse([])
    })
    await user.click(screen.getByRole("button", { name: "保存任务" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("保存失败，请稍后重试")
    expect(screen.getByLabelText("任务标题")).toHaveValue("修改后的标题")
    expect(screen.getByRole("dialog", { name: "编辑任务" })).toBeVisible()
  })

  it("完成任务无需二次确认，并可通过 Toast 撤销为重开", async () => {
    const api = mockApi([makeTask()])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "完成“整理本周工作”" }))
    expect(await screen.findByText("任务已完成")).toBeVisible()
    expect(api.getTasks()[0].status).toBe("DONE")
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "撤销" }))
    await waitFor(() => expect(api.getTasks()[0].status).toBe("TODO"))
    expect(vi.mocked(fetch).mock.calls.some(([path, init]) => path === "/api/tasks/task-1/reopen" && init?.method === "POST")).toBe(true)
  })

  it("关闭编辑后快速新建仍创建新任务，而不是更新上次编辑项", async () => {
    const api = mockApi([makeTask()])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "编辑“整理本周工作”" }))
    await user.click(screen.getByRole("button", { name: "关闭编辑任务" }))
    await user.click(screen.getByRole("button", { name: "快速新建" }))
    await user.type(screen.getByLabelText("任务标题"), "快速记录的新任务")
    await user.click(screen.getByRole("button", { name: "创建任务" }))

    await waitFor(() => expect(api.getTasks()).toHaveLength(2))
    expect(api.getTasks()[0].title).toBe("整理本周工作")
    expect(api.getTasks()[1].title).toBe("快速记录的新任务")
    expect(vi.mocked(fetch).mock.calls.some(([path, init]) => path === "/api/tasks/task-1" && init?.method === "PUT")).toBe(false)
  })

  it("清空全部任务必须经过明确动作 Modal", async () => {
    const api = mockApi([makeTask()])
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("整理本周工作")

    await user.click(screen.getByRole("button", { name: "清空全部任务" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("此操作会永久删除当前账号的全部任务")
    expect(api.getTasks()).toHaveLength(1)
    await user.click(within(dialog).getByRole("button", { name: "清空全部任务" }))

    await waitFor(() => expect(api.getTasks()).toHaveLength(0))
    expect(await screen.findByText("还没有任务")).toBeVisible()
  })

  it("focus 参数切换到全量视图，滚动并高亮目标任务", async () => {
    mockApi([
      makeTask(),
      makeTask({ id: "focus-me", title: "从提醒进入的任务", dueDate: "2099-12-31", position: 1 }),
    ])
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView")
    renderPage("/tasks?focus=focus-me")

    const card = await screen.findByTestId("task-focus-me")
    expect(card).toHaveAttribute("data-focused", "true")
    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect(screen.getByRole("tab", { name: /全部任务/ })).toHaveAttribute("aria-selected", "true")
  })

  it("JSON 备份使用 Cookie 请求生成 Blob 下载，不在 URL 拼接认证信息", async () => {
    mockApi([makeTask()])
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => "blob:task-backup")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    renderPage()
    await screen.findByText("整理本周工作")

    await user.click(screen.getByRole("button", { name: "备份任务" }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob)))
    const exportCall = vi.mocked(fetch).mock.calls.find(([path]) => path === "/api/tasks/export")
    expect(exportCall?.[0]).toBe("/api/tasks/export")
    expect(exportCall?.[1]).toMatchObject({ credentials: "include" })
    expect(String(exportCall?.[0])).not.toMatch(/token|session/i)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:task-backup")
  })

  it("延迟排序中禁止删除、清空、完成、编辑和新增，失败后缓存保持一致", async () => {
    const original = [
      makeTask(),
      makeTask({ id: "task-2", title: "第二项任务", position: 1 }),
    ]
    mockApi(original)
    const baseFetch = vi.mocked(fetch).getMockImplementation()!
    let finishOrder!: (response: Response) => void
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/tasks/order") return new Promise<Response>((resolve) => { finishOrder = resolve })
      return baseFetch(input, init)
    })
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.getAttribute("data-testid") === "task-task-2" ? 1 : 0
      return {
        x: 0, y: index * 100, top: index * 100, bottom: index * 100 + 100,
        left: 0, right: 300, width: 300, height: 100, toJSON: () => ({}),
      } as DOMRect
    })
    const { queryClient } = renderPage()
    const handle = await screen.findByRole("button", { name: "拖动“整理本周工作”排序" })
    fireEvent.keyDown(handle, { key: " ", code: "Space" })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    fireEvent.keyDown(handle, { key: "ArrowDown", code: "ArrowDown" })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    fireEvent.keyDown(handle, { key: " ", code: "Space" })
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([path]) => path === "/api/tasks/order")).toBe(true))

    const blockedButtons = [
      screen.getByRole("button", { name: "删除“整理本周工作”" }),
      screen.getByRole("button", { name: "完成“整理本周工作”" }),
      screen.getByRole("button", { name: "编辑“整理本周工作”" }),
      screen.getByRole("button", { name: "清空全部任务" }),
      screen.getByRole("button", { name: "新建任务" }),
      screen.getByRole("button", { name: "快速新建" }),
    ]
    for (const button of blockedButtons) {
      expect(button).toBeDisabled()
      fireEvent.click(button)
    }
    expect(vi.mocked(fetch).mock.calls.filter(([path, init]) => {
      const method = init?.method ?? "GET"
      return path !== "/api/tasks/order" && path !== "/api/auth/csrf" && method !== "GET"
    })).toHaveLength(0)

    await act(async () => { finishOrder(jsonResponse({ message: "排序失败" }, 500)) })
    expect(await screen.findByText("排序未保存，已恢复原顺序")).toBeVisible()
    expect(queryClient.getQueryData<Task[]>(["tasks", "list"])?.map((task) => task.id)).toEqual(original.map((task) => task.id))
    expect(screen.getByRole("button", { name: "编辑“整理本周工作”" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "新建任务" })).toBeEnabled()
  })

  it("其他任务写操作 pending 时禁止拖拽，结束后恢复", async () => {
    mockApi([makeTask(), makeTask({ id: "task-2", title: "第二项任务", position: 1 })])
    const baseFetch = vi.mocked(fetch).getMockImplementation()!
    let finishComplete!: (response: Response) => void
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/tasks/task-1/complete") return new Promise<Response>((resolve) => { finishComplete = resolve })
      return baseFetch(input, init)
    })
    const user = userEvent.setup()
    renderPage()
    const handle = await screen.findByRole("button", { name: "拖动“整理本周工作”排序" })
    await user.click(screen.getByRole("button", { name: "完成“整理本周工作”" }))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([path]) => path === "/api/tasks/task-1/complete")).toBe(true))
    expect(handle).toBeDisabled()

    await act(async () => { finishComplete(jsonResponse({ ...makeTask(), status: "DONE" })) })
    await waitFor(() => expect(screen.getByRole("button", { name: "拖动“第二项任务”排序" })).toBeEnabled())
  })

  it("同挂载实例从普通任务页导航到 focus URL 时切换全部并聚焦目标", async () => {
    mockApi([
      makeTask(),
      makeTask({ id: "focus-me", title: "后续聚焦任务", dueDate: "2099-12-31", position: 1 }),
    ])
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView")
    const user = userEvent.setup()
    renderPage("/tasks")
    await screen.findByText("整理本周工作")
    expect(screen.queryByTestId("task-focus-me")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "导航聚焦" }))

    expect(await screen.findByTestId("task-focus-me")).toHaveAttribute("data-focused", "true")
    expect(screen.getByRole("tab", { name: /全部任务/ })).toHaveAttribute("aria-selected", "true")
    await waitFor(() => expect(scroll).toHaveBeenCalled())
  })

  it("本地下载点击异常进入备份失败反馈并释放 URL、清理节点", async () => {
    mockApi([makeTask()])
    const user = userEvent.setup()
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:task-backup"), revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { throw new Error("点击下载失败") })
    renderPage()
    await screen.findByText("整理本周工作")

    await user.click(screen.getByRole("button", { name: "备份任务" }))

    expect(await screen.findByText(/备份失败/)).toBeVisible()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:task-backup")
    expect(document.querySelector("a[download^='任务备份-']")).toBeNull()
  })

  it("createObjectURL 本地异常也进入备份失败反馈", async () => {
    mockApi([makeTask()])
    const user = userEvent.setup()
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => { throw new Error("无法创建下载地址") }), revokeObjectURL: vi.fn() })
    renderPage()
    await screen.findByText("整理本周工作")

    await user.click(screen.getByRole("button", { name: "备份任务" }))

    expect(await screen.findByText(/备份失败/)).toBeVisible()
  })

  it("加载失败可重试，空视图提供新建入口", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "任务暂时不可用" }, 500))
      .mockResolvedValueOnce(jsonResponse([])))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("任务暂时不可用")
    await user.click(screen.getByRole("button", { name: "重新加载" }))
    expect(await screen.findByText("今天没有待办任务")).toBeVisible()
    expect(screen.getByRole("button", { name: "添加任务" })).toBeVisible()
  })
})
