import { api } from "@/lib/api/client"
import type { DailyContent } from "./types"

export const contentKeys = {
  all: ["content"] as const,
  daily: () => [...contentKeys.all, "daily"] as const,
}

export function getDailyContent(signal?: AbortSignal) {
  return api<DailyContent | null>("/api/content/daily", { signal })
}
