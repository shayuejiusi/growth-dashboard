import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ContentPage } from "./ContentPage"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

const daily = {
  date: "2026-10-28",
  matchedDimensions: ["不应展示的维度"],
  articles: [{
    title: "精选文章",
    url: "https://example.com/article",
    source: "示例媒体",
    points: ["要点一"],
    action: "读完记录一条行动",
  }],
  videos: [{
    title: "精选视频",
    url: "https://example.com/video",
    source: "示例视频站",
    points: ["要点二"],
    action: "观看后复盘",
  }],
  notice: "今日提示",
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><ContentPage /></QueryClientProvider>)
  return queryClient
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("每日精选", () => {
  it("分区展示安全文章和视频外链，不展示能力维度", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      ...daily,
      videos: [...daily.videos, { ...daily.videos[0], title: "不安全链接", url: "javascript:alert(1)" }],
    })))
    const { container } = (() => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      return render(<QueryClientProvider client={queryClient}><ContentPage /></QueryClientProvider>)
    })()

    const article = await screen.findByRole("link", { name: "精选文章" })
    const video = screen.getByRole("link", { name: "精选视频" })
    expect(article).toHaveAttribute("href", "https://example.com/article")
    expect(article).toHaveAttribute("target", "_blank")
    expect(article).toHaveAttribute("rel", "noreferrer")
    expect(video).toHaveAttribute("target", "_blank")
    expect(screen.getByRole("heading", { name: "文章" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "视频" })).toBeVisible()
    expect(screen.queryByRole("link", { name: "不安全链接" })).not.toBeInTheDocument()
    expect(screen.getByText("链接不可用")).toBeVisible()
    expect(container).not.toHaveTextContent("不应展示的维度")
    expect(container).not.toHaveTextContent("能力评估")
  })

  it("空内容显示明确空态", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null)))
    renderPage()

    expect(await screen.findByText("暂无每日精选")).toBeVisible()
    expect(screen.getByText(/当前没有可展示的文章或视频/)).toBeVisible()
  })

  it("具备加载、普通刷新中和刷新错误状态，错误时保留旧内容", async () => {
    let resolveFirst!: (response: Response) => void
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve })))
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText("正在加载每日精选")).toBeVisible()
    resolveFirst(jsonResponse(daily))
    expect(await screen.findByRole("link", { name: "精选文章" })).toBeVisible()

    let resolveRefresh!: (response: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRefresh = resolve }))
    await user.click(screen.getByRole("button", { name: "刷新内容" }))
    expect(screen.getByRole("button", { name: "正在刷新" })).toBeDisabled()
    resolveRefresh(jsonResponse({ message: "刷新失败" }, 500))

    expect(await screen.findByRole("alert")).toHaveTextContent("刷新失败")
    expect(screen.getByRole("link", { name: "精选文章" })).toBeVisible()
  })

  it("首次加载失败可重试", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "精选暂不可用" }, 500))
      .mockResolvedValueOnce(jsonResponse(daily)))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("精选暂不可用")
    await user.click(screen.getByRole("button", { name: "重新加载" }))
    expect(await screen.findByRole("link", { name: "精选文章" })).toBeVisible()
  })

  it("AI 换一批保持暂未配置禁用，不请求刷新接口或伪造新内容", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(daily)))
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("link", { name: "精选文章" })
    const aiButton = screen.getByRole("button", { name: "AI 换一批（暂未配置）" })

    expect(aiButton).toBeDisabled()
    expect(screen.getByText(/AI 提示词和 API 暂未配置/)).toBeVisible()
    await user.click(aiButton)

    expect(vi.mocked(fetch).mock.calls.filter(([path]) => String(path).includes("/daily/refresh"))).toHaveLength(0)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("link", { name: "精选文章" })).toBeVisible()
  })
})
