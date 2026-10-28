import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SearchDialog } from "./SearchDialog"

const emptyResults = { tasks: [], people: [], content: [] }
const taskResult = {
  type: "task",
  id: "task-1",
  title: "德育工作计划",
  subtitle: "今天截止",
  path: "/tasks?focus=task-1",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function SearchHarness() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <LocationProbe />
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function renderSearch() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SearchHarness />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}

function searchInput() {
  return screen.getByRole("combobox", { name: "全局搜索" })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("全局搜索", () => {
  it("输入后 299ms 不请求，300ms 只请求一次", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(emptyResults))
    vi.stubGlobal("fetch", fetchMock)
    renderSearch()

    fireEvent.change(searchInput(), { target: { value: "德" } })
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(299)
      await Promise.resolve()
    })
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=%E5%BE%B7", expect.objectContaining({
      signal: expect.any(AbortSignal),
    }))
  })

  it("新关键词立即取消旧请求，旧响应不能覆盖新结果", async () => {
    let resolveFirst!: (response: Response) => void
    const signals: AbortSignal[] = []
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal)
      if (String(input).endsWith("q=%E5%BE%B7")) {
        return new Promise<Response>((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve(jsonResponse({
        ...emptyResults,
        tasks: [{ ...taskResult, id: "new", title: "新关键词结果", path: "/tasks?focus=new" }],
      }))
    })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderSearch()

    await user.type(searchInput(), "德")
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await user.type(searchInput(), "育")
    expect(signals[0].aborted).toBe(true)
    expect(await screen.findByRole("option", { name: /新关键词结果/ })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveFirst(jsonResponse({ ...emptyResults, tasks: [{ ...taskResult, title: "过期旧结果" }] }))
      await Promise.resolve()
    })
    expect(screen.queryByText("过期旧结果")).not.toBeInTheDocument()
    expect(screen.getByText("新关键词结果")).toBeInTheDocument()
  })

  it("空白和超过 50 字的关键词不请求，并给出明确提示", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(emptyResults))
    vi.stubGlobal("fetch", fetchMock)
    renderSearch()

    fireEvent.change(searchInput(), { target: { value: "   " } })
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText("请输入至少 1 个非空白字符")).toBeInTheDocument()

    fireEvent.change(searchInput(), { target: { value: "x".repeat(51) } })
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText("关键词最多 50 个字符")).toBeInTheDocument()
  })

  it("展示加载、错误重试和空结果状态", async () => {
    let finishFirst!: (response: Response) => void
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirst = resolve }))
      .mockResolvedValueOnce(jsonResponse(emptyResults))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderSearch()

    await user.type(searchInput(), "德")
    expect(await screen.findByText("正在搜索…")).toBeInTheDocument()
    await act(async () => {
      finishFirst(jsonResponse({ message: "搜索暂不可用" }, 500))
      await Promise.resolve()
    })
    expect(await screen.findByRole("alert")).toHaveTextContent("搜索暂不可用")

    await user.click(screen.getByRole("button", { name: "重试搜索" }))
    expect(await screen.findByText("未找到匹配内容")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("上下键维护 active descendant，Enter 关闭并跳转服务端路径", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      tasks: [taskResult, { ...taskResult, id: "task-2", title: "第二项任务", path: "/tasks?focus=task-2" }],
      people: [{ type: "person", id: "p1", title: "张老师", subtitle: "教师组", path: "/talent?person=p1" }],
      content: [{ type: "content", id: "c1", title: "德育文章", subtitle: "每日精选", path: "/content?item=c1" }],
    })))
    const user = userEvent.setup()
    renderSearch()

    await user.type(searchInput(), "德")
    const options = await screen.findAllByRole("option")
    expect(options).toHaveLength(4)
    expect(searchInput()).toHaveAttribute("aria-controls", "global-search-results")

    await user.keyboard("{ArrowDown}")
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    expect(searchInput()).toHaveAttribute("aria-activedescendant", options[0].id)
    await user.keyboard("{ArrowDown}")
    expect(options[1]).toHaveAttribute("aria-selected", "true")
    expect(searchInput()).toHaveAttribute("aria-activedescendant", options[1].id)
    await user.keyboard("{ArrowUp}")
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    expect(searchInput()).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("/tasks?focus=task-1")
  })

  it("空的人员和内容分组不渲染，点击结果关闭并导航", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...emptyResults, tasks: [taskResult] })))
    const user = userEvent.setup()
    renderSearch()

    await user.type(searchInput(), "德")
    const result = await screen.findByRole("option", { name: /德育工作计划/ })
    expect(screen.getByRole("heading", { name: "任务" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "人员" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "内容" })).not.toBeInTheDocument()
    expect(screen.queryByText(/能力成长|能力评估/)).not.toBeInTheDocument()

    await user.click(result)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("/tasks?focus=task-1")
  })

  it.each([
    ["外链", "https://example.com/tasks?focus=task-1"],
    ["协议相对外链", "//example.com/tasks?focus=task-1"],
    ["错误内部路径", "/admin/users?focus=task-1"],
  ])("拒绝%s并保留搜索面板", async (_label, path) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      ...emptyResults,
      tasks: [{ ...taskResult, path }],
    })))
    const user = userEvent.setup()
    renderSearch()

    await user.type(searchInput(), "德")
    await user.click(await screen.findByRole("option", { name: /德育工作计划/ }))

    expect(screen.getByRole("dialog", { name: "全局搜索" })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("无法打开该搜索结果")
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard")
  })

  it("composing Enter 不跳转且不阻止输入法默认行为", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...emptyResults, tasks: [taskResult] })))
    const user = userEvent.setup()
    renderSearch()

    await user.type(searchInput(), "德")
    await screen.findByRole("option", { name: /德育工作计划/ })
    await user.keyboard("{ArrowDown}")
    const notPrevented = fireEvent.keyDown(searchInput(), { key: "Enter", keyCode: 229, isComposing: true })

    expect(notPrevented).toBe(true)
    expect(screen.getByRole("dialog", { name: "全局搜索" })).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard")
  })

  it("composing 方向键不改变选项且不阻止输入法默认行为", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      ...emptyResults,
      tasks: [taskResult, { ...taskResult, id: "task-2", title: "第二项任务" }],
    })))
    const user = userEvent.setup()
    renderSearch()

    await user.type(searchInput(), "德")
    const options = await screen.findAllByRole("option")
    await user.keyboard("{ArrowDown}")
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    const downNotPrevented = fireEvent.keyDown(searchInput(), { key: "ArrowDown", keyCode: 229, isComposing: true })
    const upNotPrevented = fireEvent.keyDown(searchInput(), { key: "ArrowUp", keyCode: 229, isComposing: true })

    expect(downNotPrevented).toBe(true)
    expect(upNotPrevented).toBe(true)
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    expect(options[1]).toHaveAttribute("aria-selected", "false")
  })

  it("combobox 仅在列表存在时关联 controls，分组和 options 遵循 active-descendant 模型", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...emptyResults, tasks: [taskResult] })))
    const user = userEvent.setup()
    renderSearch()

    expect(searchInput()).not.toHaveAttribute("aria-controls")
    await user.type(searchInput(), "德")
    const option = await screen.findByRole("option", { name: /德育工作计划/ })

    expect(searchInput()).toHaveAttribute("aria-controls", "global-search-results")
    expect(screen.getByRole("group", { name: "任务" })).toBeInTheDocument()
    expect(option).toHaveAttribute("tabindex", "-1")
    expect(searchInput()).toHaveFocus()
  })

  it("Escape 关闭搜索面板", async () => {
    vi.stubGlobal("fetch", vi.fn())
    const user = userEvent.setup()
    renderSearch()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
