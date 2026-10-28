import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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

function renderDrawer(onImport = vi.fn().mockResolvedValue(undefined)) {
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
    const onImport = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderDrawer(onImport)
    await openDocumentImport(user)
    await user.type(screen.getByLabelText("文本内容"), "- 完成周报\n2026-11-02 提交材料")

    await user.click(screen.getByRole("button", { name: "本地快速识别（简单规则）" }))

    expect(screen.getByLabelText("任务 1 标题")).toHaveValue("完成周报")
    expect(screen.getByLabelText("任务 2 标题")).toHaveValue("提交材料")
    expect(onImport).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText("任务 1 标题"))
    await user.type(screen.getByLabelText("任务 1 标题"), "已编辑周报")
    await user.selectOptions(screen.getByLabelText("任务 1 优先级"), "P0")
    await user.clear(screen.getByLabelText("任务 1 截止日期"))
    await user.type(screen.getByLabelText("任务 1 截止日期"), "2026-11-01")
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
})
