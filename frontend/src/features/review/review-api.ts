import { api } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import type { ReviewDraft } from "./types"

export const reviewKeys = {
  all: ["review"] as const,
  daily: () => [...reviewKeys.all, "daily"] as const,
}

export async function getDailyReview(signal?: AbortSignal): Promise<ReviewDraft | null> {
  try {
    return await api<ReviewDraft>("/api/review/daily", { signal })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function generateDailyReview() {
  return api<ReviewDraft>("/api/review/daily/generate", { method: "POST" })
}
