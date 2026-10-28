import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { sessionQueryKey } from "@/features/auth/use-session"
import { clearCsrfToken } from "@/lib/api/client"
import { UsersPage } from "./UsersPage"

const admin = { username: "admin", name: "系统管理员", level: 1 as const }
const initialUsers = [
  { ...admin, assessmentStatus: "COMPLETED" },
  { username: "manager", name: "部门主管", level: 2, assessmentStatus: "SKIPPED" },
]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function mockApi() {
  let users = initialUsers.map(({ username, name, level }) => ({ username, name, level, assessmentStatus: "NONE" }))
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? "GET"
    if (path === "/api/auth/csrf") return jsonResponse({ csrfToken: "users-csrf" })
    if (path === "/api/admin/users" && method === "GET") return jsonResponse(users)
    if (path === "/api/admin/users" && method === "POST") {
      const body = JSON.parse(String(init?.body))
      users = [...users, { ...body, assessmentStatus: "NONE" }]
      return jsonResponse(users.at(-1))
    }
    if (path === "/api/admin/users/manager/reset-password" && method === "POST") return jsonResponse({ ok: true })
    if (path === "/api/admin/users/manager" && method === "DELETE") {
      users = users.filter((user) => user.username !== "manager")
      return jsonResponse({ deleted: true })
    }
    return jsonResponse({ message: `未 mock 的接口：${method} ${path}` }, 500)
  }))
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(sessionQueryKey, admin)
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider><UsersPage /><Toaster theme="light" /></TooltipProvider>
    </QueryClientProvider>,
  )
  return queryClient
}

describe("账号管理", () => {
  beforeEach(() => clearCsrfToken())
  afterEach(() => {
    clearCsrfToken()
    toast.dismiss()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("一级管理员可新增用户，校验用户名、密码与等级且不重复提交", async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "新增用户" }))

    await user.type(screen.getByLabelText("用户名"), "a-")
    await user.type(screen.getByLabelText("密码"), "123")
    await user.click(screen.getByRole("button", { name: "创建用户" }))
    expect(await screen.findByText("用户名需为 2-20 位字母、数字或下划线")).toBeVisible()
    expect(screen.getByText("密码至少 6 位")).toBeVisible()
    expect(screen.getByLabelText("权限等级")).toHaveValue("3")

    await user.clear(screen.getByLabelText("用户名"))
    await user.type(screen.getByLabelText("用户名"), "new_user")
    await user.type(screen.getByLabelText("姓名"), "新成员")
    await user.clear(screen.getByLabelText("密码"))
    await user.type(screen.getByLabelText("密码"), "secret6")
    await user.selectOptions(screen.getByLabelText("权限等级"), "2")
    await user.click(screen.getByRole("button", { name: "创建用户" }))

    expect(await screen.findByText("用户已添加")).toBeVisible()
    expect(await screen.findByText("new_user")).toBeVisible()
    const creates = vi.mocked(fetch).mock.calls.filter(([path, init]) => path === "/api/admin/users" && init?.method === "POST")
    expect(creates).toHaveLength(1)
    expect(JSON.parse(String(creates[0][1]?.body))).toEqual({ username: "new_user", name: "新成员", level: 2, password: "secret6" })
    expect(creates[0][1]?.headers).toEqual(expect.objectContaining({ "X-CSRF-TOKEN": "users-csrf" }))
  })

  it("可重置他人密码，不能删除自己，且完全隐藏评估状态与恢复入口", async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("manager")

    expect(screen.queryByRole("button", { name: "删除用户 admin" })).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent("assessmentStatus")
    expect(document.body).not.toHaveTextContent("COMPLETED")
    expect(document.body).not.toHaveTextContent("SKIPPED")
    expect(screen.queryByRole("button", { name: /恢复.*评估/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: /评估/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "重置 manager 的密码" }))
    const password = screen.getByLabelText("新密码")
    expect(password).toHaveAttribute("type", "password")
    expect(password).toHaveAttribute("autocomplete", "new-password")
    await user.type(password, "new-secret")
    await user.click(screen.getByRole("button", { name: "确认重置密码" }))

    expect(await screen.findByText("密码已重置，该用户需重新登录")).toBeVisible()
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/admin/users/manager/reset-password", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ password: "new-secret" }),
    }))
    expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).includes("reset-assessment"))).toBe(false)
  })

  it("删除他人账号必须明确确认，成功后刷新账号查询", async () => {
    mockApi()
    const user = userEvent.setup()
    const queryClient = renderPage()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    await user.click(await screen.findByRole("button", { name: "删除用户 manager" }))

    expect(screen.getByRole("alertdialog")).toHaveTextContent("确认删除用户“manager”？该操作不可恢复。")
    await user.click(screen.getByRole("button", { name: "确认删除" }))

    await waitFor(() => expect(screen.queryByText("manager")).not.toBeInTheDocument())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "users"] })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/admin/users/manager", expect.objectContaining({ method: "DELETE" }))
  })

  it("长表单有未保存内容时要求确认放弃", async () => {
    mockApi()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "新增用户" }))
    await user.type(screen.getByLabelText("姓名"), "未保存成员")
    await user.click(screen.getByRole("button", { name: "关闭新增用户" }))

    expect(screen.getByRole("alertdialog", { name: "放弃未保存修改" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "继续编辑" }))
    expect(screen.getByLabelText("姓名")).toHaveValue("未保存成员")
  })
})
