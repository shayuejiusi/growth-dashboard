import { api } from "@/lib/api/client"
import type { TaskPriority } from "./types"

export type TaskCategory = "德育" | "教学" | "行政"

export interface TaskDraft {
  title: string
  priority: TaskPriority
  dueDate: string | null
  needReport: boolean
  category: TaskCategory | null
  sourceText?: string | null
  confidence?: number | null
  needsReview?: boolean
  reviewReason?: string | null
}

export interface BatchImportResult {
  imported: number
  total: number
  failedIndex: number | null
  cause: Error | null
}

interface ExtractedText {
  filename: string
  text: string
  chars: number
}

export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024
const allowedExtension = /\.(txt|md|csv|docx|xlsx)$/i

export function validateImportFile(file: File): string | null {
  if (!allowedExtension.test(file.name)) return "仅支持 .txt、.md、.csv、.docx、.xlsx 文件"
  if (file.size > MAX_IMPORT_FILE_SIZE) return "文件不能超过 10MB"
  return null
}

export function extractDocumentText(file: File, signal?: AbortSignal) {
  const body = new FormData()
  body.append("file", file)
  return api<ExtractedText>("/api/ai/extract-text", { method: "POST", body, signal })
}

export function analyzeDocumentTasks(text: string, kind: "doc" | "official", signal?: AbortSignal) {
  return api<TaskDraft[]>("/api/ai/doc-to-tasks", {
    method: "POST",
    body: { text, kind, mode: "ai" },
    signal,
  })
}

function validDate(yearText: string, monthText: string, dayText: string): string | null {
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${yearText}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`
}

/** 明确的简单本地规则：逐行拆分，并识别行内 YYYY-MM-DD 等真实日期；不调用 AI。 */
export function recognizeTasksLocally(text: string): TaskDraft[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const cleaned = line.trim().replace(/^(?:[-*•·]|\d+[.、)])\s*/, "").trim()
    if (!cleaned) return []
    const dateMatch = cleaned.match(/(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})日?/)
    const dueDate = dateMatch ? validDate(dateMatch[1], dateMatch[2], dateMatch[3]) : null
    const title = (dateMatch && dueDate ? cleaned.replace(dateMatch[0], "").trim() : cleaned).slice(0, 255)
    if (!title) return []
    return [{ title, priority: "P2" as const, dueDate, needReport: false, category: null }]
  })
}
