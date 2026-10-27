import { api } from "@/lib/api/client"
import type { RemindersData } from "./types"

export const reminderKeys = {
  all: ["reminders"] as const,
  detail: () => [...reminderKeys.all, "detail"] as const,
}

export function getReminders(signal?: AbortSignal) {
  return api<RemindersData>("/api/reminders", { signal })
}
