import { api } from "@/lib/api/client"
import type { AiStatus, DashboardData, TaskItem } from "./types"

export const dashboardKeys = {
  all: ["dashboard"] as const,
  detail: () => [...dashboardKeys.all, "detail"] as const,
}

export function getDashboard(signal?: AbortSignal) {
  return api<DashboardData>("/api/dashboard", { signal })
}

export function getAiStatus(signal?: AbortSignal) {
  return api<AiStatus>("/api/ai/status", { signal })
}

export function completeTask(id: string) {
  return api<TaskItem>(`/api/tasks/${encodeURIComponent(id)}/complete`, { method: "POST" })
}
