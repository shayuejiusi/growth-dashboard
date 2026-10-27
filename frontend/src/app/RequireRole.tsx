import { Navigate, Outlet, useLocation } from "react-router"

import { StatePanel } from "@/components/feedback/StatePanel"
import { useSession } from "@/features/auth/use-session"

/** maxLevel 是可访问该路由的最大数字权限等级；1 级权限最高。 */
export function RequireRole({ maxLevel }: { maxLevel: 1 | 2 | 3 }) {
  const { data: user, isPending, isError, refetch } = useSession()
  const location = useLocation()

  if (isPending) return <StatePanel status="loading" />
  if (isError) return <StatePanel status="error" onRetry={() => void refetch()} />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.level > maxLevel) return <Navigate to="/dashboard" replace state={{ denied: true }} />
  return <Outlet />
}
