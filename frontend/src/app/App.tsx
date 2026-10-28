import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router"

import { StatePanel } from "@/components/feedback/StatePanel"
import { UsersPage } from "@/features/admin/UsersPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { sessionQueryKey, useSession } from "@/features/auth/use-session"
import { ContentPage } from "@/features/content/ContentPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { RemindersPage } from "@/features/reminders/RemindersPage"
import { ReviewPage } from "@/features/review/ReviewPage"
import { TalentPage } from "@/features/talent/TalentPage"
import { TasksPage } from "@/features/tasks/TasksPage"
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
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route element={<RequireRole maxLevel={2} />}>
              <Route path="/content" element={<ContentPage />} />
            </Route>
            <Route element={<RequireRole maxLevel={1} />}>
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/talent" element={<TalentPage />} />
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
