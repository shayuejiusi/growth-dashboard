import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { clearCsrfToken } from "@/lib/api/client"
import { TalentPage } from "./TalentPage"
import type { PersonNote, TalentBoard } from "./types"

function person(performance: number, potential: number): PersonNote {
  return {
    id: `person-${performance}-${potential}`,
    name: `成员${performance}${potential}`,
    roster: "教师组",
    performance,
    potential,
    observation: "观察内容",
    updatedAt: "2026-10-28T09:00:00",
  }
}

const board: TalentBoard = {
  rosters: { 教师组: [{ name: "张三", role: "教师" }] },
  people: Array.from({ length: 3 }, (_, p) => Array.from({ length: 3 }, (_, q) => person(p + 1, q + 1))).flat(),
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function mockApi(initial: TalentBoard = board) {
  let current: TalentBoard = structuredClone(initial)
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? "GET"
    if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "talent-csrf" })
    if (path === "/api/talent" && method === "GET") return jsonResponse(current)
    if (path === "/api/talent/people" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Omit<PersonNote, "id" | "updatedAt">
      const saved = { ...body, id: "new-person", updatedAt: "2026-10-28T10:00:00" }
      current = { ...current, people: [...current.people, saved] }
      return jsonResponse(saved)
    }
    const personMatch = path.match(/^\/api\/talent\/people\/([^/]+)$/)
    if (personMatch && method === "PUT") {
      const body = JSON.parse(String(init?.body)) as Omit<PersonNote, "id" | "updatedAt">
      const id = decodeURIComponent(personMatch[1])
      current = { ...current, people: current.people.map((item) => item.id === id ? { ...item, ...body } : item) }
      return jsonResponse(current.people.find((item) => item.id === id))
    }
    if (personMatch && method === "DELETE") {
      const id = decodeURIComponent(personMatch[1])
      current = { ...current, people: current.people.filter((item) => item.id !== id) }
      return jsonResponse({ deleted: true })
    }
    return jsonResponse({ message: `未 mock 的接口：${method} ${path}` }, 500)
  }))
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider><TalentPage /><Toaster theme="light" /></TooltipProvider>
    </QueryClientProvider>,
  )
  return queryClient
}

describe("人才筛选", () => {
  beforeEach(() => clearCsrfToken())
  afterEach(() => {
    clearCsrfToken()
    toast.dismiss()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("绩效从左到右、潜力从下到上，1–3 分落入正确宫格", async () => {
    mockApi()
    renderPage()
    await screen.findByRole("button", { name: "编辑成员11的观察记录" })

    for (let performance = 1; performance <= 3; performance += 1) {
      for (let potential = 1; potential <= 3; potential += 1) {
        const cell = screen.getByTestId(`nine-grid-cell-${performance}-${potential}`)
        expect(within(cell).getByRole("button", { name: `编辑成员${performance}${potential}的观察记录` })).toBeVisible()
        expect(cell).toHaveAttribute("data-performance", String(performance))
        expect(cell).toHaveAttribute("data-potential", String(potential))
      }
    }
    const cells = screen.getAllByTestId(/^nine-grid-cell-/)
    expect(cells).toHaveLength(9)
    expect(cells[0]).toHaveAttribute("data-potential", "3")
    expect(cells[8]).toHaveAttribute("data-potential", "1")
  })

  it("添加、编辑和删除观察记录均使 talent 查询失效", async () => {
    mockApi()
    const user = userEvent.setup()
    const queryClient = renderPage()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    await user.click(await screen.findByRole("button", { name: "新增观察记录" }))
    await user.selectOptions(screen.getByLabelText("成员"), screen.getByRole("option", { name: "张三（教师组）" }))
    await user.selectOptions(screen.getByLabelText("绩效"), "3")
    await user.selectOptions(screen.getByLabelText("潜力"), "2")
    await user.type(screen.getByLabelText("观察记录"), "本季度交付稳定")
    await user.click(screen.getByRole("button", { name: "保存观察记录" }))

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/talent/people", expect.objectContaining({ method: "POST" })))
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["talent"] })

    invalidate.mockClear()
    await user.click(await screen.findByRole("button", { name: "编辑成员11的观察记录" }))
    await user.selectOptions(screen.getByLabelText("潜力"), "3")
    await user.click(screen.getByRole("button", { name: "保存观察记录" }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/talent/people/person-1-1", expect.objectContaining({ method: "PUT" })))
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["talent"] })

    invalidate.mockClear()
    await user.click(await screen.findByRole("button", { name: "编辑成员12的观察记录" }))
    await user.click(screen.getByRole("button", { name: "删除观察记录" }))
    await user.click(screen.getByRole("button", { name: "确认删除" }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/talent/people/person-1-2", expect.objectContaining({ method: "DELETE" })))
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["talent"] })
  })

  it("名册与成员路径全部编码，增改删后同步失效 talent 查询", async () => {
    const roster = "教师 一组/研发"
    const name = "张 三/甲"
    const specialBoard: TalentBoard = { rosters: { [roster]: [{ name, role: "教师" }] }, people: [] }
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "talent-csrf" })
      if (path === "/api/talent") return jsonResponse(specialBoard)
      if (path.includes("/members")) return jsonResponse(init?.method === "DELETE" ? { deleted: true, removedNotes: 0 } : {})
      return jsonResponse({ message: `未 mock 的接口：${path}` }, 500)
    }))
    const user = userEvent.setup()
    const queryClient = renderPage()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    await user.click(await screen.findByRole("button", { name: `管理名册 ${roster}` }))

    await user.type(await screen.findByLabelText("成员姓名"), "新成员")
    await user.type(screen.getByLabelText("成员角色"), "教研")
    await user.click(screen.getByRole("button", { name: "添加成员" }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `/api/talent/rosters/${encodeURIComponent(roster)}/members`,
      expect.objectContaining({ method: "POST" }),
    ))
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["talent"] })

    invalidate.mockClear()
    await user.click(screen.getByRole("button", { name: `编辑成员 ${name}` }))
    await user.clear(await screen.findByLabelText("成员姓名"))
    await user.type(screen.getByLabelText("成员姓名"), "新 姓名/乙")
    await user.click(screen.getByRole("button", { name: "保存成员" }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `/api/talent/rosters/${encodeURIComponent(roster)}/members/${encodeURIComponent(name)}`,
      expect.objectContaining({ method: "PUT" }),
    ))
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["talent"] })

    invalidate.mockClear()
    await user.click(screen.getByRole("button", { name: `删除成员 ${name}` }))
    await user.click(screen.getByRole("button", { name: "确认删除" }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `/api/talent/rosters/${encodeURIComponent(roster)}/members/${encodeURIComponent(name)}`,
      expect.objectContaining({ method: "DELETE" }),
    ))
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["talent"] })
  })

  it("删除名册的确认文案明确连带删除成员与观察记录数量", async () => {
    const riskyBoard: TalentBoard = {
      rosters: { 教师组: [{ name: "张三", role: "教师" }, { name: "李四", role: "教研" }] },
      people: [person(1, 1), { ...person(2, 2), name: "李四" }],
    }
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "talent-csrf" })
      if (path === "/api/talent") return jsonResponse(riskyBoard)
      if (path === "/api/talent/rosters/%E6%95%99%E5%B8%88%E7%BB%84" && init?.method === "DELETE") {
        return jsonResponse({ deleted: true, removedMembers: 2, removedNotes: 2 })
      }
      return jsonResponse({ message: `未 mock 的接口：${path}` }, 500)
    }))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "管理名册 教师组" }))
    await user.click(screen.getByRole("button", { name: "删除名册" }))

    const dialog = screen.getByRole("alertdialog")
    expect(dialog).toHaveTextContent("2 名成员")
    expect(dialog).toHaveTextContent("2 条九宫格观察记录")
    expect(dialog).toHaveTextContent("一并删除")
    expect(dialog).toHaveTextContent("无法恢复")
    await user.click(screen.getByRole("button", { name: "确认删除名册" }))
    expect(await screen.findByText(/已删除名册/)).toHaveTextContent("2 名成员、2 条观察记录")
  })

  it("编辑成员有修改时，返回名册也必须明确确认放弃", async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "管理名册 教师组" }))
    await user.click(await screen.findByRole("button", { name: "编辑成员 张三" }))
    await user.type(await screen.findByLabelText("成员角色"), "组长")
    await user.click(screen.getByRole("button", { name: "返回名册" }))

    expect(await screen.findByRole("alertdialog", { name: "放弃未保存修改" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "继续编辑" }))
    expect(screen.getByLabelText("成员角色")).toHaveValue("教师组长")
    await user.click(screen.getByRole("button", { name: "返回名册" }))
    await user.click(screen.getByRole("button", { name: "放弃修改" }))
    expect(await screen.findByRole("button", { name: "添加成员" })).toBeVisible()
  })

  it("添加成员有输入时，关闭管理名册必须确认且可保留输入", async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "管理名册 教师组" }))
    await user.type(await screen.findByLabelText("成员姓名"), "未保存成员")
    await user.click(screen.getByRole("button", { name: "关闭管理名册：教师组" }))

    expect(await screen.findByRole("alertdialog", { name: "放弃未保存修改" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "继续编辑" }))
    expect(screen.getByLabelText("成员姓名")).toHaveValue("未保存成员")
  })
})
