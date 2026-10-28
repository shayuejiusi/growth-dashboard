import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useState } from "react"
import { useForm } from "react-hook-form"

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { BatchImportResult, TaskDraft } from "./ai-api"
import { DocumentImport } from "./DocumentImport"
import { emptyTaskForm, taskFormSchema, toTaskInput, type TaskFormValues } from "./task-form"
import type { TaskInput } from "./types"

interface QuickAddDrawerProps {
  open: boolean
  writePending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: TaskInput) => Promise<void>
  onImport: (drafts: TaskDraft[]) => Promise<BatchImportResult>
}

const selectClassName = "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-[3px]"

export function QuickAddDrawer({ open, writePending, onOpenChange, onSubmit, onImport }: QuickAddDrawerProps) {
  return open ? <QuickAddForm writePending={writePending} onOpenChange={onOpenChange} onSubmit={onSubmit} onImport={onImport} /> : null
}

function QuickAddForm({ onOpenChange, onSubmit, onImport, writePending = false }: Omit<QuickAddDrawerProps, "open">) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [documentDirty, setDocumentDirty] = useState(false)
  const [documentSubmitting, setDocumentSubmitting] = useState(false)
  const [closeBlocked, setCloseBlocked] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: emptyTaskForm,
  })

  const handleDocumentSubmitting = useCallback((submitting: boolean) => {
    setDocumentSubmitting(submitting)
    if (!submitting) setCloseBlocked(false)
  }, [])

  function requestClose() {
    if (isSubmitting || documentSubmitting) {
      setCloseBlocked(true)
      return
    }
    if (isDirty || documentDirty) setConfirmOpen(true)
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" onPointerDownOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>快速新建任务</DialogTitle>
            <DialogDescription>直接记录事项，或从已有文档提取文本后校对导入。</DialogDescription>
          </DialogHeader>
          {closeBlocked && (isSubmitting || documentSubmitting) ? (
            <Alert><AlertDescription>{documentSubmitting ? "正在提取或导入，完成后才能关闭。" : "正在创建任务，完成后才能关闭。"}</AlertDescription></Alert>
          ) : null}
          <Tabs defaultValue="manual">
            <TabsList className="grid w-full grid-cols-2" aria-label="快速新建方式">
              <TabsTrigger value="manual">手动填写</TabsTrigger>
              <TabsTrigger value="document">文档导入</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="pt-2">
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
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>取消</Button>
                <Button type="submit" form="quick-add-form" disabled={isSubmitting || writePending}>{isSubmitting ? "正在创建…" : "创建任务"}</Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="document" className="pt-2">
              <DocumentImport
                writePending={writePending}
                onDirtyChange={setDocumentDirty}
                onSubmittingChange={handleDocumentSubmitting}
                onImport={onImport}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="放弃未保存修改"
        description="当前表单或文档导入有尚未保存的内容，关闭后这些修改将丢失。"
        cancelText="继续编辑"
        actionText="放弃修改"
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  )
}
