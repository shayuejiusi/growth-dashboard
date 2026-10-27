import {
  Bell,
  BookOpenCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SquareCheckBig,
  Sun,
  UserSearch,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router"
import { toast } from "sonner"

import { StatePanel } from "@/components/feedback/StatePanel"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLogout, useSession } from "@/features/auth/use-session"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"

interface NavigationItem {
  label: string
  path: string
  icon: LucideIcon
  maxLevel: 1 | 2 | 3
}

const navigation: NavigationItem[] = [
  { label: "工作台", path: "/dashboard", icon: LayoutDashboard, maxLevel: 3 },
  { label: "任务管理", path: "/tasks", icon: SquareCheckBig, maxLevel: 3 },
  { label: "提醒事项", path: "/reminders", icon: Bell, maxLevel: 3 },
  { label: "每日精选", path: "/content", icon: Newspaper, maxLevel: 2 },
  { label: "账号管理", path: "/admin/users", icon: Users, maxLevel: 1 },
  { label: "工作复盘", path: "/review", icon: BookOpenCheck, maxLevel: 1 },
  { label: "人才筛选", path: "/talent", icon: UserSearch, maxLevel: 1 },
]

const levelNames = { 1: "一级权限", 2: "二级权限", 3: "三级权限" }

export function AppShell() {
  const { data: user, isPending, isError, refetch } = useSession()
  const { theme, sidebarCollapsed, toggleTheme, toggleSidebar } = useUiStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileCloseRef = useRef<HTMLButtonElement>(null)
  const wasMobileOpen = useRef(false)
  const logout = useLogout()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  useEffect(() => {
    if (!mobileOpen) {
      if (wasMobileOpen.current) {
        mobileTriggerRef.current?.focus()
        wasMobileOpen.current = false
      }
      return
    }

    wasMobileOpen.current = true
    mobileCloseRef.current?.focus()
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false)
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [mobileOpen])

  if (isPending) return <StatePanel status="loading" className="min-h-screen" />
  if (isError) return <StatePanel status="error" className="min-h-screen" onRetry={() => void refetch()} />
  if (!user) return null

  const visibleNavigation = navigation.filter((item) => user.level <= item.maxLevel)

  async function handleLogout() {
    try {
      await logout.mutateAsync()
      toast.success("已退出登录")
      navigate("/login", { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "退出失败，请重试。")
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0">跳到主要内容</a>
      {mobileOpen ? (
        <button type="button" aria-label="关闭导航" className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}
      <aside
        id="primary-navigation"
        aria-label="主导航"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r bg-card transition-[width,transform] duration-200 md:translate-x-0",
          mobileOpen ? "visible translate-x-0" : "invisible md:visible",
          sidebarCollapsed ? "md:w-20" : "md:w-64",
        )}
      >
        <div className={cn("flex h-16 shrink-0 items-center border-b px-5", sidebarCollapsed && "md:justify-center md:px-2")}>
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground" aria-hidden="true">墨</span>
            <span className={cn("font-semibold tracking-tight", sidebarCollapsed && "md:hidden")}>个人工作看板</span>
          </div>
          <Button ref={mobileCloseRef} variant="ghost" size="icon" className="ml-auto md:hidden" aria-label="关闭导航菜单" onClick={() => setMobileOpen(false)}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="业务导航">
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              onClick={() => setMobileOpen(false)}
              title={sidebarCollapsed ? item.label : undefined}
              className={({ isActive }) => cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary/10 text-primary",
                sidebarCollapsed && "md:justify-center md:px-2",
              )}
            >
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              <span className={cn(sidebarCollapsed && "md:hidden")}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" className={cn("w-full justify-start gap-3", sidebarCollapsed && "md:justify-center md:px-2")} aria-label={sidebarCollapsed ? "展开侧栏" : "折叠侧栏"} onClick={toggleSidebar}>
                {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
                <span className={cn(sidebarCollapsed && "md:hidden")}>折叠侧栏</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{sidebarCollapsed ? "展开侧栏" : "折叠侧栏"}</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      <div className={cn("min-h-screen transition-[margin] duration-200", sidebarCollapsed ? "md:ml-20" : "md:ml-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <Button ref={mobileTriggerRef} variant="ghost" size="icon" className="md:hidden" aria-label="打开导航菜单" aria-controls="primary-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
            <Menu aria-hidden="true" />
          </Button>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium">你好，{user.name}</p>
            <p className="text-xs text-muted-foreground">安排好今天，从容推进每件事</p>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="搜索" onClick={() => toast.info("搜索面板将在后续阶段开放")}>
                  <Search aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>搜索</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"} onClick={toggleTheme}>
                  {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{theme === "light" ? "深色模式" : "浅色模式"}</TooltipContent>
            </Tooltip>
            <Button size="sm" aria-label="新建任务" onClick={() => navigate("/tasks?new=1")}>
              <Plus aria-hidden="true" /><span className="hidden sm:inline">新建任务</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2" aria-label="打开用户菜单">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">{user.name.slice(0, 1)}</span>
                  <span className="hidden max-w-24 truncate lg:inline">{user.name}</span>
                  <ChevronDown className="size-3" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <span className="block">{user.name}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">@{user.username} · {levelNames[user.level]}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={logout.isPending} onSelect={() => void handleLogout()}>
                  <LogOut aria-hidden="true" />退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
