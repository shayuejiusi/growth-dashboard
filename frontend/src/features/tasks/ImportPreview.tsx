import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TaskDraft } from "./ai-api"
import type { TaskPriority } from "./types"

interface ImportPreviewProps {
  drafts: TaskDraft[]
  writePending?: boolean
  onImport: (drafts: TaskDraft[]) => Promise<void>
}

const selectClassName = "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-[3px]"

export function ImportPreview({ drafts, writePending = false, onImport }: ImportPreviewProps) {
  const [items, setItems] = useState(() => drafts.map((draft) => ({ ...draft, selected: true })))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = items.filter((item) => item.selected)
  const hasEmptyTitle = selected.some((item) => !item.title.trim())

  function update(index: number, patch: Partial<(typeof items)[number]>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  async function importSelected() {
    setSubmitting(true)
    setError(null)
    try {
      await onImport(selected.map(({ title, priority, dueDate, needReport }) => ({
        title: title.trim(), priority, dueDate: dueDate || null, needReport,
      })))
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
            <fieldset key={number} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_7rem_10rem] sm:items-end">
              <div className="flex items-center gap-2 self-center">
                <input
                  id={`draft-selected-${number}`}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={item.selected}
                  onChange={(event) => update(index, { selected: event.target.checked })}
                />
                <Label htmlFor={`draft-selected-${number}`}>选择任务 {number}</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`draft-title-${number}`}>任务 {number} 标题</Label>
                <Input
                  id={`draft-title-${number}`}
                  value={item.title}
                  maxLength={255}
                  aria-invalid={item.selected && !item.title.trim()}
                  onChange={(event) => update(index, { title: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`draft-priority-${number}`}>任务 {number} 优先级</Label>
                <select id={`draft-priority-${number}`} className={selectClassName} value={item.priority} onChange={(event) => update(index, { priority: event.target.value as TaskPriority })}>
                  <option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`draft-date-${number}`}>任务 {number} 截止日期</Label>
                <Input id={`draft-date-${number}`} type="date" value={item.dueDate ?? ""} onChange={(event) => update(index, { dueDate: event.target.value || null })} />
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
