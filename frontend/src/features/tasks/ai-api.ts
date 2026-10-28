import { api } from "@/lib/api/client"
import type { TaskPriority } from "./types"

export interface TaskDraft {
  title: string
  priority: TaskPriority
  dueDate: string | null
  needReport: boolean
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

/** 明确的简单本地规则：逐行拆分，并识别行内 YYYY-MM-DD 等日期；不调用 AI。 */
export function recognizeTasksLocally(text: string): TaskDraft[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const cleaned = line.trim().replace(/^(?:[-*•·]|\d+[.、)])\s*/, "").trim()
    if (!cleaned) return []
    const dateMatch = cleaned.match(/(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})日?/)
    const dueDate = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : null
    const title = (dateMatch ? cleaned.replace(dateMatch[0], "").trim() : cleaned).slice(0, 255)
    if (!title) return []
    return [{ title, priority: "P2" as const, dueDate, needReport: false }]
  })
}
