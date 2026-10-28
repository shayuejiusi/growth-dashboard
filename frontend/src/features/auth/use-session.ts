import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import { advanceAuthSession } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { fetchSession, login, logout, type LoginInput } from "./auth-api"

export interface SessionUser {
  username: string
  name: string
  level: 1 | 2 | 3
}

export const sessionQueryKey = ["auth", "session"] as const

export function replaceSession(queryClient: QueryClient, user: SessionUser | null) {
  // 作废旧代次响应，再同步取消并清空 Query 与 Mutation，最后才能建立新会话。
  advanceAuthSession()
  void queryClient.cancelQueries()
  queryClient.clear()
  queryClient.setQueryData(sessionQueryKey, user)
}

export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      try {
        return await fetchSession()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (user) => {
      replaceSession(queryClient, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      replaceSession(queryClient, null)
    },
  })
}
