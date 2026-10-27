import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router"

import { StatePanel } from "@/components/feedback/StatePanel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginPage } from "@/features/auth/LoginPage"
import { sessionQueryKey, useSession } from "@/features/auth/use-session"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { RemindersPage } from "@/features/reminders/RemindersPage"
import { AppShell } from "./AppShell"
import { Providers } from "./providers"
import { RequireRole } from "./RequireRole"

function UnauthorizedBoundary() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    function handleUnauthorized() {
      queryClient.setQueryData(sessionQueryKey, null)
      if (location.pathname !== "/login") {
        navigate("/login", {
          replace: true,
          state: { from: { pathname: location.pathname, search: location.search, hash: location.hash } },
        })
      }
    }
    window.addEventListener("auth:unauthorized", handleUnauthorized)
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized)
  }, [location, navigate, queryClient])

  return null
}

function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useSession()
  const location = useLocation()
  if (isPending) return <StatePanel status="loading" className="min-h-screen" />
  if (isError) return <StatePanel status="error" className="min-h-screen" onRetry={() => void refetch()} />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

function PageContent({ title, description }: { title: string; description: string }) {
  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div>
        <h1 id="page-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <StatePanel status="empty" title="内容尚未接入" description="此业务模块将在后续阶段提供。" className="min-h-56" />
        </CardContent>
      </Card>
    </section>
  )
}

function AppRoutes() {
  return (
    <>
      <UnauthorizedBoundary />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tasks" element={<PageContent title="任务管理" description="组织任务并推进执行。" />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route element={<RequireRole maxLevel={2} />}>
              <Route path="/content" element={<PageContent title="每日精选" description="浏览为你整理的精选内容。" />} />
            </Route>
            <Route element={<RequireRole maxLevel={1} />}>
              <Route path="/admin/users" element={<PageContent title="账号管理" description="管理账号与权限等级。" />} />
              <Route path="/review" element={<PageContent title="工作复盘" description="回顾阶段工作并沉淀经验。" />} />
              <Route path="/talent" element={<PageContent title="人才筛选" description="查看人才筛选工作区。" />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  )
}
