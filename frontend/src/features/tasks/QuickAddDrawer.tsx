import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { emptyTaskForm, taskFormSchema, toTaskInput, type TaskFormValues } from "./task-form"
import type { TaskInput } from "./types"

interface QuickAddDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: TaskInput) => Promise<void>
}

const selectClassName = "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-[3px]"

export function QuickAddDrawer({ open, onOpenChange, onSubmit }: QuickAddDrawerProps) {
  return open ? <QuickAddForm onOpenChange={onOpenChange} onSubmit={onSubmit} /> : null
}

function QuickAddForm({ onOpenChange, onSubmit }: Omit<QuickAddDrawerProps, "open">) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: emptyTaskForm,
  })

  function requestClose() {
    if (isDirty) setConfirmOpen(true)
    else onOpenChange(false)
  }

  async function submit(values: TaskFormValues) {
    setSubmitError(null)
    try {
      await onSubmit(toTaskInput(values))
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "创建失败，请稍后重试。")
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) requestClose() }}>
        <DialogContent onPointerDownOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>快速新建任务</DialogTitle>
            <DialogDescription>先记下最重要的事项，其他细节可稍后补充。</DialogDescription>
          </DialogHeader>
          <form id="quick-add-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="quick-title">任务标题</Label>
              <Input id="quick-title" autoFocus maxLength={255} aria-invalid={Boolean(errors.title)} {...register("title")} />
              {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-priority">优先级</Label>
                <select id="quick-priority" className={selectClassName} {...register("priority")}>
                  <option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-due-date">截止日期</Label>
                <Input id="quick-due-date" type="date" {...register("dueDate")} />
              </div>
            </div>
            {submitError ? <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert> : null}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>取消</Button>
            <Button type="submit" form="quick-add-form" disabled={isSubmitting}>{isSubmitting ? "正在创建…" : "创建任务"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="放弃未保存修改"
        description="当前表单有尚未保存的内容，关闭后这些修改将丢失。"
        cancelText="继续编辑"
        actionText="放弃修改"
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  )
}
