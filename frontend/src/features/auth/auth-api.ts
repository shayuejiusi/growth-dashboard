import { api, clearCsrfToken, resetUnauthorized } from "@/lib/api/client"
import type { SessionUser } from "./use-session"

export interface LoginInput {
  username: string
  password: string
}

export function fetchSession() {
  return api<SessionUser>("/api/auth/me")
}

export async function login(input: LoginInput) {
  const user = await api<SessionUser>("/api/auth/login", {
    method: "POST",
    body: input,
    skipCsrf: true,
    skipUnauthorizedEvent: true,
  })
  clearCsrfToken()
  resetUnauthorized()
  return user
}

export async function logout() {
  try {
    await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" })
  } finally {
    clearCsrfToken()
    resetUnauthorized()
  }
}
