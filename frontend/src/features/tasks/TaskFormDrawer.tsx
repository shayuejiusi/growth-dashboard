import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm, type UseFormReturn } from "react-hook-form"

import { FormDrawer } from "@/components/feedback/FormDrawer"
import { DatePicker } from "@/components/ui/date-picker"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { emptyTaskForm, taskFormSchema, taskToFormValues, toTaskInput, type TaskFormValues } from "./task-form"
import type { Task, TaskInput } from "./types"

const selectClassName = "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-[3px]"

interface TaskFormDrawerProps {
  open: boolean
  task: Task | null
  writePending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: TaskInput) => Promise<void>
}

interface TaskFormContentProps extends Omit<TaskFormDrawerProps, "open"> {
  form: UseFormReturn<TaskFormValues>
  requestClose: () => void
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-sm text-destructive">{message}</p> : null
}

function TaskFormContent({ form, requestClose, onSubmit, writePending = false }: TaskFormContentProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = form

  async function submit(values: TaskFormValues) {
    setSubmitError(null)
    try {
      await onSubmit(toTaskInput(values))
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "保存失败，请稍后重试。")
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="task-title">任务标题</Label>
        <Input id="task-title" autoFocus maxLength={255} aria-invalid={Boolean(errors.title)} aria-describedby="task-title-error" {...register("title")} />
        <FieldError id="task-title-error" message={errors.title?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-priority">优先级</Label>
          <select id="task-priority" className={selectClassName} {...register("priority")}>
            <option value="P0">P0 · 紧急重要</option>
            <option value="P1">P1 · 优先推进</option>
            <option value="P2">P2 · 常规任务</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-due-date">截止日期</Label>
          <Controller control={control} name="dueDate" render={({ field }) => (
            <DatePicker id="task-due-date" value={field.value} onChange={field.onChange} aria-invalid={Boolean(errors.dueDate)} aria-describedby="task-due-date-error" />
          )} />
          <FieldError id="task-due-date-error" message={errors.dueDate?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-repeat">重复类型</Label>
          <select id="task-repeat" className={selectClassName} {...register("repeatType")}>
            <option value="NONE">普通任务</option>
            <option value="DAILY">每日必做</option>
            <option value="WEEKLY">每周必做</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-category">工作分类</Label>
          <select id="task-category" className={selectClassName} {...register("category")}>
            <option value="">未分类</option>
            <option value="德育">德育</option>
            <option value="教学">教学</option>
            <option value="教研">教研</option>
            <option value="行政">行政</option>
            <option value="安全">安全</option>
            <option value="家校">家校</option>
            <option value="其他">其他</option>
          </select>
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm">
        <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" {...register("needReport")} />
        需要向领导汇报
      </label>

      <div className="space-y-2">
        <Label htmlFor="task-source">任务来源</Label>
        <Input id="task-source" maxLength={200} aria-describedby="task-source-error" placeholder="例如：学部安排" {...register("source")} />
        <FieldError id="task-source-error" message={errors.source?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-next-step">下一步行动</Label>
        <Textarea id="task-next-step" maxLength={500} rows={2} aria-describedby="task-next-step-error" {...register("nextStep")} />
        <FieldError id="task-next-step-error" message={errors.nextStep?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-outcome">预期成果</Label>
        <Textarea id="task-outcome" maxLength={500} rows={2} aria-describedby="task-outcome-error" {...register("expectedOutcome")} />
        <FieldError id="task-outcome-error" message={errors.expectedOutcome?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-blocker">阻塞点</Label>
        <Textarea id="task-blocker" maxLength={500} rows={2} aria-describedby="task-blocker-error" {...register("blocker")} />
        <FieldError id="task-blocker-error" message={errors.blocker?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-note">备注</Label>
        <Textarea id="task-note" maxLength={2000} rows={4} aria-describedby="task-note-error" {...register("note")} />
        <FieldError id="task-note-error" message={errors.note?.message} />
      </div>

      <div className="sticky bottom-0 -mx-1 space-y-3 border-t bg-background px-1 pt-4">
        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>任务未保存</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting || writePending} aria-busy={isSubmitting}>{isSubmitting ? "正在保存…" : "保存任务"}</Button>
        </div>
      </div>
    </form>
  )
}

export function TaskFormDrawer(props: TaskFormDrawerProps) {
  return props.open ? <OpenTaskFormDrawer {...props} /> : null
}

function OpenTaskFormDrawer({ task, writePending, onOpenChange, onSubmit }: TaskFormDrawerProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: task ? taskToFormValues(task) : emptyTaskForm,
  })

  return (
    <FormDrawer
      open
      onOpenChange={onOpenChange}
      dirty={form.formState.isDirty}
      title={task ? "编辑任务" : "新建任务"}
      description={task ? "调整任务内容，保存后同步更新工作台与提醒。" : "记录需要推进的工作，并明确下一步。"}
    >
      {(requestClose) => <TaskFormContent form={form} task={task} writePending={writePending} requestClose={requestClose} onOpenChange={onOpenChange} onSubmit={onSubmit} />}
    </FormDrawer>
  )
}
