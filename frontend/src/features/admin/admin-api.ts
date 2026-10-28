import { api } from "@/lib/api/client"
import type { AdminUser, CreateUserInput, ResetPasswordInput } from "./types"

export const adminKeys = {
  all: ["admin"] as const,
  users: () => [...adminKeys.all, "users"] as const,
}

export function getUsers(signal?: AbortSignal) {
  return api<AdminUser[]>("/api/admin/users", { signal })
}

export function createUser(input: CreateUserInput) {
  return api<AdminUser>("/api/admin/users", { method: "POST", body: input })
}

export function resetUserPassword(username: string, input: ResetPasswordInput) {
  return api<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, {
    method: "POST",
    body: input,
  })
}

export function deleteUser(username: string) {
  return api<{ deleted: boolean }>(`/api/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" })
}
