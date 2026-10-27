import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ApiError } from "@/lib/api/errors"
import { fetchSession, login, logout, type LoginInput } from "./auth-api"

export interface SessionUser {
  username: string
  name: string
  level: 1 | 2 | 3
}

export const sessionQueryKey = ["auth", "session"] as const

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
      queryClient.setQueryData(sessionQueryKey, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(sessionQueryKey, null)
    },
  })
}
