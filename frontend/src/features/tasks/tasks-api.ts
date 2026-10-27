import { api } from "@/lib/api/client"
import { toApiError } from "@/lib/api/errors"

import type { Task, TaskInput } from "./types"

export const taskKeys = {
  all: ["tasks"] as const,
  list: () => [...taskKeys.all, "list"] as const,
}

export function getTasks(signal?: AbortSignal) {
  return api<Task[]>("/api/tasks", { signal })
}

export function createTask(input: TaskInput) {
  return api<Task>("/api/tasks", { method: "POST", body: input })
}

export function updateTask(id: string, input: TaskInput) {
  return api<Task>(`/api/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: input })
}

export function deleteTask(id: string) {
  return api<{ deleted: boolean }>(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" })
}

export function clearTasks() {
  return api<{ deleted: number }>("/api/tasks", { method: "DELETE" })
}

export function completeTask(id: string) {
  return api<Task>(`/api/tasks/${encodeURIComponent(id)}/complete`, { method: "POST" })
}

export function reopenTask(id: string) {
  return api<Task>(`/api/tasks/${encodeURIComponent(id)}/reopen`, { method: "POST" })
}

export function reorderTasks(tasks: Task[]) {
  return api<Task[]>("/api/tasks/order", {
    method: "PUT",
    body: { tasks: tasks.map(({ id, version }) => ({ id, version: version ?? 0 })) },
  })
}

export async function exportTasks(signal?: AbortSignal) {
  const path = "/api/tasks/export"
  const response = await fetch(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
    signal,
  })
  if (!response.ok) throw await toApiError(response, path)
  return response.blob()
}
