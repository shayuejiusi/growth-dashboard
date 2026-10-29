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
      const result = await onImport(attempted.map((item) => ({
        title: item.title.trim(),
        priority: item.priority,
        dueDate: item.dueDate || null,
        needReport: item.needReport,
        category: item.category,
        ...(item.sourceText !== undefined ? {
          sourceText: item.sourceText,
          confidence: item.confidence,
          needsReview: item.needsReview,
          reviewReason: item.reviewReason,
        } : {}),
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

  const groups = [
    { label: "德育", category: "德育" },
    { label: "教学", category: "教学" },
    { label: "行政", category: "行政" },
    { label: "未分类", category: null },
  ].map((group) => ({
    ...group,
    entries: items.filter((item) => item.category === group.category),
  })).filter((group) => group.entries.length > 0)

  return (
    <div className="space-y-4" aria-label="导入预览">
      <p className="text-sm text-muted-foreground">已生成待办预览。请按分类校对并勾选需要导入的任务，预览阶段不会创建任务。</p>
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.label} className="space-y-3" aria-label={`${group.label}待办`}>
            <h3 className="text-sm font-semibold">{group.label}（{group.entries.length} 项）</h3>
            {group.entries.map((item) => {
              const number = item.id + 1
              return (
                <fieldset key={item.id} disabled={submitting || writePending} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <input
                      id={`draft-selected-${item.id}`}
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={item.selected}
                      onChange={(event) => update(item.id, { selected: event.target.checked })}
                    />
                    <Label htmlFor={`draft-selected-${item.id}`}>选择任务 {number}</Label>
                    {item.needsReview ? <span className="text-xs font-medium text-amber-700 dark:text-amber-400">需要复核</span> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
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
                      <Label htmlFor={`draft-category-${item.id}`}>任务 {number} 工作分类</Label>
                      <select id={`draft-category-${item.id}`} className={selectClassName} value={item.category ?? ""} onChange={(event) => update(item.id, { category: (event.target.value || null) as TaskDraft["category"] })}>
                        <option value="">未分类</option><option value="德育">德育</option><option value="教学">教学</option><option value="行政">行政</option>
                      </select>
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
                    <div className="flex items-center gap-2 pt-7">
                      <input id={`draft-report-${item.id}`} type="checkbox" className="size-4 accent-primary" checked={item.needReport} onChange={(event) => update(item.id, { needReport: event.target.checked })} />
                      <Label htmlFor={`draft-report-${item.id}`}>任务 {number} 需要上报</Label>
                    </div>
                  </div>
                  {item.needsReview ? <p className="text-sm text-amber-700 dark:text-amber-400">{item.reviewReason ?? "请复核任务内容。"}</p> : null}
                  {item.sourceText ? <details className="text-sm text-muted-foreground"><summary className="cursor-pointer select-none">查看原文依据</summary><p className="mt-2 whitespace-pre-wrap">{item.sourceText}</p></details> : null}
                </fieldset>
              )
            })}
          </section>
        ))}
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
