import { useEffect, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BatchImportResult, TaskDraft } from "./ai-api"
import type { TaskPriority } from "./types"

interface ImportPreviewProps {
  drafts: TaskDraft[]
  writePending?: boolean
  onSubmittingChange?: (submitting: boolean) => void
  onImport: (drafts: TaskDraft[]) => Promise<BatchImportResult>
}

type PreviewItem = TaskDraft & { id: number; selected: boolean }

const selectClassName = "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-[3px]"

export function ImportPreview({ drafts, writePending = false, onSubmittingChange, onImport }: ImportPreviewProps) {
  const [items, setItems] = useState<PreviewItem[]>(() => drafts.map((draft, id) => ({ ...draft, id, selected: true })))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = items.filter((item) => item.selected)
  const hasEmptyTitle = selected.some((item) => !item.title.trim())

  useEffect(() => {
    onSubmittingChange?.(submitting)
  }, [onSubmittingChange, submitting])

  useEffect(() => () => {
    onSubmittingChange?.(false)
  }, [onSubmittingChange])

  function update(id: number, patch: Partial<PreviewItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  async function importSelected() {
    const attempted = selected
    setSubmitting(true)
    setError(null)
    try {
      const result = await onImport(attempted.map(({ title, priority, dueDate, needReport }) => ({
        title: title.trim(), priority, dueDate: dueDate || null, needReport,
      })))
      const succeededIds = new Set(attempted.slice(0, result.imported).map((item) => item.id))
      setItems((current) => current.filter((item) => !succeededIds.has(item.id)))
      if (result.failedIndex !== null) {
        const unexecuted = result.total - result.imported - 1
        setError(`已成功 ${result.imported}、失败 1、未执行 ${unexecuted}。${result.cause?.message ?? "请重试剩余任务。"}`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败，请稍后重试。")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4" aria-label="导入预览">
      <p className="text-sm text-muted-foreground">已按简单本地规则生成预览。请校对并勾选需要导入的任务，预览阶段不会创建任务。</p>
      <div className="space-y-3">
        {items.map((item, index) => {
          const number = index + 1
          return (
            <fieldset key={item.id} disabled={submitting || writePending} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_7rem_10rem] sm:items-end">
              <div className="flex items-center gap-2 self-center">
                <input
                  id={`draft-selected-${item.id}`}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={item.selected}
                  onChange={(event) => update(item.id, { selected: event.target.checked })}
                />
                <Label htmlFor={`draft-selected-${item.id}`}>选择任务 {number}</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`draft-title-${item.id}`}>任务 {number} 标题</Label>
                <Input
                  id={`draft-title-${item.id}`}
                  value={item.title}
                  maxLength={255}
                  aria-invalid={item.selected && !item.title.trim()}
                  onChange={(event) => update(item.id, { title: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`draft-priority-${item.id}`}>任务 {number} 优先级</Label>
                <select id={`draft-priority-${item.id}`} className={selectClassName} value={item.priority} onChange={(event) => update(item.id, { priority: event.target.value as TaskPriority })}>
                  <option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`draft-date-${item.id}`}>任务 {number} 截止日期</Label>
                <DatePicker id={`draft-date-${item.id}`} value={item.dueDate ?? ""} onChange={(dueDate) => update(item.id, { dueDate: dueDate || null })} />
              </div>
            </fieldset>
          )
        })}
      </div>
      {hasEmptyTitle ? <p className="text-sm text-destructive">所选任务的标题不能为空</p> : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button
        type="button"
        className="w-full"
        disabled={selected.length === 0 || hasEmptyTitle || submitting || writePending}
        onClick={() => void importSelected()}
      >
        {submitting ? "正在导入…" : `导入所选任务（${selected.length} 项）`}
      </Button>
    </div>
  )
}
