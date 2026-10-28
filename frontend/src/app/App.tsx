import { useQueryClient } from "@tanstack/react-query"
import { lazy, useEffect } from "react"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router"

import { StatePanel } from "@/components/feedback/StatePanel"
import { LoginPage } from "@/features/auth/LoginPage"
import { replaceSession, useSession } from "@/features/auth/use-session"
import { AppShell } from "./AppShell"
import { Providers } from "./providers"
import { RequireRole } from "./RequireRole"

const UsersPage = lazy(() => import("@/features/admin/UsersPage").then((module) => ({ default: module.UsersPage })))
const ContentPage = lazy(() => import("@/features/content/ContentPage").then((module) => ({ default: module.ContentPage })))
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })))
const RemindersPage = lazy(() => import("@/features/reminders/RemindersPage").then((module) => ({ default: module.RemindersPage })))
const ReviewPage = lazy(() => import("@/features/review/ReviewPage").then((module) => ({ default: module.ReviewPage })))
const TalentPage = lazy(() => import("@/features/talent/TalentPage").then((module) => ({ default: module.TalentPage })))
const TasksPage = lazy(() => import("@/features/tasks/TasksPage").then((module) => ({ default: module.TasksPage })))

function UnauthorizedBoundary() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    function handleUnauthorized() {
      replaceSession(queryClient, null)
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
