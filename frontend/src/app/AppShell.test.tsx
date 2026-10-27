import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it } from "vitest"

import { sessionQueryKey, type SessionUser } from "@/features/auth/use-session"
import { useUiStore } from "@/stores/ui-store"
import { AppShell } from "./AppShell"

const users: Record<number, SessionUser> = {
  1: { username: "admin", name: "系统管理员", level: 1 },
  2: { username: "manager", name: "内容经理", level: 2 },
  3: { username: "staff", name: "普通成员", level: 3 },
}

function renderShell(level: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(sessionQueryKey, users[level])
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("应用外壳权限导航", () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({ theme: "light", sidebarCollapsed: false })
    document.documentElement.classList.remove("dark")
  })

  it("level 3 只显示驾驶舱、任务和提醒，并隐藏能力与高权限入口", () => {
    renderShell(3)

    expect(screen.getByRole("link", { name: "工作台" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "任务管理" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "提醒事项" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /每日精选|账号|复盘|人才|能力/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/能力成长|能力评估/)).not.toBeInTheDocument()
  })

  it("level 2 隐藏账号、复盘和人才，level 1 显示全部七个入口", () => {
    const levelTwo = renderShell(2)
    expect(screen.getByRole("link", { name: "每日精选" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /账号|复盘|人才/ })).not.toBeInTheDocument()
    levelTwo.unmount()

    renderShell(1)
    const labels = ["工作台", "任务管理", "提醒事项", "每日精选", "账号管理", "工作复盘", "人才筛选"]
    for (const label of labels) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument()
    }
    expect(within(screen.getByRole("navigation", { name: "业务导航" })).getAllByRole("link")).toHaveLength(7)
  })

  it("提供搜索、新建任务和用户菜单等可访问操作", async () => {
    const user = userEvent.setup()
    renderShell(1)

    expect(screen.getByRole("button", { name: "搜索" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "新建任务" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "打开用户菜单" }))
    expect(screen.getByRole("menuitem", { name: "退出登录" })).toBeInTheDocument()
  })

  it("移动导航打开聚焦关闭按钮，导航内 Escape 后恢复触发器焦点", async () => {
    const user = userEvent.setup()
    renderShell(3)
    const trigger = screen.getByRole("button", { name: "打开导航菜单" })
    const sidebar = screen.getByRole("complementary", { name: "主导航" })

    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(sidebar).toHaveClass("invisible")
    await user.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(sidebar).not.toHaveClass("invisible")
    expect(screen.getByRole("button", { name: "关闭导航菜单" })).toHaveFocus()

    const taskLink = screen.getByRole("link", { name: "任务管理" })
    taskLink.focus()
    expect(taskLink).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveFocus()
    expect(sidebar).toHaveClass("invisible")
  })

  it("移动导航关闭按钮和导航跳转都不会把焦点留在隐藏侧栏", async () => {
    const user = userEvent.setup()
    renderShell(3)
    const trigger = screen.getByRole("button", { name: "打开导航菜单" })

    await user.click(trigger)
    await user.click(screen.getByRole("button", { name: "关闭导航菜单" }))
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.click(screen.getByRole("link", { name: "提醒事项" }))
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveFocus()
  })

  it("切换并持久化主题和侧栏折叠状态", async () => {
    const user = userEvent.setup()
    renderShell(3)

    await user.click(screen.getByRole("button", { name: "切换到深色模式" }))
    expect(document.documentElement).toHaveClass("dark")
    await user.click(screen.getByRole("button", { name: "折叠侧栏" }))

    const persisted = JSON.parse(localStorage.getItem("dashboard-ui") ?? "{}")
    expect(persisted.state).toEqual({ theme: "dark", sidebarCollapsed: true })
    expect(Object.keys(persisted.state)).toHaveLength(2)
  })
})
