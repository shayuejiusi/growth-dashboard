import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "@/components/ui/sonner"
import { clearCsrfToken } from "@/lib/api/client"
import { QuickAddDrawer } from "./QuickAddDrawer"
import { TasksPage } from "./TasksPage"
import type { TaskInput } from "./types"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function renderDrawer(onImport = vi.fn().mockResolvedValue({ imported: 1, total: 1, failedIndex: null, cause: null })) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <QuickAddDrawer
      open
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
      onImport={onImport}
    />,
  )
  return { onImport, onSubmit }
}

async function openDocumentImport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: "文档导入" }))
}

describe("文档提取与本地快速识别", () => {
  beforeEach(() => {
    clearCsrfToken()
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    clearCsrfToken()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each([
    ["notes.pdf", "仅支持 .txt、.md、.csv、.docx、.xlsx 文件"],
    ["notes.txt", "文件不能超过 10MB"],
  ])("拒绝不符合要求的文件：%s", async (name, message) => {
    const user = userEvent.setup()
    renderDrawer()
    await openDocumentImport(user)
    const contents = name.endsWith(".pdf") ? "plain" : new Uint8Array(10 * 1024 * 1024 + 1)

    fireEvent.change(screen.getByLabelText("选择文件"), { target: { files: [new File([contents], name)] } })

    expect(await screen.findByRole("alert")).toHaveTextContent(message)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("以 FormData 提取文本并放入编辑器，不手动设置 Content-Type", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === "/api/auth/csrf") return jsonResponse({ csrfToken: "csrf" })
      if (String(input) === "/api/ai/extract-text") {
        expect(init?.body).toBeInstanceOf(FormData)
        expect(init?.headers).not.toHaveProperty("Content-Type")
        return jsonResponse({ filename: "notes.md", text: "提取后的正文", chars: 6 })
      }
      return jsonResponse({ message: "未 mock 的接口" }, 500)
    })
    const user = userEvent.setup()
    renderDrawer()
    await openDocumentImport(user)

    await user.upload(screen.getByLabelText("选择文件"), new File(["original"], "notes.md"))

    expect(await screen.findByLabelText("文本内容")).toHaveValue("提取后的正文")
    expect(screen.getByText(/已解析 notes.md/)).toBeVisible()
  })

  it("提供文档与收文上下文，但不在前端展示能力维度", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <QuickAddDrawer open onOpenChange={vi.fn()} onSubmit={vi.fn()} onImport={vi.fn()} />,
    )

    await openDocumentImport(user)
    await user.click(screen.getByRole("tab", { name: "收文" }))
    expect(screen.getByText(/收文、通知或待落实文件/)).toBeVisible()
    expect(container).not.toHaveTextContent("能力维度")
    expect(container).not.toHaveTextContent("能力评估")
  })

  it("本地规则预览可勾选和编辑，导入前不创建任务", async () => {
    const onImport = vi.fn().mockResolvedValue({ imported: 1, total: 1, failedIndex: null, cause: null })
    const user = userEvent.setup()
    renderDrawer(onImport)
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "2026-11-02 完成周报\n2026-11-03 提交材料")

    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))

    expect(screen.getByLabelText("任务 1 标题")).toHaveValue("完成周报")
    expect(screen.getByLabelText("任务 2 标题")).toHaveValue("提交材料")
    expect(onImport).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText("任务 1 标题"))
    await user.type(screen.getByLabelText("任务 1 标题"), "已编辑周报")
    await user.selectOptions(screen.getByLabelText("任务 1 优先级"), "P0")
    await user.click(screen.getByLabelText("任务 1 截止日期"))
    await user.click(screen.getByRole("button", { name: "2026年11月1日" }))
    await user.click(screen.getByLabelText("选择任务 2"))
    await user.click(screen.getByRole("button", { name: "导入所选任务（1 项）" }))

    await waitFor(() => expect(onImport).toHaveBeenCalledWith([
      { title: "已编辑周报", priority: "P0", dueDate: "2026-11-01", needReport: false },
    ]))
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => String(path).includes("doc-to-tasks"))).toHaveLength(0)
  })

  it("AI 分析保留暂未配置空态，点击不会发送任何远程 AI 请求", async () => {
    const user = userEvent.setup()
    renderDrawer()
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "整理会议纪要")
    const aiButton = screen.getByRole("button", { name: "AI 智能分析（暂未配置）" })

    expect(aiButton).toBeDisabled()
    expect(screen.getByText(/AI 提示词和 API 暂未配置/)).toBeVisible()
    await user.click(aiButton)

    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByText(/AI 分析结果/)).not.toBeInTheDocument()
  })

  it("任务页导入复用任务写入并在成功后失效任务查询", async () => {
    const created: Array<Record<string, unknown>> = []
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "csrf" })
      if (path === "/api/tasks" && (init?.method ?? "GET") === "GET") return jsonResponse(created)
      if (path === "/api/tasks" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as TaskInput
        created.push({ ...body, id: "imported-1", status: "TODO", position: 0, version: 0 })
        return jsonResponse(created[0])
      }
      return jsonResponse({ message: `未 mock 的接口：${path}` }, 500)
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><TasksPage /></MemoryRouter>
        <Toaster theme="light" />
      </QueryClientProvider>,
    )
    await user.click(await screen.findByRole("button", { name: "快速新建" }))
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "整理导入任务")
    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))

    expect(vi.mocked(fetch).mock.calls.filter(([path, init]) => path === "/api/tasks" && init?.method === "POST")).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "导入所选任务（1 项）" }))

    expect(await screen.findByText("已导入 1 项任务")).toBeVisible()
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([path, init]) => path === "/api/tasks" && (init?.method ?? "GET") === "GET").length).toBeGreaterThanOrEqual(2))
    const post = vi.mocked(fetch).mock.calls.find(([path, init]) => path === "/api/tasks" && init?.method === "POST")
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title: "整理导入任务", priority: "P2", dueDate: null })
    expect(vi.mocked(fetch).mock.calls.filter(([path]) => String(path).includes("doc-to-tasks"))).toHaveLength(0)
  })

  it("第二项失败时保留剩余项、刷新缓存，重试只创建失败和未执行项", async () => {
    const created: string[] = []
    const attempted: string[] = []
    let secondShouldFail = true
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "csrf" })
      if (path === "/api/tasks" && (init?.method ?? "GET") === "GET") return jsonResponse(created.map((title, index) => ({ id: `task-${index}`, title, status: "TODO" })))
      if (path === "/api/tasks" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as TaskInput
        attempted.push(body.title)
        if (body.title === "第二项" && secondShouldFail) {
          secondShouldFail = false
          return jsonResponse({ message: "第二项保存失败" }, 500)
        }
        created.push(body.title)
        return jsonResponse({ ...body, id: `task-${created.length}`, status: "TODO" })
      }
      return jsonResponse({ message: `未 mock 的接口：${path}` }, 500)
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><TasksPage /></MemoryRouter>
        <Toaster theme="light" />
      </QueryClientProvider>,
    )
    await user.click(await screen.findByRole("button", { name: "快速新建" }))
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "第一项\n第二项\n第三项")
    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))
    await user.click(screen.getByRole("button", { name: "导入所选任务（3 项）" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("已成功 1、失败 1、未执行 1")
    expect(screen.getByRole("alert")).toHaveTextContent("第二项保存失败")
    expect(created).toEqual(["第一项"])
    expect(screen.queryByDisplayValue("第一项")).not.toBeInTheDocument()
    expect(screen.getByDisplayValue("第二项")).toBeVisible()
    expect(screen.getByDisplayValue("第三项")).toBeVisible()
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([path, init]) => path === "/api/tasks" && (init?.method ?? "GET") === "GET").length).toBeGreaterThanOrEqual(2))

    await user.click(screen.getByRole("button", { name: "导入所选任务（2 项）" }))

    expect(await screen.findByText("已导入 2 项任务")).toBeVisible()
    expect(created).toEqual(["第一项", "第二项", "第三项"])
    expect(attempted).toEqual(["第一项", "第二项", "第二项", "第三项"])
  })

  it("非法日历日期保留在标题中且不进入截止日期", async () => {
    const user = userEvent.setup()
    renderDrawer()
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "2026-13-40 第一项\n2026-02-31 第二项\n2026-02-28 第三项")
    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))

    expect(screen.getByLabelText("任务 1 标题")).toHaveValue("2026-13-40 第一项")
    expect(screen.getByLabelText("任务 1 截止日期")).toHaveTextContent("选择日期")
    expect(screen.getByLabelText("任务 2 标题")).toHaveValue("2026-02-31 第二项")
    expect(screen.getByLabelText("任务 2 截止日期")).toHaveTextContent("选择日期")
    expect(screen.getByLabelText("任务 3 标题")).toHaveValue("第三项")
    expect(screen.getByLabelText("任务 3 截止日期")).toHaveTextContent("2026年2月28日")
  })

  it("提取文本及草稿编辑触发关闭确认，取消保留且确认放弃", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === "/api/auth/csrf") return jsonResponse({ csrfToken: "csrf" })
      if (String(input) === "/api/ai/extract-text") return jsonResponse({ filename: "notes.txt", text: "提取任务", chars: 4 })
      return jsonResponse({}, 500)
    })
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<QuickAddDrawer open onOpenChange={onOpenChange} onSubmit={vi.fn()} onImport={vi.fn()} />)
    await openDocumentImport(user)
    await user.upload(screen.getByLabelText("选择文件"), new File(["raw"], "notes.txt"))
    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))
    await user.type(screen.getByLabelText("任务 1 标题"), "已编辑")

    await user.click(screen.getByRole("button", { name: "关闭" }))
    const confirm = await screen.findByRole("alertdialog")
    await user.click(screen.getByRole("button", { name: "继续编辑" }))
    expect(screen.getByLabelText("任务 1 标题")).toHaveValue("提取任务已编辑")
    expect(onOpenChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "关闭" }))
    await user.click(await screen.findByRole("button", { name: "放弃修改" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(confirm).not.toBeInTheDocument()
  })

  it("文本提取提交中阻止误关闭并给出明确提示", async () => {
    let finishExtract!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === "/api/auth/csrf") return jsonResponse({ csrfToken: "csrf" })
      if (String(input) === "/api/ai/extract-text") return new Promise<Response>((resolve) => { finishExtract = resolve })
      return jsonResponse({}, 500)
    })
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<QuickAddDrawer open onOpenChange={onOpenChange} onSubmit={vi.fn()} onImport={vi.fn()} />)
    await openDocumentImport(user)
    await user.upload(screen.getByLabelText("选择文件"), new File(["raw"], "notes.txt"))
    await screen.findByText("正在提取文件文本…")

    await user.click(screen.getByRole("button", { name: "关闭" }))

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(await screen.findByText("正在提取或导入，完成后才能关闭。")).toBeVisible()
    expect(screen.getByRole("dialog")).toBeVisible()
    await act(async () => { finishExtract(jsonResponse({ filename: "notes.txt", text: "正文", chars: 2 })) })
  })

  it("任务导入提交中阻止误关闭并给出明确提示", async () => {
    let finishImport!: (result: { imported: number; total: number; failedIndex: null; cause: null }) => void
    const onImport = vi.fn().mockReturnValue(new Promise((resolve) => { finishImport = resolve }))
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<QuickAddDrawer open onOpenChange={onOpenChange} onSubmit={vi.fn()} onImport={onImport} />)
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "待导入")
    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))
    await user.click(screen.getByRole("button", { name: "导入所选任务（1 项）" }))
    await screen.findByRole("button", { name: "正在导入…" })

    await user.click(screen.getByRole("button", { name: "关闭" }))

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(await screen.findByText("正在提取或导入，完成后才能关闭。")).toBeVisible()
    expect(screen.getByRole("dialog")).toBeVisible()
    await act(async () => { finishImport({ imported: 1, total: 1, failedIndex: null, cause: null }) })
  })

  it("提取中禁止切换 Tabs，完成后可正常关闭", async () => {
    let finishExtract!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === "/api/auth/csrf") return jsonResponse({ csrfToken: "csrf" })
      if (String(input) === "/api/ai/extract-text") return new Promise<Response>((resolve) => { finishExtract = resolve })
      return jsonResponse({}, 500)
    })
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<QuickAddDrawer open onOpenChange={onOpenChange} onSubmit={vi.fn()} onImport={vi.fn()} />)
    await openDocumentImport(user)
    await user.upload(screen.getByLabelText("选择文件"), new File(["raw"], "notes.txt"))
    await screen.findByText("正在提取文件文本…")

    expect(screen.getByRole("tab", { name: "手动填写" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "文档导入" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "文档" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "收文" })).toBeDisabled()
    await user.click(screen.getByRole("tab", { name: "手动填写" }))
    await user.click(screen.getByRole("tab", { name: "收文" }))
    await act(async () => { finishExtract(jsonResponse({ filename: "notes.txt", text: "提取正文", chars: 4 })) })

    expect(await screen.findByLabelText("文本内容")).toHaveValue("提取正文")
    await user.click(screen.getByRole("button", { name: "关闭" }))
    await user.click(await screen.findByRole("button", { name: "放弃修改" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("导入中禁止切换并保留部分失败反馈、剩余预览及重试关闭能力", async () => {
    let finishImport!: (result: { imported: number; total: number; failedIndex: number | null; cause: Error | null }) => void
    const onImport = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishImport = resolve }))
      .mockResolvedValueOnce({ imported: 2, total: 2, failedIndex: null, cause: null })
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<QuickAddDrawer open onOpenChange={onOpenChange} onSubmit={vi.fn()} onImport={onImport} />)
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "第一项\n第二项\n第三项")
    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))
    await user.click(screen.getByRole("button", { name: "导入所选任务（3 项）" }))
    await screen.findByRole("button", { name: "正在导入…" })

    expect(screen.getByRole("tab", { name: "手动填写" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "文档导入" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "文档" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "收文" })).toBeDisabled()
    await user.click(screen.getByRole("tab", { name: "手动填写" }))
    await user.click(screen.getByRole("tab", { name: "收文" }))
    await act(async () => { finishImport({ imported: 1, total: 3, failedIndex: 1, cause: new Error("第二项保存失败") }) })

    expect(await screen.findByRole("alert")).toHaveTextContent("已成功 1、失败 1、未执行 1")
    expect(screen.getByRole("alert")).toHaveTextContent("第二项保存失败")
    expect(screen.queryByDisplayValue("第一项")).not.toBeInTheDocument()
    expect(screen.getByDisplayValue("第二项")).toBeVisible()
    expect(screen.getByDisplayValue("第三项")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "导入所选任务（2 项）" }))
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole("button", { name: "导入所选任务（0 项）" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "关闭" }))
    await user.click(await screen.findByRole("button", { name: "放弃修改" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("普通外层 Tabs 往返保留文本、勾选和 Draft 编辑，隐藏内容不可见", async () => {
    const user = userEvent.setup()
    renderDrawer()
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "2026-12-02 第一项\n第二项")
    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))
    await user.clear(screen.getByLabelText("任务 1 标题"))
    await user.type(screen.getByLabelText("任务 1 标题"), "编辑后的第一项")
    await user.selectOptions(screen.getByLabelText("任务 1 优先级"), "P0")
    await user.click(screen.getByLabelText("任务 1 截止日期"))
    await user.click(screen.getByRole("button", { name: "2026年12月1日" }))
    await user.click(screen.getByLabelText("选择任务 2"))

    await user.click(screen.getByRole("tab", { name: "手动填写" }))
    expect(screen.getByLabelText("文本内容")).not.toBeVisible()
    await user.click(screen.getByRole("tab", { name: "文档导入" }))

    expect(screen.getByLabelText("文本内容")).toHaveValue("2026-12-02 第一项\n第二项")
    expect(screen.getByLabelText("任务 1 标题")).toHaveValue("编辑后的第一项")
    expect(screen.getByLabelText("任务 1 优先级")).toHaveValue("P0")
    expect(screen.getByLabelText("任务 1 截止日期")).toHaveTextContent("2026年12月1日")
    expect(screen.getByLabelText("选择任务 2")).not.toBeChecked()
  })

  it("正确识别 0000 至 0099 的四位年份", async () => {
    const { recognizeTasksLocally } = await import("./ai-api")

    expect(recognizeTasksLocally("0000-01-01 元年\n0099-12-31 九十九年\n0100-02-28 一百年")).toEqual([
      { title: "元年", priority: "P2", dueDate: "0000-01-01", needReport: false },
      { title: "九十九年", priority: "P2", dueDate: "0099-12-31", needReport: false },
      { title: "一百年", priority: "P2", dueDate: "0100-02-28", needReport: false },
    ])
  })
})
